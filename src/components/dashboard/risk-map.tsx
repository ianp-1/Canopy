'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from 'react'
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/mapbox'
import { Card } from '@/components/ui/card'
import type { FeatureCollection, Geometry } from 'geojson'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

type RiskMapProps = {
  policies: Array<{
    id: string
    region: string
    coverageAmount: any
    status: any
    geometry?: any | Geometry // JSON from database
    coordinates?: any // JSON from database
  }>
}

export function RiskMap({ policies }: RiskMapProps) {
  const [popupInfo, setPopupInfo] = useState<Record<string, any> | null>(null)

  // Debug logging
  console.log('RiskMap Policies:', policies.length, policies[0])

  // Convert policies to GeoJSON FeatureCollection for Polygons
  const geoJsonData: FeatureCollection = useMemo(() => {
    const features = policies
      .filter(p => p.geometry)
      .map(p => {
        const coverage = Number(p.coverageAmount) || 0;
        let riskLevel = 'Low';
        if (coverage > 100000) riskLevel = 'High';
        else if (coverage > 50000) riskLevel = 'Medium';

        return {
            type: 'Feature',
            geometry: p.geometry,
            properties: {
                id: p.id,
                region: p.region,
                coverage: coverage,
                risk: riskLevel,
                status: p.status,
                type: 'polygon'
            }
        }
      })

    return {
      type: 'FeatureCollection',
      features: features as any[]
    }
  }, [policies])

  // Convert policies to GeoJSON FeatureCollection for Points (Pins)
  const pointData: FeatureCollection = useMemo(() => {
    const features = policies
      .filter(p => {
        const hasCoords = !!p.coordinates;
        if (!hasCoords) console.log('Missing coords for policy:', p.id);
        return hasCoords;
      })
      .map(p => {
        const coverage = Number(p.coverageAmount) || 0;
        let riskLevel = 'Low';
        if (coverage > 100000) riskLevel = 'High';
        else if (coverage > 50000) riskLevel = 'Medium';
        
        // Helper to safely get lat/lng
        let lat = 0;
        let lng = 0;
        const c = p.coordinates as any;

        if (Array.isArray(c) && c.length >= 2) {
            lng = Number(c[0]); // GeoJSON usually [lng, lat]
            lat = Number(c[1]);
            // If they are mistakenly [lat, lng], simple heuristic: lat is usually between -90/90.
        } else if (typeof c === 'object' && c !== null) {
            lat = Number(c.lat || c.latitude || 0);
            lng = Number(c.lng || c.lon || c.longitude || 0);
        }

        // Validate
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
             console.warn('Invalid coordinates for policy', p.id, p.coordinates);
             return null; // Filter out later
        }

        // Debug log for valid features
        console.log(`[RiskMap] Pin generated: ${p.region} at [${lng}, ${lat}] Risk: ${riskLevel}`);

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            properties: {
                id: p.id,
                region: p.region,
                coverage: coverage,
                risk: riskLevel,
                status: p.status,
                type: 'point'
            }
        }
      })
      .filter(Boolean)

    return {
        type: 'FeatureCollection',
        features: features as any[]
    }
  }, [policies])


  const layerStyle = {
    id: 'data',
    type: 'fill',
    paint: {
      'fill-color': [
        'match',
        ['get', 'risk'],
        'High', '#ef4444', // red
        'Medium', '#f97316', // orange
        'Low', '#10b981', // green
        '#6b7280' // gray default
      ],
      'fill-opacity': 0.4
    }
  }

  const lineStyle = {
    id: 'outline',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1
    }
  }

  const pointStyle = {
      id: 'points',
      type: 'circle',
      paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'risk'],
            'High', '#ef4444', // red
            'Medium', '#f97316', // orange
            'Low', '#10b981', // green
            '#6b7280' // gray default
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
      }
  }

  if (!MAPBOX_TOKEN) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted/20 min-h-[400px]">
        <div className="text-center p-6">
            <p className="font-semibold text-muted-foreground mb-2">Mapbox Token Required</p>
            <p className="text-xs text-muted-foreground/80">Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env file to enable the risk map.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden relative rounded-xl">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -98.5,
          latitude: 39.8,
          zoom: 3
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onClick={() => {
            // Keep click for mobile or persistent view if needed, 
            // but user specifically asked for hover. 
            // We can keep both or just hover.
            // Let's allow click to "lock" it or just do nothing if hover covers it.
            // For now, I'll update the hover logic below and keep click as fallback.
        }}
        onMouseEnter={(e) => {
            const feature = e.features?.[0]
            if (feature) {
                // Change cursor to pointer
                e.target.getCanvas().style.cursor = 'pointer'
                
                const { properties } = feature;
                setPopupInfo({
                    longitude: e.lngLat.lng,
                    latitude: e.lngLat.lat,
                    ...properties
                })
            }
        }}
        onMouseLeave={(e) => {
            // Reset cursor
            e.target.getCanvas().style.cursor = ''
            setPopupInfo(null)
        }}
        interactiveLayerIds={['data', 'points']}
      >
        <NavigationControl position="top-right" />
        
        {/* Polygons (Fill) */}
        <Source id="policies-source" type="geojson" data={geoJsonData}>
          <Layer {...layerStyle as any} />
          <Layer {...lineStyle as any} />
        </Source>

        {/* Points/Pins */}
        <Source id="points-source" type="geojson" data={pointData}>
            <Layer {...pointStyle as any} />
        </Source>

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={false}
            className="pointer-events-none" // Prevent popup from flickering on hover
          >
            <div className="p-2 space-y-1 min-w-[150px]">
              <p className="font-bold text-sm mb-1">{popupInfo.region}</p>
              <div className="text-xs space-y-1">
                 <p>Risk: <span className={`font-semibold ${popupInfo.risk === 'High' ? 'text-red-600' : popupInfo.risk === 'Medium' ? 'text-orange-600' : 'text-green-600'}`}>{popupInfo.risk}</span></p>
                 <p>Coverage: {Number(popupInfo.coverage).toLocaleString()} XRP</p>
              </div>
            </div>
          </Popup>
        )}
      </Map> 
      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg border text-xs space-y-2 z-10">
         <p className="font-semibold mb-1 border-b pb-1">Risk Exposure</p>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> High ({'>'}100k XRP)</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div> Medium ({'>'}50k XRP)</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Low ({'<='}50k XRP)</div>
      </div>
    </div>
  )
}
