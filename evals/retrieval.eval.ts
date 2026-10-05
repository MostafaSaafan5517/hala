import { mkdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { EMBEDDING_MODELS } from "@/lib/ai/catalog";
import { embeddingModelId, embedTexts } from "@/lib/ai/embeddings";
import { serviceClient } from "../integration/support";
import { createEvalSalon } from "./salon";

// How well search by meaning separates relevant passages from the rest, for the embedding model
// in use: every passage's similarity to each question, then, for a range of thresholds, how many
// questions still find a right passage and how many unanswerable ones would get a wrong one. The
// catalog's minSimilarity is chosen from this report. Costs a fraction of a cent with a real model.

const QUESTIONS: { question: string; expected: string[] }[] = [
  { question: "Is there parking?", expected: ["Is there parking?"] },
  { question: "Where can I leave my car?", expected: ["Is there parking?"] },
  { question: "هل يوجد موقف للسيارات؟", expected: ["Is there parking?"] },
  { question: "Do you take Visa?", expected: ["Can I pay by card?"] },
  {
    question: "Can I pay cash?",
    expected: ["Can I pay by card?", "هل يمكن الدفع نقداً؟"],
  },
  {
    question: "هل تقبلون البطاقات البنكية؟",
    expected: ["Can I pay by card?", "هل يمكن الدفع نقداً؟"],
  },
  {
    question: "Do you do kids' haircuts?",
    expected: ["Do you cut children's hair?"],
  },
  {
    question: "هل تقصون شعر الأطفال؟",
    expected: ["Do you cut children's hair?"],
  },
  { question: "What if I'm running late?", expected: ["سياسة التأخير"] },
  { question: "ماذا يحدث إذا تأخرت عن موعدي؟", expected: ["سياسة التأخير"] },
  { question: "How late can I cancel?", expected: ["Cancellation policy"] },
  { question: "كيف ألغي موعدي؟", expected: ["Cancellation policy"] },
  { question: "Any discounts right now?", expected: ["Seasonal offers"] },
  // Nothing in the knowledge base answers these.
  { question: "Do you sell gift cards?", expected: [] },
  { question: "Do you offer massages?", expected: [] },
  { question: "هل لديكم خدمة توصيل؟", expected: [] },
  { question: "What's the wifi password?", expected: [] },
  { question: "Can I bring my dog?", expected: [] },
];

const THRESHOLDS = Array.from({ length: 15 }, (_, index) => 0.05 * (index + 1));

it("measures how search by meaning separates relevant passages", async () => {
  const model = embeddingModelId();
  const salon = await createEvalSalon();
  const { embeddings } = await embedTexts({
    businessId: salon.business.id,
    purpose: "search",
    values: QUESTIONS.map((entry) => entry.question),
  });

  // Every passage's similarity to each question: no threshold, keyword matches ignored.
  const scored = await Promise.all(
    QUESTIONS.map(async (entry, index) => {
      const { data, error } = await serviceClient().rpc("search_knowledge", {
        target_business_id: salon.business.id,
        query_text: "",
        query_embedding: JSON.stringify(embeddings[index]),
        query_model: model,
        min_similarity: -1,
        match_count: 50,
      });
      if (error) throw error;
      return {
        ...entry,
        passages: data.map((row) => ({
          title: row.title,
          similarity: row.similarity,
          relevant: entry.expected.includes(row.title),
        })),
      };
    }),
  );

  const answerable = scored.filter((entry) => entry.expected.length > 0);
  const unanswerable = scored.filter((entry) => entry.expected.length === 0);
  const rows = THRESHOLDS.map((threshold) => {
    const found = answerable.filter((entry) =>
      entry.passages.some(
        (passage) => passage.relevant && passage.similarity >= threshold,
      ),
    ).length;
    const leaked = unanswerable.filter((entry) =>
      entry.passages.some((passage) => passage.similarity >= threshold),
    ).length;
    const noise = answerable.reduce(
      (sum, entry) =>
        sum +
        entry.passages.filter(
          (passage) => !passage.relevant && passage.similarity >= threshold,
        ).length,
      0,
    );
    return {
      threshold,
      found,
      leaked,
      noise,
      // The share of answerable questions answered, minus the share of unanswerable ones that
      // would get a wrong passage: higher is better.
      score: found / answerable.length - leaked / unanswerable.length,
    };
  });
  const best = rows.reduce((top, row) => (row.score > top.score ? row : top));
  const current = EMBEDDING_MODELS[model].minSimilarity;

  const lines = [
    `# Retrieval, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Embedding model: \`${model}\` · current minSimilarity: ${current} · best here: ${best.threshold.toFixed(2)}`,
    "",
    `${answerable.length} questions have an answer in the knowledge base, ${unanswerable.length} don't. Keyword matches are left out: they're the other half of search, not affected by the threshold.`,
    "",
    "| Threshold | Answerable questions finding a right passage | Unanswerable questions getting a passage | Wrong passages for answerable questions | Score |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.threshold.toFixed(2)}${Math.abs(row.threshold - current) < 1e-9 ? " (current)" : ""} | ${row.found}/${answerable.length} | ${row.leaked}/${unanswerable.length} | ${row.noise} | ${row.score.toFixed(2)} |`,
    ),
    "",
    "## Similarities per question",
    ...scored.flatMap((entry) => [
      "",
      `**${entry.question}** (${entry.expected.length ? `expects ${entry.expected.join(", ")}` : "no answer"})`,
      "",
      ...entry.passages
        .slice(0, 4)
        .map(
          (passage) =>
            `- ${passage.similarity.toFixed(3)} ${passage.relevant ? "✅" : "·"} ${passage.title}`,
        ),
    ]),
  ];
  mkdirSync("evals/reports", { recursive: true });
  const name = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-retrieval-${model.replace(/\W+/g, "-")}`;
  writeFileSync(`evals/reports/${name}.md`, lines.join("\n"));
  process.stdout.write(
    `Retrieval: best threshold ${best.threshold.toFixed(2)} (current ${current}). Report: evals/reports/${name}.md\n`,
  );
});
