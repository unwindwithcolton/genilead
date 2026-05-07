import type { ListingAdapter, RawListing } from "./types";

// ATTOM Data Solutions — Property Snapshot adapter
// Docs: https://api.developer.attomdata.com/docs
// Free tier: 100 API calls / day. One call per zip code.

const ATTOM_BASE = "https://api.gateway.attomdata.com";
const SNAPSHOT_PATH = "/propertyapi/v1.0.0/property/snapshot";

// ─── Internal ATTOM shapes ────────────────────────────────────────────────────

interface AttomIdentifier {
  Id?: number;
  attomId?: number;
  apn?: string;
  apnOrig?: string;
}

interface AttomAddress {
  line1?: string;
  locality?: string; // city
  countrySubd?: string; // state abbrev
  postal1?: string; // zip
}

interface AttomSummary {
  propclass?: string;
  proptype?: string;
  yearbuilt?: number;
  propLandUse?: string;
  absenteeInd?: string; // "Y" | "N"
}

interface AttomBuilding {
  rooms?: {
    beds?: number;
    bathstotal?: number;
  };
  size?: {
    universalsize?: number; // sqft
  };
}

interface AttomSale {
  amount?: {
    saleamt?: number;
  };
  salesearchdate?: string; // "YYYY-MM-DD"
}

interface AttomAssessment {
  market?: {
    mktttlvalue?: number; // AVM proxy
  };
  tax?: {
    taxamt?: number;
    taxdelinquency?: string; // "Y" | "N"
  };
}

interface AttomProperty {
  identifier?: AttomIdentifier;
  address?: AttomAddress;
  summary?: AttomSummary;
  building?: AttomBuilding;
  sale?: AttomSale;
  assessment?: AttomAssessment;
  // ATTOM doesn't return days-on-market in snapshot; set to null
}

interface AttomSnapshotResponse {
  status?: { code?: number; msg?: string };
  property?: AttomProperty[];
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapAttomProperty(
  prop: AttomProperty,
  zip: string
): RawListing | null {
  const sourceId =
    prop.identifier?.attomId?.toString() ?? prop.identifier?.apn;
  if (!sourceId) return null;

  const addr = prop.address;
  const bldg = prop.building;
  const sale = prop.sale;
  const assess = prop.assessment;
  const summary = prop.summary;

  // Derive owner_type from absenteeInd
  let owner_type: string | undefined;
  if (summary?.absenteeInd === "Y") owner_type = "absentee";
  else if (summary?.absenteeInd === "N") owner_type = "owner_occupied";

  const taxDelinquency = assess?.tax?.taxdelinquency;
  const tax_delinquent =
    taxDelinquency != null ? taxDelinquency === "Y" : undefined;

  return {
    source: "attom",
    source_id: sourceId,
    address: addr?.line1 ?? undefined,
    zip: addr?.postal1 ?? zip,
    city: addr?.locality ?? undefined,
    state: addr?.countrySubd ?? undefined,
    beds: bldg?.rooms?.beds ?? undefined,
    baths: bldg?.rooms?.bathstotal ?? undefined,
    sqft: bldg?.size?.universalsize ?? undefined,
    list_price: undefined, // snapshot endpoint doesn't carry active list price
    avm_value: assess?.market?.mktttlvalue ?? undefined,
    days_on_market: undefined,
    price_cuts: 0,
    last_sold_price: sale?.amount?.saleamt ?? undefined,
    last_sold_date: sale?.salesearchdate ?? undefined,
    owner_type,
    tax_delinquent,
    last_source_updated: new Date().toISOString(),
    raw_data: prop as Record<string, unknown>,
  };
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class AttomAdapter implements ListingAdapter {
  readonly name = "attom";

  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ATTOM_API_KEY;
    if (!key) {
      throw new Error(
        "AttomAdapter: ATTOM_API_KEY is required but not set. " +
          "Set it in .env.local or pass it to the constructor."
      );
    }
    this.apiKey = key;
  }

  async fetch(zipCodes: string[]): Promise<RawListing[]> {
    const results: RawListing[] = [];

    for (const zip of zipCodes) {
      try {
        const url = new URL(`${ATTOM_BASE}${SNAPSHOT_PATH}`);
        url.searchParams.set("postalcode", zip);

        const response = await fetch(url.toString(), {
          headers: {
            apikey: this.apiKey,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.error(
            `[AttomAdapter] zip=${zip} HTTP ${response.status} ${response.statusText}`
          );
          continue;
        }

        const json: AttomSnapshotResponse = await response.json();

        console.log("[attom] raw response keys:", Object.keys(json));
        console.log("[attom] property count:", json.property?.length ?? "undefined");
        if (!json.property || json.property.length === 0) {
          console.warn(`[AttomAdapter] zip=${zip} returned 0 properties`);
          continue;
        }

        for (const prop of json.property) {
          console.log("[attom] identifier:", JSON.stringify(prop.identifier));
          const mapped = mapAttomProperty(prop, zip);
          console.log("[attom] mapped:", mapped ? "ok" : "null");
          if (mapped) results.push(mapped);
        }
      } catch (err) {
        console.error(`[AttomAdapter] zip=${zip} fetch error:`, err);
        // Continue with the next zip — ingest route handles retry per zip
      }
    }

    return results;
  }
}