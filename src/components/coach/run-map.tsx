"use client";

import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap, Polyline } from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import type { RunRoutePoint } from "@/components/coach/types";

// Real OpenStreetMap tile map of a run's route (live while recording + on the
// summary). Client-only: Leaflet is lazy-loaded in an effect so it never runs on
// the server. Circle markers avoid Leaflet's broken default-icon image in bundlers.
export function RunMap({
  points,
  live = false,
  className
}: {
  points: RunRoutePoint[];
  live?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const startRef = useRef<CircleMarker | null>(null);
  const endRef = useRef<CircleMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const pointsRef = useRef(points);
  pointsRef.current = points;
  const liveRef = useRef(live);
  liveRef.current = live;

  const draw = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const pts = pointsRef.current;
    if (!L || !map || !pts || pts.length === 0) return;

    const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);

    if (lineRef.current) lineRef.current.setLatLngs(latlngs);
    else lineRef.current = L.polyline(latlngs, { color: "#15803D", weight: 4, opacity: 0.9 }).addTo(map);

    const first = latlngs[0];
    const last = latlngs[latlngs.length - 1];
    if (startRef.current) startRef.current.setLatLng(first);
    else startRef.current = L.circleMarker(first, { radius: 6, color: "#fff", weight: 2, fillColor: "#15803D", fillOpacity: 1 }).addTo(map);
    if (endRef.current) endRef.current.setLatLng(last);
    else endRef.current = L.circleMarker(last, { radius: 6, color: "#fff", weight: 2, fillColor: "#F47A20", fillOpacity: 1 }).addTo(map);

    if (liveRef.current) {
      map.setView(last, Math.max(map.getZoom() ?? 0, 16), { animate: true });
    } else if (latlngs.length > 1) {
      map.fitBounds(lineRef.current.getBounds(), { padding: [24, 24] });
    } else {
      map.setView(first, 16);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!containerRef.current || mapRef.current) return;
      const mod = await import("leaflet");
      const L = (mod as { default?: typeof import("leaflet") }).default ?? mod;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
      map.setView([36.7538, 3.0588], 12); // default: Algiers, until points arrive
      mapRef.current = map;
      // Container may have just been laid out; ensure tiles fill it.
      setTimeout(() => map.invalidateSize(), 60);
      draw();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      lineRef.current = null;
      startRef.current = null;
      endRef.current = null;
    };
  }, [draw]);

  // Redraw as the route grows (live) or when a different run's points are passed.
  useEffect(() => {
    draw();
  }, [points, draw]);

  return <div ref={containerRef} className={className} style={{ minHeight: 200 }} aria-label="Run route map" />;
}
