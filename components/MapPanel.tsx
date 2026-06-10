// components/MapPanel.tsx
// Real Leaflet map — Kankakee County (v3)
// v3 changes:
//   - Kankakee County border drawn as permanent bright outline (the "frame")
//   - Property pin system: tier-colored markers from props.properties
//     (mock data now — same render path will be used for real ATTOM/Supabase data)
//   - Dual tile layers: base map + labels on top so town names stay visible
// Carried from v2: single GeoJSON fetch + cache, zones only on search/select,
// canvas renderer for performance

"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Property } from "../lib/mockProperties";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier  = "hot" | "warm" | "nurture";
type Layer = "equity" | "dom" | "tenure" | "delinquency";

interface ZipData {
  name: string;
  tier: Tier;
  leads: number;
  topScore: Record<Layer, number>;
}

interface MapPanelProps {
  zips:            Record<string, ZipData>;
  layer:           Layer;
  selectedZip:     string;
  compareList:     string[];
  compareMode:     boolean;
  searchQuery:     string;
  properties:      Property[];                      // prospected properties → pins
  onZipClick:      (zip: string) => void;
  onPropertyClick?: (property: Property) => void;   // ready to route to Dashboard drawer later
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<Tier, string> = {
  hot:    "#f87171",
  warm:   "#fbbf24",
  nurture:"#60a5fa",
};

const SLOT_COLORS = ["#3b82f6", "#a855f7", "#10b981"] as const;

const COUNTY_BORDER_COLOR = "#3b82f6";   // GeniLead accent blue

function scoreToColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#3b82f6";
  return "#6b7094";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapPanel({
  zips, layer, selectedZip, compareList, compareMode, searchQuery,
  properties, onZipClick, onPropertyClick,
}: MapPanelProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const geojsonRef    = useRef<any>(null);               // cached ZIP GeoJSON
  const zoneLayerRef  = useRef<L.LayerGroup | null>(null);
  const pinLayerRef   = useRef<L.LayerGroup | null>(null);
  const lastFlownRef  = useRef<string>("");

  // Latest props in a ref — handlers never go stale
  const propsRef = useRef({ zips, layer, selectedZip, compareList, compareMode, properties, onZipClick, onPropertyClick });
  propsRef.current = { zips, layer, selectedZip, compareList, compareMode, properties, onZipClick, onPropertyClick };

  // ── Bootstrap: map, tiles, county border, GeoJSON cache ────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center:             [41.14, -87.86],
      zoom:               11,
      zoomControl:        false,
      attributionControl: false,
      renderer:           L.canvas(),
      zoomAnimation:      true,
      fadeAnimation:      true,
    });

    // Base map — roads and geography, no labels
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      updateWhenIdle: false,
      keepBuffer: 4,
    }).addTo(map);

    // Labels on top — renders above zones & county border so town names stay visible
    const labelPane = map.createPane("labels");
    labelPane.style.zIndex = "650";
    labelPane.style.pointerEvents = "none";
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      pane: "labels",
    }).addTo(map);

    L.control.attribution({ position: "bottomleft", prefix: false })
      .addTo(map)
      .setPrefix('<span style="font-size:9px;opacity:0.35">© CARTO © OpenStreetMap</span>');

    L.control.zoom({ position: "bottomright" }).addTo(map);

    zoneLayerRef.current = L.layerGroup().addTo(map);
    pinLayerRef.current  = L.layerGroup().addTo(map);
    mapRef.current = map;

    // County border — the permanent frame. Bright outline, no fill.
    fetch("/kankakee-county.json")
      .then(r => r.json())
      .then(county => {
        const border = L.geoJSON(county, {
          style: {
            color:       COUNTY_BORDER_COLOR,
            weight:      2.5,
            opacity:     0.85,
            fill:        false,
            dashArray:   undefined,
          },
          interactive: false,    // border is visual only — clicks pass through
        });
        border.addTo(map);
        // Frame the county on first load
        map.fitBounds(border.getBounds(), { padding: [30, 30] });
      })
      .catch(err => console.error("Failed to load kankakee-county.json:", err));

    // ZIP zones GeoJSON — fetched once, cached
    fetch("/kankakee-zips.json")
      .then(r => r.json())
      .then(data => {
        geojsonRef.current = data;
        renderZones();
      })
      .catch(err => console.error("Failed to load kankakee-zips.json:", err));

    renderPins();   // initial pin render

    return () => {
      map.remove();
      mapRef.current = null;
      zoneLayerRef.current = null;
      pinLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Property pins — tier-colored circle markers ─────────────────────────────
  function renderPins() {
    const map   = mapRef.current;
    const group = pinLayerRef.current;
    if (!map || !group) return;

    const { properties, onPropertyClick } = propsRef.current;
    group.clearLayers();

    properties.forEach(p => {
      const color = TIER_COLOR[p.tier];

      const marker = L.circleMarker([p.lat, p.lng], {
        radius:      p.tier === "hot" ? 8 : 6,
        color:       "#0e1018",          // dark ring makes pins pop on any background
        weight:      2,
        fillColor:   color,
        fillOpacity: 0.95,
      });

      marker.bindTooltip(
        `<div style="background:#13151b;border:1px solid rgba(255,255,255,0.18);border-radius:7px;padding:8px 11px;font-family:Inter,sans-serif;min-width:150px;">
          <div style="font-size:11.5px;font-weight:800;color:#e8ecf8;">${p.address}</div>
          <div style="font-size:9.5px;color:#8892a4;margin-top:1px;">${p.city}, IL ${p.zip}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px;">
            <span style="font-size:9px;font-weight:800;color:${color};">${p.tier.toUpperCase()}</span>
            <span style="font-size:9px;color:#6b7094;">·</span>
            <span style="font-size:9px;font-weight:700;color:#c0c5d8;">Score ${p.score}</span>
          </div>
          <div style="font-size:9px;color:#8892a4;margin-top:3px;">${p.signal} · Equity ${p.equity}</div>
        </div>`,
        { sticky: true, opacity: 1, className: "genilead-tooltip", direction: "top", offset: L.point(0, -6) }
      );

      marker.on("click", () => propsRef.current.onPropertyClick?.(p));
      marker.addTo(group);
    });
  }

  // Re-render pins when properties change (real data will arrive async later)
  useEffect(() => {
    renderPins();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  // ── Zone renderer — selected / compared only (unchanged from v2) ───────────
  function renderZones() {
    const map   = mapRef.current;
    const group = zoneLayerRef.current;
    const data  = geojsonRef.current;
    if (!map || !group || !data) return;

    const { zips, layer, selectedZip, compareList, compareMode } = propsRef.current;
    group.clearLayers();

    const visible = new Set<string>(compareList);
    if (selectedZip) visible.add(selectedZip);

    data.features.forEach((feature: any) => {
      const zip = feature.properties.zip as string;
      if (!visible.has(zip)) return;

      const zipData    = zips[zip];
      const cmpIdx     = compareList.indexOf(zip);
      const isSelected = zip === selectedZip && !compareMode;

      let borderColor = "rgba(255,255,255,0.6)";
      let fillColor   = "#3b82f6";

      if (cmpIdx !== -1) {
        borderColor = SLOT_COLORS[cmpIdx];
        fillColor   = SLOT_COLORS[cmpIdx];
      } else if (zipData) {
        const score = zipData.topScore[layer];
        borderColor = isSelected ? TIER_COLOR[zipData.tier] : scoreToColor(score);
        fillColor   = scoreToColor(score);
      }

      const zone = L.geoJSON(feature, {
        style: {
          color:       borderColor,
          weight:      isSelected ? 3 : 2.5,
          opacity:     1,
          fillColor,
          fillOpacity: 0.10,
        },
      });

      const city = feature.properties.city as string;
      zone.bindTooltip(
        `<div style="background:#13151b;border:1px solid rgba(255,255,255,0.18);border-radius:6px;padding:6px 10px;font-family:Inter,sans-serif;">
          <div style="font-size:12px;font-weight:800;color:#e8ecf8;">${zip}</div>
          <div style="font-size:10px;color:#8892a4;margin-top:1px;">${city}</div>
          ${zipData ? `<div style="font-size:10px;color:${TIER_COLOR[zipData.tier]};margin-top:3px;font-weight:700;">${zipData.tier.toUpperCase()} · ${zipData.leads} leads</div>` : ""}
        </div>`,
        { sticky: true, opacity: 1, className: "genilead-tooltip" }
      );

      zone.on("click", () => propsRef.current.onZipClick(zip));
      zone.addTo(group);
    });
  }

  useEffect(() => {
    renderZones();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selectedZip, compareList, compareMode]);

  // ── Search → select + fly (unchanged from v2) ──────────────────────────────
  useEffect(() => {
    const map  = mapRef.current;
    const data = geojsonRef.current;
    if (!map || !data || !searchQuery.trim()) return;

    const q = searchQuery.trim().toLowerCase();
    const match = data.features.find((f: any) => {
      const zip  = f.properties.zip as string;
      const city = (f.properties.city as string).toLowerCase();
      return zip === q || zip.startsWith(q) || city.includes(q);
    });

    if (match) {
      const zip = match.properties.zip as string;
      propsRef.current.onZipClick(zip);
      const bounds = L.geoJSON(match).getBounds();
      map.flyToBounds(bounds, { padding: [70, 70], duration: 0.8, maxZoom: 13 });
      lastFlownRef.current = zip;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Fly to selected ZIP from sidebar (unchanged from v2) ───────────────────
  useEffect(() => {
    const map  = mapRef.current;
    const data = geojsonRef.current;
    if (!map || !data || !selectedZip) return;
    if (lastFlownRef.current === selectedZip) return;

    const match = data.features.find((f: any) => f.properties.zip === selectedZip);
    if (match) {
      const bounds = L.geoJSON(match).getBounds();
      map.flyToBounds(bounds, { padding: [80, 80], duration: 0.6, maxZoom: 13 });
      lastFlownRef.current = selectedZip;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZip]);

  return (
    <>
      <style>{`
        .genilead-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .genilead-tooltip::before { display: none !important; }
        .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.12) !important; background: #13151b !important; border-radius: 6px !important; overflow: hidden; }
        .leaflet-control-zoom a { background: #13151b !important; color: rgba(255,255,255,0.65) !important; border-bottom-color: rgba(255,255,255,0.08) !important; font-size: 16px !important; }
        .leaflet-control-zoom a:hover { background: #1e2130 !important; color: #fff !important; }
      `}</style>
      <div
        ref={containerRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
    </>
  );
}