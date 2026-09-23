export const INSTRUCTIONS = [
  "`convert` is the primary tool; prefer it for any single conversion.",
  "Report the converted amount with its currency, nothing more unless asked.",
  "",
  "Rates are blended across central banks and official sources.",
  "",
  "Pass `provider` (or `providers` on `get_rates`) when the user needs published figures from specific institutions rather than the blend, as for tax or customs filings: ECB is the European Central Bank, UST is the U.S. Treasury's quarterly reporting rate, and a date inside the quarter returns the rate in force. `list_providers` gives the rest of the keys.",
  "`get_rates` accepts multiple providers to compare institutions in a single query. For a figure to cite, use `get_rates` with the provider's own base: it echoes the published digits and the date they took effect.",
  "",
  "For time series or other bulk queries, see https://frankfurter.dev/llms.txt",
].join("\n");
