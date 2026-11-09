export interface RateRecord {
  date: string;
  base: string;
  quote: string;
  rate: number;
  provider?: string;
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
  quotes?: string[];
  provider?: string;
}

export interface Provider {
  key: string;
  name: string;
  country_code?: string | null;
  rate_type?: string | null;
  pivot_currency?: string | null;
  data_url?: string | null;
  terms_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  publish_cadence?: string | null;
  frequency?: "daily" | "weekly" | "monthly" | "quarterly";
  publishes_missed?: number | null;
  currencies: string[];
  datasets?: Dataset[];
}

// A provider's rate series. A provider key selects its default datasets; a dataset key such as
// NBP.B selects one.
export interface Dataset {
  key: string;
  default: boolean;
  frequency?: "daily" | "weekly" | "monthly" | "quarterly";
  currencies: string[];
}
