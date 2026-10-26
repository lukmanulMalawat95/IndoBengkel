"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  active?: boolean;
  onClick?: () => void;
}

export default function LeafletMap({
  center,
  zoom = 12,
  markers = [],
  onMapClick,
  className,
  interactive = true,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  interactive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: interactive,
      attributionControl: true,
      dragging: interactive,
    }).setView([center.lat, center.lng], zoom);

    L.tileLayer(
      process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      },
    ).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on("click", (event: L.LeafletMouseEvent) => {
      clickRef.current?.(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // The map is created once; center/zoom updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach((marker) => {
      const circle = L.circleMarker([marker.lat, marker.lng], {
        radius: marker.active ? 9 : 7,
        color: marker.active ? "#C8F751" : "#8FA47E",
        weight: marker.active ? 3 : 2,
        fillColor: "#C8F751",
        fillOpacity: marker.active ? 0.95 : 0.55,
      });
      if (marker.label) {
        circle.bindTooltip(marker.label, { direction: "top", offset: [0, -8] });
      }
      circle.on("click", () => marker.onClick?.());
      circle.addTo(layer);
    });
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-56 w-full rounded-card", className)}
      aria-label="Map"
    />
  );
}
