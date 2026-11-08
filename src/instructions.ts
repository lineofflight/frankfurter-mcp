export const INSTRUCTIONS = [
  "Use convert for amounts; set details:true when the rate or effective date is needed. Report amount and currency unless asked for more.",
  "Daily reference rates, not live trading prices. Omit provider for blended rates; specify an institution for its published figures (ECB: European Central Bank; UST: U.S. Treasury). Dates within a weekly, monthly or quarterly period use the rate in force. To cite published digits, use get_rates with the institution's own base.",
  "Use known codes directly. If unsure, filter list_currencies or list_providers instead of fetching the whole catalogue. Supply get_rates quotes when known.",
  "For time series or bulk queries: https://frankfurter.dev/llms.txt",
].join("\n");
