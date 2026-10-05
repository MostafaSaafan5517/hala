// Proves the no-double-booking and idempotency guarantees under real concurrency: many database
// connections calling the booking function at the same moment, the way simultaneous customers
// and retried assistant tool calls would. pgTAP can't do this (it runs in one session).
//
// Each call runs like an API request: in its own transaction, as the `authenticated` role with
// the owner's JWT claims, so Row-Level Security and the function's own checks all apply.

import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The local Supabase database (the CLI's default credentials, on this project's port).
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const pool = new pg.Pool({ connectionString: databaseUrl, max: 25 });

const ownerId = randomUUID();
let businessId: string;
let serviceId: string;
let laylaId: string;
let omarId: string;

// Tomorrow (UTC) at an hour: comfortably inside the notice period and the horizon. Each test
// books its own hour, so the tests don't affect each other.
function tomorrowAt(hour: number) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 1);
  day.setUTCHours(hour, 0, 0, 0);
  return day.toISOString();
}

let phoneCounter = 0;
function newPhone() {
  phoneCounter += 1;
  return `+2010${String(phoneCounter).padStart(8, "0")}`;
}

async function signInAsOwner(client: pg.PoolClient) {
  await client.query("begin");
  await client.query(
    "select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ sub: ownerId, role: "authenticated" })],
  );
}

type BookingRequest = {
  startsAt: string;
  staffId?: string;
  phone?: string;
  idempotencyKey?: string;
};

async function book(client: pg.PoolClient, request: BookingRequest) {
  const { rows } = await client.query<{ id: string; staff_id: string }>(
    "select id, staff_id from public.book_appointment($1, $2, $3, $4, $5, $6)",
    [
      serviceId,
      request.startsAt,
      "Test Customer",
      request.phone ?? newPhone(),
      request.idempotencyKey ?? randomUUID(),
      request.staffId ?? null,
    ],
  );
  const booking = rows[0];
  if (!booking) throw new Error("book_appointment returned no booking");
  return booking;
}

/** One booking request, start to finish on its own connection, like one API call. */
async function bookInOwnTransaction(request: BookingRequest) {
  const client = await pool.connect();
  try {
    await signInAsOwner(client);
    const booking = await book(client, request);
    await client.query("commit");
    return booking;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Waits until the connection with this backend pid is blocked waiting for a lock. */
async function waitUntilBlocked(pid: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await pool.query<{ wait_event_type: string | null }>(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Connection ${pid} never waited for a lock`);
}

async function confirmedBookingsAt(startsAt: string) {
  const { rows } = await pool.query<{ staff_id: string }>(
    "select staff_id from public.bookings where business_id = $1 and starts_at = $2 and status = 'confirmed'",
    [businessId, startsAt],
  );
  return rows.map((row) => row.staff_id);
}

function errorCodes(results: PromiseSettledResult<unknown>[]) {
  return results.flatMap((result) =>
    result.status === "rejected"
      ? [(result.reason as { code?: string }).code]
      : [],
  );
}

beforeAll(async () => {
  // A business open around the clock in UTC, with two staff who both do a 30-minute service.
  // Set up directly as the database, like a seed.
  await pool.query("insert into auth.users (id, email) values ($1, $2)", [
    ownerId,
    `owner-${ownerId}@test.local`,
  ]);
  const business = await pool.query<{ id: string }>(
    "insert into public.businesses (name, slug, timezone) values ('Race Salon', $1, 'UTC') returning id",
    [`race-${ownerId.slice(0, 8)}`],
  );
  businessId = business.rows[0]!.id;
  await pool.query(
    "insert into public.business_members (business_id, user_id, role) values ($1, $2, 'owner')",
    [businessId, ownerId],
  );
  const service = await pool.query<{ id: string }>(
    "insert into public.services (business_id, name_en, duration_minutes, price, currency) values ($1, 'Haircut', 30, 20000, 'EGP') returning id",
    [businessId],
  );
  serviceId = service.rows[0]!.id;
  const staff = await pool.query<{ id: string; name: string }>(
    "insert into public.staff (business_id, name) values ($1, 'Layla'), ($1, 'Omar') returning id, name",
    [businessId],
  );
  laylaId = staff.rows.find((row) => row.name === "Layla")!.id;
  omarId = staff.rows.find((row) => row.name === "Omar")!.id;
  await pool.query(
    "insert into public.staff_services (business_id, staff_id, service_id) select $1, unnest($2::uuid[]), $3",
    [businessId, [laylaId, omarId], serviceId],
  );
  await pool.query(
    "insert into public.working_hours (business_id, weekday, opens_at, closes_at) select $1, weekday, '00:00', '24:00' from generate_series(0, 6) as weekday",
    [businessId],
  );
});

afterAll(async () => {
  await pool.query("delete from public.businesses where id = $1", [businessId]);
  await pool.query("delete from auth.users where id = $1", [ownerId]);
  await pool.end();
});

describe("two bookings for the same slot at the same moment", () => {
  it("the second waits for the first to commit, then is refused", async () => {
    const startsAt = tomorrowAt(9);
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await signInAsOwner(first);
      await signInAsOwner(second);
      await book(first, { startsAt, staffId: laylaId });

      // The first booking isn't committed yet, so the second request still sees the slot as
      // free and has to wait for the first transaction to end, in line for the staff member's
      // schedule; then the exclusion constraint refuses it.
      const { rows } = await second.query<{ pid: number }>(
        "select pg_backend_pid() as pid",
      );
      const secondAttempt = book(second, { startsAt, staffId: laylaId });
      secondAttempt.catch(() => undefined);
      await waitUntilBlocked(rows[0]!.pid);

      await first.query("commit");
      await expect(secondAttempt).rejects.toMatchObject({
        code: "HB001",
        message: "That time is already booked",
      });
      await second.query("rollback");
    } finally {
      first.release();
      second.release();
    }
    expect(await confirmedBookingsAt(startsAt)).toEqual([laylaId]);
  });

  it("if the first is rolled back instead, the waiting one gets the slot", async () => {
    const startsAt = tomorrowAt(10);
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await signInAsOwner(first);
      await signInAsOwner(second);
      await book(first, { startsAt, staffId: laylaId });

      const { rows } = await second.query<{ pid: number }>(
        "select pg_backend_pid() as pid",
      );
      const secondAttempt = book(second, { startsAt, staffId: laylaId });
      secondAttempt.catch(() => undefined);
      await waitUntilBlocked(rows[0]!.pid);

      await first.query("rollback");
      await expect(secondAttempt).resolves.toMatchObject({
        staff_id: laylaId,
      });
      await second.query("commit");
    } finally {
      first.release();
      second.release();
    }
    expect(await confirmedBookingsAt(startsAt)).toEqual([laylaId]);
  });
});

describe("a burst of simultaneous requests", () => {
  it("twenty requests for one staff member's slot: exactly one is booked", async () => {
    const startsAt = tomorrowAt(11);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        bookInOwnTransaction({ startsAt, staffId: laylaId }),
      ),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(errorCodes(results)).toEqual(Array(19).fill("HB001"));
    expect(await confirmedBookingsAt(startsAt)).toEqual([laylaId]);
  });

  it("twenty requests for anyone free: each staff member is booked once", async () => {
    const startsAt = tomorrowAt(12);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => bookInOwnTransaction({ startsAt })),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);
    expect(errorCodes(results)).toEqual(Array(18).fill("HB001"));
    expect((await confirmedBookingsAt(startsAt)).toSorted()).toEqual(
      [laylaId, omarId].toSorted(),
    );
  });

  it("ten copies of one request (same idempotency key) book once and all get that booking", async () => {
    const startsAt = tomorrowAt(13);
    const request = {
      startsAt,
      staffId: omarId,
      phone: newPhone(),
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => bookInOwnTransaction(request)),
    );

    const bookingIds = results.map((result) =>
      result.status === "fulfilled" ? result.value.id : "refused",
    );
    expect(new Set(bookingIds).size).toBe(1);
    expect(bookingIds[0]).not.toBe("refused");
    expect(await confirmedBookingsAt(startsAt)).toEqual([omarId]);
  });

  it("twenty bookings moved onto one slot: exactly one is moved", async () => {
    // Twenty of Layla's bookings, half an hour apart from 14:00, all moved to 08:00 at once.
    const firstStart = new Date(tomorrowAt(14)).getTime();
    const bookings = [];
    for (let index = 0; index < 20; index += 1) {
      const startsAt = new Date(firstStart + index * 30 * 60_000).toISOString();
      bookings.push(await bookInOwnTransaction({ startsAt, staffId: laylaId }));
    }
    const newStart = tomorrowAt(8);

    const results = await Promise.allSettled(
      bookings.map(async (booking) => {
        const client = await pool.connect();
        try {
          await signInAsOwner(client);
          await client.query(
            "select id from public.reschedule_booking($1, $2, $3)",
            [booking.id, newStart, randomUUID()],
          );
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(errorCodes(results)).toEqual(Array(19).fill("HB001"));
    expect(await confirmedBookingsAt(newStart)).toEqual([laylaId]);
  });
});
