export const INSTRUCTIONS = [
  "Frankfurter provides blended exchange rates aggregated from 50+ institutional",
  "sources (central banks, the IMF, the Federal Reserve). Rates are daily reference",
  "rates, not real-time trading rates, and this is not financial advice.",
  "",
  "`convert` is the primary tool: it turns an amount from one currency into another,",
  "rounded to the target's minor units. Use `get_rates` when you need the raw rate",
  "behind a conversion or a single day's snapshot, and `list_currencies` to check",
  "valid ISO 4217 codes.",
  "",
  "For time series, historical ranges, provider-specific rates, or any bulk query,",
  "call the REST API at https://api.frankfurter.dev/v2 directly — it's faster and",
  "keeps large payloads out of the model's context.",
].join("\n");
