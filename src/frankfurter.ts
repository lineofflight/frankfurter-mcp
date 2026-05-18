import type { GetRatesParams, RateRecord } from "./types.js";

const DEFAULT_BASE_URL = "https://api.frankfurter.dev";

export class FrankfurterClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.FRANKFURTER_API_URL ?? DEFAULT_BASE_URL;
  }

  async getRates(params: GetRatesParams): Promise<RateRecord[]> {
    const url = new URL("/v2/rates", this.baseUrl);
    if (params.base) url.searchParams.set("base", params.base);
    if (params.date) url.searchParams.set("date", params.date);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    if (params.quotes?.length) url.searchParams.set("quotes", params.quotes.join(","));
    if (params.providers?.length) url.searchParams.set("providers", params.providers.join(","));

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as RateRecord[];
  }
}
