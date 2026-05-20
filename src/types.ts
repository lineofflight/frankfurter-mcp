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

export interface Currency {
  iso_code: string;
  name: string;
  iso_numeric?: string | null;
  symbol?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface GetRatesParams {
  base?: string;
  date?: string;
  start?: string;
  end?: string;
  quotes?: string[];
  providers?: string[];
}
