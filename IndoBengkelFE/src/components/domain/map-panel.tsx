"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { MapMarker } from "./leaflet-map";

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-56 items-center justify-center rounded-card border border-line bg-surface2">
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
    </div>
  ),
});

export function MapPanel({
  center,
  zoom,
  markers,
  onMapClick,
  interactive = true,
  className,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <LeafletMap
      center={center}
      zoom={zoom}
      markers={markers}
      onMapClick={onMapClick}
      interactive={interactive}
      className={className}
    />
  );
}
