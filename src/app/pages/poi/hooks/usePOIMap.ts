import { useRef, useEffect, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMarker } from '../../../lib/poi-api';

/* ── Hook ───────────────────────────────────────── */

interface UsePOIMapOptions {
  markers: MapMarker[];
  onSelectPoi: (marker: MapMarker) => void;
  onMapClick?: (lngLat: { lat: number; lng: number }) => void;
}

export function usePOIMap({ markers, onSelectPoi, onMapClick }: UsePOIMapOptions) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const dragMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [dragCoords, setDragCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Keep click handler ref current
  onMapClickRef.current = onMapClick;

  /* ── Init ─────────────────────────────────────── */

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [126.05, 9.85],
      zoom: 11,
      trackResize: true,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    const resizeObserver = new ResizeObserver(() => map.current?.resize());
    resizeObserver.observe(mapContainer.current);

    map.current.on('load', () => {
      setMapLoaded(true);
      setTimeout(() => map.current?.resize(), 100);
    });

    // Forward map clicks
    map.current.on('click', (e: maplibregl.MapMouseEvent) => {
      onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    return () => {
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, []);

  /* ── Markers ──────────────────────────────────── */

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    markers.forEach(mk => {
      const lng = Number(mk.centerLng);
      const lat = Number(mk.centerLat);
      if (isNaN(lng) || isNaN(lat)) return;

      const el = document.createElement('div');
      const color = !mk.isActive ? '#9ca3af' : mk.isVerified ? '#1d1d1f' : '#f59e0b';
      const ring = !mk.isActive ? 'rgba(156,163,175,0.3)' : mk.isVerified ? 'rgba(29,29,31,0.15)' : 'rgba(245,158,11,0.3)';
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 0 0 2px ${ring}, 0 2px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        ${!mk.isActive ? 'opacity: 0.6;' : ''}
      `;
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `POI: ${mk.name}`);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectPoi(mk);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [markers, mapLoaded, onSelectPoi]);

  /* ── Fly to ───────────────────────────────────── */

  const flyTo = useCallback((lat: number, lng: number, zoom = 15) => {
    if (!map.current || isNaN(lat) || isNaN(lng)) return;
    map.current.flyTo({ center: [lng, lat], zoom, duration: 800 });
  }, []);

  /* ── Cursor ───────────────────────────────────── */

  const setCrosshair = useCallback((on: boolean) => {
    if (!map.current) return;
    try { map.current.getCanvas().style.cursor = on ? 'crosshair' : ''; } catch { /* noop */ }
  }, []);

  /* ── Draggable anchor marker ──────────────────── */

  const showDraggableMarker = useCallback((lat: number, lng: number) => {
    if (!map.current) return;

    // Remove existing
    if (dragMarkerRef.current) {
      dragMarkerRef.current.remove();
      dragMarkerRef.current = null;
    }

    // Create styled element
    const el = document.createElement('div');
    el.style.cssText = `
      width: 36px; height: 36px; border-radius: 50%;
      background: #3b82f6;
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.3);
      cursor: grab;
      display: flex; align-items: center; justify-content: center;
      transition: box-shadow 0.15s;
    `;
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map.current);

    // Set initial coords
    setDragCoords({ lat, lng });

    // Listen to drag events
    marker.on('drag', () => {
      const lngLat = marker.getLngLat();
      setDragCoords({ lat: lngLat.lat, lng: lngLat.lng });
    });

    marker.on('dragstart', () => {
      el.style.cursor = 'grabbing';
      el.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.4), 0 8px 20px rgba(0,0,0,0.35)';
    });

    marker.on('dragend', () => {
      el.style.cursor = 'grab';
      el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.3)';
    });

    dragMarkerRef.current = marker;

    // Fly near it
    map.current.flyTo({ center: [lng, lat], zoom: Math.max(map.current.getZoom(), 16), duration: 600 });
  }, []);

  const hideDraggableMarker = useCallback(() => {
    if (dragMarkerRef.current) {
      dragMarkerRef.current.remove();
      dragMarkerRef.current = null;
    }
    setDragCoords(null);
  }, []);

  return { mapContainer, mapLoaded, flyTo, setCrosshair, showDraggableMarker, hideDraggableMarker, dragCoords };
}
