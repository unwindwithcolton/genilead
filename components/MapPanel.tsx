// components/MapPanel.tsx
// Real Leaflet map — Kankakee County ZIPs (v2)
// v2 changes:
//   - GeoJSON fetched ONCE and cached (fixes lag from re-fetching on every click)
//   - Zones hidden by default — only visible when searched, selected, or compared
//   - Brighter visuals: no tile darkening, crisp borders, subtle fills
//   - Canvas renderer for smoother pan/zoom

"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

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
  zips:        Record<string, ZipData>;
  layer:       Layer;
  selectedZip: string;
  compareList: string[];
  compareMode: boolean;
  searchQuery: string;
  onZipClick:  (zip: string) => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<Tier, string> = {
  hot:    "#f87171",
  warm:   "#fbbf24",
  nurture:"#60a5fa",
};

const SLOT_COLORS = ["#3b82f6", "#a855f7", "#10b981"] as const;

function scoreToColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#3b82f6";
  return "#6b7094";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapPanel({
  zips, layer, selectedZip, compareList, compareMode, searchQuery, onZipClick,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const geojsonRef   = useRef<any>(null);              // cached GeoJSON data — fetched once
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const lastFlownRef = useRef<string>("");             // avoid re-flying to the same ZIP

  // Keep latest props in refs so the click handler never goes stale
  const propsRef = useRef({ zips, layer, selectedZip, compareList, compareMode, onZipClick });
  propsRef.current = { zips, layer, selectedZip, compareList, compareMode, onZipClick };

  // ── Bootstrap map + fetch GeoJSON ONCE ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center:             [41.12, -87.86],     // northern county — Kankakee/Bourbonnais/Bradley
      zoom:               11,
      zoomControl:        false,
      attributionControl: false,
      renderer:           L.canvas(),          // canvas is much smoother than SVG for polygons
      zoomAnimation:      true,
      fadeAnimation:      true,
    });

    // CARTO Dark Matter — no extra CSS filter this time, keep it bright & readable
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      updateWhenIdle: false,
      keepBuffer: 4,                            // pre-load surrounding tiles = smoother panning
    }).addTo(map);

    L.control.attribution({ position: "bottomleft", prefix: false })
      .addTo(map)
      .setPrefix('<span style="font-size:9px;opacity:0.35">© CARTO © OpenStreetMap</span>');

    L.control.zoom({ position: "bottomright" }).addTo(map);

    zoneLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Fetch the GeoJSON exactly once and cache it
    fetch("/kankakee-zips.json")
      .then(r => r.json())
      .then(data => {
        geojsonRef.current = data;
        renderZones();    // initial render (will be empty until something is selected/searched)
      })
      .catch(err => console.error("Failed to load kankakee-zips.json:", err));

    return () => {
      map.remove();
      mapRef.current = null;
      zoneLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Zone renderer — draws ONLY visible zones (selected / compared) ─────────
  function renderZones() {
    const map   = mapRef.current;
    const group = zoneLayerRef.current;
    const data  = geojsonRef.current;
    if (!map || !group || !data) return;

    const { zips, layer, selectedZip, compareList, compareMode, onZipClick } = propsRef.current;

    group.clearLayers();

    // Visible = selected ZIP + anything in the compare list. Nothing else.
    const visible = new Set<string>(compareList);
    if (selectedZip) visible.add(selectedZip);

    data.features.forEach((feature: any) => {
      const zip = feature.properties.zip as string;
      if (!visible.has(zip)) return;

      const zipData    = zips[zip];
      const cmpIdx     = compareList.indexOf(zip);
      const isSelected = zip === selectedZip && !compareMode;

      // Brighter, cleaner styling: strong crisp border, very light fill
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
          fillOpacity: 0.12,                    // subtle — map stays readable underneath
        },
      });

      // Tooltip
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

  // ── Re-render zones when selection/compare/layer changes (no fetch!) ──────
  useEffect(() => {
    renderZones();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selectedZip, compareList, compareMode]);

  // ── Search → find match in cached data, select + fly to it ────────────────
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
      propsRef.current.onZipClick(zip);     // select it → triggers zone render
      const bounds = L.geoJSON(match).getBounds();
      map.flyToBounds(bounds, { padding: [70, 70], duration: 0.8, maxZoom: 13 });
      lastFlownRef.current = zip;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Fly to selected ZIP (from sidebar clicks) — uses cache, no fetch ───────
  useEffect(() => {
    const map  = mapRef.current;
    const data = geojsonRef.current;
    if (!map || !data || !selectedZip) return;
    if (lastFlownRef.current === selectedZip) return;   // already there

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