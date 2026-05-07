// ─── Raw Listing ──────────────────────────────────────────────────────────────

/**
 * The normalized shape that every adapter must produce.
 * All fields beyond source / source_id are optional because different
 * data providers expose different subsets.
 */
export interface RawListing {
  /** Adapter identifier, e.g. "attom" */
  source: string;
  /** Provider-native unique identifier for the property */
  source_id: string;

  address?: string;
  zip: string;
  city?: string;
  state?: string;

  beds?: number;
  baths?: number;
  sqft?: number;

  list_price?: number;
  avm_value?: number;
  days_on_market?: number;
  price_cuts?: number;

  last_sold_price?: number;
  /** ISO 8601 date string, e.g. "2022-04-15" */
  last_sold_date?: string;

  owner_type?: string;
  tax_delinquent?: boolean;

  /** ISO 8601 timestamp of the most recent update from the source */
  last_source_updated?: string;

  /** The full raw provider response for debugging / future mapping */
  raw_data?: Record<string, unknown>;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

/**
 * Every data-source adapter must implement this interface.
 * Adapters are responsible for:
 *  1. Fetching data from the external API
 *  2. Mapping provider-specific fields to RawListing
 *  3. Respecting rate limits internally (or delegating to the caller's queue)
 */
export interface ListingAdapter {
  /** Human-readable adapter name, matches the `source` field on RawListing */
  readonly name: string;

  /**
   * Fetch listings for one or more zip codes.
   * Implementations should perform one API call per zip code and return
   * the combined results without deduplication (caller handles that).
   *
   * @param zipCodes - Array of 5-digit US zip codes
   * @returns Flat array of normalized RawListings
   */
  fetch(zipCodes: string[]): Promise<RawListing[]>;
}