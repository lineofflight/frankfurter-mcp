import type { Currency, GetRatesParams, Provider, RateRecord } from "./types.js";

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
    if (params.start) url.searchParams.set("from", params.start);
    if (params.end) url.searchParams.set("to", params.end);
    if (params.quotes?.length) url.searchParams.set("quotes", params.quotes.join(","));
    if (params.providers?.length) url.searchParams.set("providers", params.providers.join(","));

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as RateRecord[];
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

  async getProviders(): Promise<Provider[]> {
    const url = new URL("/v2/providers", this.baseUrl);
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as Array<{ key: string; name: string }>;
    return data.map(({ key, name }) => ({ key, name }));
  }
}
