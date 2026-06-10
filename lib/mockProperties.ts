// lib/mockProperties.ts
// Mock prospected properties — Kankakee County
//
// ── THE SWAP PLAN ──────────────────────────────────────────────────────────
// This file's Property type matches the shape /api/explorer/properties will
// return once ATTOM data is in Supabase. When that's ready:
//   1. Build the API route that SELECTs from scored listings
//   2. In ExplorerScreen, replace `import { MOCK_PROPERTIES }` with a fetch
//   3. Delete this file. MapPanel doesn't change at all.
// ───────────────────────────────────────────────────────────────────────────

export type Tier = "hot" | "warm" | "nurture";

export interface Property {
  id: string;           // will be the Supabase row id / ATTOM attomId
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  tier: Tier;
  score: number;        // 0–100 GeniLead score
  equity: string;       // display string for now; real data will be numeric
  avm: string;
  signal: string;       // top signal driving the score
}

export const MOCK_PROPERTIES: Property[] = [
  // ── Kankakee city core (60901) — HOT cluster ──
  { id: "p001", address: "412 S Chicago Ave",   city: "Kankakee",    zip: "60901", lat: 41.1148, lng: -87.8623, tier: "hot",     score: 91, equity: "$82k", avm: "$118k", signal: "Tax delinquent 3yr" },
  { id: "p002", address: "879 W Merchant St",   city: "Kankakee",    zip: "60901", lat: 41.1192, lng: -87.8761, tier: "hot",     score: 88, equity: "$74k", avm: "$96k",  signal: "Absentee + delinquent" },
  { id: "p003", address: "1245 E Oak St",       city: "Kankakee",    zip: "60901", lat: 41.1107, lng: -87.8489, tier: "hot",     score: 86, equity: "$68k", avm: "$104k", signal: "Estate transfer" },
  { id: "p004", address: "228 N Indiana Ave",   city: "Kankakee",    zip: "60901", lat: 41.1224, lng: -87.8594, tier: "warm",    score: 71, equity: "$55k", avm: "$132k", signal: "18yr owner tenure" },
  { id: "p005", address: "1633 S 4th Ave",      city: "Kankakee",    zip: "60901", lat: 41.0989, lng: -87.8678, tier: "hot",     score: 84, equity: "$61k", avm: "$88k",  signal: "Tax delinquent 2yr" },
  { id: "p006", address: "557 W Hickory St",    city: "Kankakee",    zip: "60901", lat: 41.1166, lng: -87.8702, tier: "warm",    score: 68, equity: "$49k", avm: "$110k", signal: "Absentee owner" },

  // ── Bourbonnais (60914) — WARM ──
  { id: "p007", address: "1450 Career Center Rd", city: "Bourbonnais", zip: "60914", lat: 41.1839, lng: -87.8785, tier: "warm",  score: 66, equity: "$58k", avm: "$215k", signal: "14yr tenure" },
  { id: "p008", address: "327 Stratford Dr E",  city: "Bourbonnais",  zip: "60914", lat: 41.1701, lng: -87.8812, tier: "warm",   score: 64, equity: "$52k", avm: "$198k", signal: "Equity spread" },
  { id: "p009", address: "892 Belle Aire Ave",  city: "Bourbonnais",  zip: "60914", lat: 41.1755, lng: -87.8689, tier: "nurture",score: 42, equity: "$31k", avm: "$226k", signal: "Low motivation" },
  { id: "p010", address: "1108 Cardinal Dr",    city: "Bourbonnais",  zip: "60914", lat: 41.1922, lng: -87.8854, tier: "warm",   score: 62, equity: "$47k", avm: "$209k", signal: "Absentee owner" },

  // ── Bradley (60915) — WARM, rising ──
  { id: "p011", address: "245 S Cleveland Ave", city: "Bradley",      zip: "60915", lat: 41.1442, lng: -87.8551, tier: "warm",   score: 69, equity: "$51k", avm: "$154k", signal: "Delinquency rising" },
  { id: "p012", address: "778 W Broadway St",   city: "Bradley",      zip: "60915", lat: 41.1409, lng: -87.8672, tier: "warm",   score: 65, equity: "$46k", avm: "$148k", signal: "16yr tenure" },
  { id: "p013", address: "1024 E North St",     city: "Bradley",      zip: "60915", lat: 41.1498, lng: -87.8488, tier: "hot",    score: 82, equity: "$59k", avm: "$121k", signal: "Tax delinquent + absentee" },

  // ── Momence (60954) — HOT cluster ──
  { id: "p014", address: "118 N Dixie Hwy",     city: "Momence",      zip: "60954", lat: 41.1614, lng: -87.6622, tier: "hot",    score: 89, equity: "$71k", avm: "$94k",  signal: "Tax delinquent 4yr" },
  { id: "p015", address: "414 E River St",      city: "Momence",      zip: "60954", lat: 41.1672, lng: -87.6548, tier: "hot",    score: 85, equity: "$66k", avm: "$102k", signal: "Estate + absentee" },
  { id: "p016", address: "732 S Pine St",       city: "Momence",      zip: "60954", lat: 41.1581, lng: -87.6601, tier: "warm",   score: 70, equity: "$53k", avm: "$115k", signal: "21yr tenure" },

  // ── Manteno (60950) — mixed ──
  { id: "p017", address: "489 N Walnut St",     city: "Manteno",      zip: "60950", lat: 41.2541, lng: -87.8312, tier: "warm",   score: 61, equity: "$44k", avm: "$192k", signal: "Equity spread" },
  { id: "p018", address: "156 S Oak St",        city: "Manteno",      zip: "60950", lat: 41.2478, lng: -87.8289, tier: "nurture",score: 38, equity: "$27k", avm: "$214k", signal: "Low motivation" },
  { id: "p019", address: "923 Sycamore Ln",     city: "Manteno",      zip: "60950", lat: 41.2602, lng: -87.8401, tier: "nurture",score: 35, equity: "$24k", avm: "$236k", signal: "Recent purchase" },

  // ── St. Anne (60964) ──
  { id: "p020", address: "211 W Station St",    city: "St. Anne",     zip: "60964", lat: 41.0254, lng: -87.7142, tier: "warm",   score: 67, equity: "$48k", avm: "$89k",  signal: "Absentee + tenure" },
  { id: "p021", address: "508 N Chicago Ave",   city: "St. Anne",     zip: "60964", lat: 41.0301, lng: -87.7166, tier: "hot",    score: 83, equity: "$57k", avm: "$76k",  signal: "Tax delinquent 2yr" },

  // ── Grant Park (60940) — nurture ──
  { id: "p022", address: "334 W Taylor St",     city: "Grant Park",   zip: "60940", lat: 41.2411, lng: -87.6464, tier: "nurture",score: 31, equity: "$22k", avm: "$241k", signal: "Low signal" },
  { id: "p023", address: "127 S Meadow Ln",     city: "Grant Park",   zip: "60940", lat: 41.2389, lng: -87.6422, tier: "nurture",score: 28, equity: "$19k", avm: "$255k", signal: "Recent purchase" },

  // ── Herscher (60941) ──
  { id: "p024", address: "445 N Main St",       city: "Herscher",     zip: "60941", lat: 41.0498, lng: -88.0978, tier: "warm",   score: 63, equity: "$45k", avm: "$167k", signal: "19yr tenure" },

  // ── Chebanse (60922) ──
  { id: "p025", address: "682 S Chestnut St",   city: "Chebanse",     zip: "60922", lat: 41.0042, lng: -87.9087, tier: "warm",   score: 60, equity: "$41k", avm: "$142k", signal: "Absentee owner" },
];