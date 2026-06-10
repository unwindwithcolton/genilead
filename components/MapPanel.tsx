// components/MapPanel.tsx
// Real Leaflet map — Kankakee County ZIPs
// Dynamically imported in ExplorerScreen with ssr: false
// Choropleth coloring by signal layer + flyTo search + click-to-select

"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";

// ─── Types (duplicated here so this file is self-contained) ──────────────────

type Tier    = "hot" | "warm" | "nurture";
type Layer   = "equity" | "dom" | "tenure" | "delinquency";

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
  searchQuery: string;          // controlled by ExplorerScreen search input
  onZipClick:  (zip: string) => void;
}

// ─── Tier + layer colors ──────────────────────────────────────────────────────

const TIER_COLOR: Record<Tier, string> = {
  hot:    "#f87171",
  warm:   "#fbbf24",
  nurture:"#6b7094",
};

const SLOT_COLORS = ["#3b82f6", "#a855f7", "#10b981"] as const;

function scoreToColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#3b82f6";
  return "#4a5068";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapPanel({
  zips, layer, selectedZip, compareList, compareMode, searchQuery, onZipClick,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const geoLayerRef  = useRef<L.GeoJSON | null>(null);

  // ── Bootstrap the map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Fix Leaflet default icon path broken by webpack
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(containerRef.current, {
      center:        [40.82, -87.97],   // Kankakee County center
      zoom:          10,
      zoomControl:   false,
      attributionControl: false,
    });

    // CARTO Dark Matter — matches #0e1018 aesthetic, no API key needed
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19 }
    ).addTo(map);

    // Subtle attribution bottom-left
    L.control.attribution({ position: "bottomleft", prefix: false })
      .addTo(map)
      .setPrefix('<span style="font-size:9px;opacity:0.3">© CARTO © OpenStreetMap</span>');

    // Custom zoom buttons (bottom-right, styled to match app)
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Render / re-render GeoJSON layer whenever layer, selection, or compare changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old layer
    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    // Load GeoJSON
    fetch("/kankakee-zips.json")
      .then(r => r.json())
      .then(geojson => {
        const geoLayer = L.geoJSON(geojson, {
          style: (feature) => {
            if (!feature) return {};
            const zip      = feature.properties.zip as string;
            const zipData  = zips[zip];
            const cmpIdx   = compareList.indexOf(zip);
            const isSelected = zip === selectedZip && !compareMode;

            // Fill color: if we have data use score color, else dim grey
            let fillColor = "#2a2d3a";
            let fillOpacity = 0.18;
            if (zipData) {
              const score = zipData.topScore[layer];
              fillColor   = scoreToColor(score);
              fillOpacity = 0.28 + (score / 100) * 0.22; // 0.28–0.50
            }

            // Border: selected > compare slot > default
            let weight    = 1;
            let color     = "rgba(255,255,255,0.18)";
            let opacity   = 0.5;
            if (isSelected) {
              color   = zipData ? TIER_COLOR[zipData.tier] : "#fff";
              weight  = 2.5;
              opacity = 1;
              fillOpacity = Math.min(fillOpacity + 0.15, 0.65);
            } else if (cmpIdx !== -1) {
              color   = SLOT_COLORS[cmpIdx];
              weight  = 2;
              opacity = 0.9;
            }

            return { fillColor, fillOpacity, color, weight, opacity, dashArray: undefined };
          },

          onEachFeature: (feature, leafletLayer) => {
            const zip     = feature.properties.zip as string;
            const city    = feature.properties.city as string;
            const zipData = zips[zip];

            // ZIP label tooltip (always visible on hover)
            leafletLayer.bindTooltip(
              `<div style="
                background:#13151b;
                border:1px solid rgba(255,255,255,0.15);
                border-radius:6px;
                padding:6px 10px;
                font-family:Inter,sans-serif;
                pointer-events:none;
              ">
                <div style="font-size:12px;font-weight:800;color:#d4d8e8;">${zip}</div>
                <div style="font-size:10px;color:#6b7094;margin-top:1px;">${city}</div>
                ${zipData ? `<div style="font-size:10px;color:${TIER_COLOR[zipData.tier]};margin-top:3px;font-weight:700;">${zipData.tier.toUpperCase()} · ${zipData.leads} leads</div>` : ""}
              </div>`,
              { sticky: true, opacity: 1, className: "genilead-tooltip" }
            );

            // Click handler
            leafletLayer.on("click", () => onZipClick(zip));

            // Hover highlight
            leafletLayer.on("mouseover", (e) => {
              (e.target as L.Path).setStyle({ fillOpacity: 0.55, weight: 2 });
            });
            leafletLayer.on("mouseout", (e) => {
              geoLayer.resetStyle(e.target as L.Path);
            });
          },
        });

        geoLayer.addTo(map);
        geoLayerRef.current = geoLayer;
      })
      .catch(err => console.error("Failed to load kankakee-zips.json:", err));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selectedZip, compareList, compareMode]);

  // ── Fly to ZIP when search query changes ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchQuery.trim()) return;

    const q = searchQuery.trim().toLowerCase();

    fetch("/kankakee-zips.json")
      .then(r => r.json())
      .then(geojson => {
        const match = geojson.features.find((f: any) => {
          const zip  = f.properties.zip as string;
          const city = (f.properties.city as string).toLowerCase();
          return zip === q || zip.startsWith(q) || city.includes(q);
        });

        if (match) {
          const bounds = L.geoJSON(match).getBounds();
          map.flyToBounds(bounds, { padding: [60, 60], duration: 0.7, maxZoom: 13 });
          // Also select that ZIP
          onZipClick(match.properties.zip);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Fly to selected ZIP when it changes (e.g. from sidebar click) ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedZip) return;

    fetch("/kankakee-zips.json")
      .then(r => r.json())
      .then(geojson => {
        const match = geojson.features.find((f: any) => f.properties.zip === selectedZip);
        if (match) {
          const bounds = L.geoJSON(match).getBounds();
          map.flyToBounds(bounds, { padding: [80, 80], duration: 0.5, maxZoom: 13 });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZip]);

  return (
    <>
      {/* Leaflet tooltip style override — keeps it dark */}
      <style>{`
        .genilead-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .genilead-tooltip::before { display: none !important; }
        .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.12) !important; background: #13151b !important; border-radius: 6px !important; }
        .leaflet-control-zoom a { background: #13151b !important; color: rgba(255,255,255,0.6) !important; border-bottom-color: rgba(255,255,255,0.08) !important; font-size: 16px !important; }
        .leaflet-control-zoom a:hover { background: #1e2130 !important; color: #fff !important; }
        .leaflet-tile-pane { filter: brightness(0.85) saturate(0.7); }
      `}</style>
      <div
        ref={containerRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
    </>
  );
}