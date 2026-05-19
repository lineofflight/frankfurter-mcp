export interface RateRecord {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

export interface Provider {
  key: string;
  name: string;
}

export interface GetRatesParams {
  base?: string;
  date?: string;
  from?: string;
  to?: string;
  quotes?: string[];
  providers?: string[];
}
