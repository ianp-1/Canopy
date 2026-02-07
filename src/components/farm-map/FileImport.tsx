'use client'

import { useCallback, useState } from 'react'
import { Upload, FileJson, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as shpjs from 'shpjs'
import { kml as toGeoJSONKml } from '@tmcw/togeojson'
import type { FieldGeometry } from '@/types/geo'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

interface FileImportProps {
  onImport: (geometry: FieldGeometry) => void
  className?: string
}

export function FileImport({ onImport, className }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extractPolygon = (geojson: FeatureCollection): FieldGeometry | null => {
    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon') {
        return feature.geometry as FieldGeometry
      }
      if (feature.geometry.type === 'MultiPolygon') {
        // Take first polygon from multipolygon
        const mp = feature.geometry as MultiPolygon
        return {
          type: 'Polygon',
          coordinates: mp.coordinates[0],
        }
      }
    }
    return null
  }

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'geojson' || ext === 'json') {
        const text = await file.text()
        const geojson = JSON.parse(text) as FeatureCollection
        const polygon = extractPolygon(geojson)
        if (!polygon) throw new Error('No polygon found in GeoJSON')
        onImport(polygon)
      } else if (ext === 'kml') {
        const text = await file.text()
        const parser = new DOMParser()
        const kmlDoc = parser.parseFromString(text, 'text/xml')
        const geojson = toGeoJSONKml(kmlDoc) as FeatureCollection
        const polygon = extractPolygon(geojson)
        if (!polygon) throw new Error('No polygon found in KML')
        onImport(polygon)
      } else if (ext === 'kmz') {
        // KMZ is a zipped KML
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(file)
        const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'))
        if (!kmlFile) throw new Error('No KML file found in KMZ')
        const kmlText = await zip.files[kmlFile].async('string')
        const parser = new DOMParser()
        const kmlDoc = parser.parseFromString(kmlText, 'text/xml')
        const geojson = toGeoJSONKml(kmlDoc) as FeatureCollection
        const polygon = extractPolygon(geojson)
        if (!polygon) throw new Error('No polygon found in KMZ')
        onImport(polygon)
      } else if (ext === 'zip') {
        // Shapefile as zip
        const buffer = await file.arrayBuffer()
        const geojson = await shpjs.default(buffer) as FeatureCollection
        const polygon = extractPolygon(geojson)
        if (!polygon) throw new Error('No polygon found in Shapefile')
        onImport(polygon)
      } else {
        throw new Error(`Unsupported file type: .${ext}`)
      }
    } catch (err) {
      console.error('File import error:', err)
      setError(err instanceof Error ? err.message : 'Failed to import file')
    } finally {
      setIsProcessing(false)
    }
  }, [onImport])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <label htmlFor="field-file-import">
          <Button
            variant="outline"
            size="sm"
            className={`cursor-pointer bg-white/90 backdrop-blur-sm ${isDragging ? 'ring-2 ring-primary' : ''}`}
            disabled={isProcessing}
            asChild
          >
            <span>
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Field
                </>
              )}
            </span>
          </Button>
        </label>
        <input
          id="field-file-import"
          type="file"
          accept=".geojson,.json,.kml,.kmz,.zip"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-2 text-xs text-white/80 bg-black/30 px-2 py-1 rounded">
        <FileJson className="w-3 h-3 inline mr-1" />
        GeoJSON, KML, Shapefile (.zip)
      </div>
    </div>
  )
}
