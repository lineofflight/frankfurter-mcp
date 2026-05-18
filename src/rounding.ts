export function roundToCurrency(
  value: number,
  currency: string,
): { value: number; rounded: boolean } {
  try {
    // Intl.NumberFormat does not throw for well-formed-but-unknown codes (e.g.
    // "ZZZ") on current Node; it silently defaults to 2 digits. Gate on the
    // ISO 4217 set so unknown codes return unrounded rather than guessing.
    if (!Intl.supportedValuesOf("currency").includes(currency.toUpperCase())) {
      return { value, rounded: false };
    }
    const digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const factor = 10 ** digits;
    return { value: Math.round(value * factor) / factor, rounded: true };
  } catch {
    return { value, rounded: false };
  }
}
