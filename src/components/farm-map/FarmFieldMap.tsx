'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Map, { NavigationControl, FullscreenControl, type MapRef } from 'react-map-gl/mapbox'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'
import type { FieldData, FieldFeature } from '@/types/geo'
import { FileImport } from '@/components/farm-map/FileImport'
import { GeocoderControl } from './GeocoderControl'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

interface FarmFieldMapProps {
  onFieldChange?: (field: FieldData | null) => void
  initialGeometry?: FieldData['geometry']
  className?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export function FarmFieldMap({ onFieldChange, initialGeometry, className }: FarmFieldMapProps) {
  const mapRef = useRef<MapRef>(null)
  const drawRef = useRef<MapboxDraw | null>(null)
  const [fieldData, setFieldData] = useState<FieldData | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Calculate area from polygon
  const calculateArea = useCallback((feature: FieldFeature): { hectares: number; acres: number } => {
    const areaM2 = turf.area(feature)
    const hectares = areaM2 / 10000
    const acres = hectares * 2.47105
    return { hectares: Math.round(hectares * 100) / 100, acres: Math.round(acres * 100) / 100 }
  }, [])

  // Handle draw events
  const updateField = useCallback(() => {
    if (!drawRef.current) return
    
    const data = drawRef.current.getAll()
    if (data.features.length === 0) {
      setFieldData(null)
      onFieldChange?.(null)
      return
    }

    // Get the latest polygon
    const feature = data.features[data.features.length - 1] as FieldFeature
    if (feature.geometry.type !== 'Polygon') return

    const { hectares, acres } = calculateArea(feature)
    const newFieldData: FieldData = {
      id: String(feature.id),
      name: 'My Field',
      geometry: feature.geometry,
      areaHectares: hectares,
      areaAcres: acres,
    }

    setFieldData(newFieldData)
    onFieldChange?.(newFieldData)
  }, [calculateArea, onFieldChange])

  // Initialize draw control
  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'simple_select',
    })

    map.addControl(draw)
    drawRef.current = draw

    // Add initial geometry if provided
    if (initialGeometry) {
      draw.add({
        type: 'Feature',
        geometry: initialGeometry,
        properties: {},
      })
      updateField()
    }

    map.on('draw.create', updateField)
    map.on('draw.update', updateField)
    map.on('draw.delete', updateField)

    setMapLoaded(true)
  }, [initialGeometry, updateField])

  // Handle file import
  const handleFileImport = useCallback((geometry: FieldData['geometry']) => {
    if (!drawRef.current) return

    // Clear existing drawings
    drawRef.current.deleteAll()

    // Add imported geometry
    drawRef.current.add({
      type: 'Feature',
      geometry,
      properties: {},
    })

    updateField()

    // Fit map to imported geometry
    const map = mapRef.current?.getMap()
    if (map) {
      const bbox = turf.bbox({ type: 'Feature', geometry, properties: {} })
      map.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: 50, duration: 1000 }
      )
    }
  }, [updateField])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-xl p-6 text-center ${className}`}>
        <p className="text-amber-800 font-medium">Mapbox API Key Required</p>
        <p className="text-amber-600 text-sm mt-1">
          Add <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to your .env.local
        </p>
      </div>
    )
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border ${className}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -93.5,
          latitude: 42.0,
          zoom: 5,
        }}
        style={{ width: '100%', height: '100%', minHeight: 400 }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onLoad={onMapLoad}
      >
        <NavigationControl position="top-right" />
        <FullscreenControl position="top-right" />
        <GeocoderControl 
          mapboxAccessToken={MAPBOX_TOKEN} 
          position="top-right"
          placeholder="Search for your farm address..."
        />
      </Map>

      {/* File Import Overlay */}
      {mapLoaded && (
        <FileImport onImport={handleFileImport} className="absolute top-3 left-3" />
      )}

      {/* Area Display */}
      {fieldData && (
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Field Area</div>
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold text-primary">{fieldData.areaHectares}</span>
            <span className="text-sm text-muted-foreground">ha</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-lg font-semibold">{fieldData.areaAcres}</span>
            <span className="text-sm text-muted-foreground">acres</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!fieldData && mapLoaded && (
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border">
          <p className="text-sm text-muted-foreground">
            Click the polygon tool <span className="inline-block w-4 h-4 bg-gray-200 rounded align-middle mx-1" /> to draw your field boundaries, then press enter.
          </p>
        </div>
      )}
    </div>
  )
}
