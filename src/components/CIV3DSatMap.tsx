'use client';

import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

type TeamPin = {
  id: 'wakama' | 'etra' | 'mks';
  label: string;
  city: string;
  lng: number;
  lat: number;
  color: string; // css color
};

export default function CIV3DSatMap({
  onSelectTeam,
}: {
  onSelectTeam?: (teamId: TeamPin['id']) => void;
}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pins: TeamPin[] = useMemo(
    () => [
      {
        id: 'wakama',
        label: 'Wakama',
        city: 'Abidjan',
        lng: -4.0082563,
        lat: 5.3599517,
        color: '#A855F7',
      },
      {
        id: 'etra',
        label: 'ETRA',
        city: 'Bouaké',
        lng: -5.0314,
        lat: 7.6906,
        color: '#22C55E',
      },
      {
        id: 'mks',
        label: 'MKS',
        city: 'Soubré',
        lng: -6.5920,
        lat: 5.7861,
        color: '#38BDF8',
      },
    ],
    [],
  );

  useEffect(() => {
    if (mapRef.current) return;
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      // Pas de token => pas de map (on laisse le container vide, UI fallback côté page)
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-5.55, 6.60], // Côte d’Ivoire centre approx
      zoom: 5.6,
      pitch: 62,
      bearing: -18,
      antialias: true,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('style.load', async () => {
      // Terrain 3D (DEM)
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.35 });

      // Sky layer (effet “3D futuriste”)
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 7,
        },
      });

      // Markers (pulsing)
      pins.forEach((p) => {
        const el = document.createElement('div');
        el.style.width = '18px';
        el.style.height = '18px';
        el.style.borderRadius = '999px';
        el.style.background = p.color;
        el.style.boxShadow = `0 0 0 0 ${p.color}`;
        el.style.opacity = '0.95';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';

        // pulse ring
        const ring = document.createElement('div');
        ring.style.position = 'absolute';
        ring.style.left = '-14px';
        ring.style.top = '-14px';
        ring.style.width = '46px';
        ring.style.height = '46px';
        ring.style.borderRadius = '999px';
        ring.style.border = `2px solid ${p.color}`;
        ring.style.opacity = '0.65';
        ring.style.animation = 'wakamaPulse 1.6s ease-out infinite';
        el.appendChild(ring);

        const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(map);

        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
          `<div style="font-family: ui-sans-serif; font-size:12px;">
            <div style="font-weight:700; margin-bottom:2px;">${p.label}</div>
            <div style="opacity:.8">${p.city} · Côte d’Ivoire</div>
            <div style="margin-top:6px; font-size:11px; opacity:.8">Click to filter LIVE</div>
          </div>`,
        );
        m.setPopup(popup);

        el.addEventListener('mouseenter', () => m.togglePopup());
        el.addEventListener('mouseleave', () => m.togglePopup());
        el.addEventListener('click', () => onSelectTeam?.(p.id));
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pins, onSelectTeam]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <style>{`
        @keyframes wakamaPulse {
          0% { transform: scale(0.35); opacity: 0.65; }
          70% { transform: scale(1); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        .mapboxgl-ctrl.mapboxgl-ctrl-group { background: rgba(10,11,26,.55); border: 1px solid rgba(255,255,255,.10); }
        .mapboxgl-ctrl button { filter: saturate(1.2); }
      `}</style>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-white/70">
            CÔTE D’IVOIRE · SATELLITE 3D
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
            Mainnet Verified
          </span>
        </div>
        <div className="text-[10px] text-white/50">Click a node to filter LIVE</div>
      </div>

      <div ref={containerRef} className="h-[420px] w-full" />

      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
          <div className="max-w-[520px] rounded-xl border border-white/10 bg-[#0A0B1A]/80 p-4 text-center">
            <div className="text-sm font-semibold text-white">Mapbox token missing</div>
            <div className="mt-1 text-[12px] text-white/60">
              Set <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
              .env.local (and Coolify env) to enable the 3D satellite map.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}