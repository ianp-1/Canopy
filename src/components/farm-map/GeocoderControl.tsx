'use client'

import { useControl } from 'react-map-gl/mapbox'
import MapboxGeocoder, { type GeocoderOptions } from '@mapbox/mapbox-gl-geocoder'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

type GeocoderControlProps = Omit<GeocoderOptions, 'accessToken'> & {
  mapboxAccessToken: string
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  onLoading?: (e: any) => void
  onResults?: (e: any) => void
  onResult?: (e: any) => void
  onError?: (e: any) => void
}

export function GeocoderControl(props: GeocoderControlProps) {
  const {
    mapboxAccessToken,
    position = 'top-right',
    onLoading,
    onResults,
    onResult,
    onError,
    ...options
  } = props

  const geocoder = useControl<any>(
    () => {
      const ctrl = new MapboxGeocoder({
        ...options,
        accessToken: mapboxAccessToken,
        marker: false,
        collapsed: true,
      })

      if (onLoading) ctrl.on('loading', onLoading)
      if (onResults) ctrl.on('results', onResults)
      if (onResult) ctrl.on('result', onResult)
      if (onError) ctrl.on('error', onError)

      return ctrl
    },
    {
      position: position,
    }
  )

  return null
}
