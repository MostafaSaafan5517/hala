/**
 * Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits as 0-9, so numbers typed on an Arabic
 * keyboard (prices, phone numbers) work too.
 */
export function westernDigits(text: string) {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}
