'use client'

import { useState } from 'react'
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/mapbox'
import { Card } from '@/components/ui/card'
import type { FeatureCollection } from 'geojson'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

type RiskMapProps = {
  policies: any[] // structured from action
}

export function RiskMap({ policies }: RiskMapProps) {
  const [popupInfo, setPopupInfo] = useState<any>(null)

  // Convert policies to GeoJSON FeatureCollection
  const features = policies
    .filter(p => p.fieldGeometry && p.coordinates)
    .map(p => ({
      type: 'Feature',
      geometry: p.fieldGeometry,
      properties: {
        id: p.id,
        farmer: p.farmerName,
        crop: p.crop,
        amount: p.amount,
        risk: p.amount > 50000 ? 'High' : 'Low', // enhance logic later
        status: p.status
      }
    }))

  const geoJsonData: FeatureCollection = {
    type: 'FeatureCollection',
    features: features as any
  }

  const layerStyle = {
    id: 'data',
    type: 'fill',
    paint: {
      'fill-color': [
        'match',
        ['get', 'status'],
        'ACTIVE', '#10b981', // green
        'PENDING', '#3b82f6', // blue
        'CLAIMED', '#ef4444', // red
        '#6b7280' // gray default
      ],
      'fill-opacity': 0.6
    }
  }

  const lineStyle = {
    id: 'outline',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-width': 2
    }
  }

  if (!MAPBOX_TOKEN) {
    return (
      <Card className="h-[400px] flex items-center justify-center bg-muted/20">
        <p className="text-muted-foreground">Mapbox Token Required</p>
      </Card>
    )
  }

  return (
    <Card className="h-[500px] overflow-hidden relative border-0 shadow-lg">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -98.5,
          latitude: 39.8,
          zoom: 3
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onClick={(e) => {
            const feature = e.features?.[0]
            if (feature) {
                // handle click
            }
        }}
        interactiveLayerIds={['data']}
      >
        <NavigationControl position="top-right" />
        
        <Source id="policies-source" type="geojson" data={geoJsonData}>
          <Layer {...layerStyle as any} />
          <Layer {...lineStyle as any} />
        </Source>

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
          >
            <div className="p-2">
              <p className="font-bold">{popupInfo.farmer}</p>
              <p>{popupInfo.crop} - {popupInfo.amount} RLUSD</p>
            </div>
          </Popup>
        )}
      </Map> 
      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg border text-xs space-y-1">
         <p className="font-semibold mb-1">Legend</p>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Active</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Pending</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Claimed</div>
      </div>
    </Card>
  )
}
