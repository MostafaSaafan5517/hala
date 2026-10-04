/**
 * A service's name in the dashboard: the English one when there is one, otherwise the Arabic one,
 * marked with its language so it gets the right font and direction.
 */
export function ServiceName({
  service,
}: {
  service: { name_en: string | null; name_ar: string | null };
}) {
  return service.name_en ? (
    <span lang="en">{service.name_en}</span>
  ) : (
    <span lang="ar" dir="rtl">
      {service.name_ar}
    </span>
  );
}
