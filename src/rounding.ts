// Known ISO 4217 currency: round to its minor units (USD 2, JPY 0, BHD 3).
// Unknown / no minor unit (precious metals XAU/XAG/XPT/XPD): round to 8
// significant figures. Magnitude-independent (a tiny metal amount like
// 0.00022345 keeps precision; a large one is trimmed sanely) and clamps
// IEEE-754 float noise (0.022000000000000002 -> 0.022). No false precision.
export function roundMoney(value: number, currency: string): number {
  const code = currency.toUpperCase();
  if (Intl.supportedValuesOf("currency").includes(code)) {
    const digits =
      new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
  return Number(value.toPrecision(8));
}
