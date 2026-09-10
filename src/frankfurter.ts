import type { Currency, GetRatesParams, Provider, RateRecord } from "./types.js";

const DEFAULT_BASE_URL = "https://api.frankfurter.dev";

export class FrankfurterClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.FRANKFURTER_API_URL ?? DEFAULT_BASE_URL;
  }

  async getRates(params: GetRatesParams): Promise<RateRecord[]> {
    // One provider's rates as published, unblended; otherwise the blend.
    const path = params.provider
      ? `/v2/providers/${encodeURIComponent(params.provider.toLowerCase())}/rates`
      : "/v2/rates";
    const url = new URL(path, this.baseUrl);
    if (params.base) url.searchParams.set("base", params.base);
    if (params.date) url.searchParams.set("date", params.date);
    if (params.quotes?.length) url.searchParams.set("quotes", params.quotes.join(","));

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as RateRecord[];
  }

  async getProviders(): Promise<Provider[]> {
    const url = new URL("/v2/providers", this.baseUrl);
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as Provider[];
  }

  async getCurrencies(): Promise<Currency[]> {
    const url = new URL("/v2/currencies", this.baseUrl);
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as Currency[];
  }
}
