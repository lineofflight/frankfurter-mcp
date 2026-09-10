export const INSTRUCTIONS = [
  "`convert` is the primary tool; prefer it for any single conversion.",
  "Report the converted amount with its currency, nothing more unless asked.",
  "",
  "Rates are blended across 96 central banks and official sources.",
  "",
  "Pass `provider` to `convert` or `get_rates` when the user needs one institution's published figure rather than the blend, as for tax or customs filings: UST is the U.S. Treasury's quarterly reporting rate, and a date inside the quarter returns the rate in force. `list_providers` gives the keys.",
  "For a figure to cite, use `get_rates` with the provider's own base: it echoes the published digits and the date they took effect.",
  "",
  "For time series or other bulk queries, see https://frankfurter.dev/llms.txt",
].join("\n");
