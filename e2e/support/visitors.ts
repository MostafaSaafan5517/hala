/**
 * Headers making a browser context look like its own website visitor. The widget limits each
 * visitor (by IP) to a few new conversations an hour, and locally every test comes from the same
 * address. On Vercel the platform sets x-real-ip itself, so a visitor can't do this.
 */
export function asNewVisitor() {
  const byte = () => Math.floor(Math.random() * 256);
  return { "x-real-ip": `10.${byte()}.${byte()}.${byte()}` };
}
