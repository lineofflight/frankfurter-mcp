# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.4.0]

Focus the server on currency conversion.

### Changed

- `convert` is now the primary tool.
- `get_rates` is trimmed to single-snapshot lookups — the latest day or a single
  `date` — with optional `base` and `quotes`.
- Server instructions reframed around `convert`, pointing time series, historical
  ranges, provider-specific rates, and bulk queries to the REST API at
  https://api.frankfurter.dev/v2.

### Removed

- The `list_providers` tool.
- `get_rates`' `start`/`end` time-series range and the `provider` filter — use the
  REST API for these.

## [0.3.1]

### Changed

- Clarified edge cases in the tool descriptions.

## [0.3.0]

### Added

- `list_currencies` tool — supported ISO 4217 currency codes and names.

## [0.2.0]

### Added

- `list_providers` tool.

### Changed

- Reworked the `convert` and `get_rates` tools.
