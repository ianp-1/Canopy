import type { Feature, Polygon, Position } from 'geojson'

export interface FieldGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface FieldFeature extends Feature<Polygon> {
  id?: string
  properties: {
    name?: string
    areaHectares?: number
    areaAcres?: number
  }
}

export interface FieldData {
  id?: string
  name: string
  geometry: FieldGeometry
  areaHectares: number
  areaAcres: number
}

export interface DrawEvent {
  features: FieldFeature[]
  type: 'draw.create' | 'draw.update' | 'draw.delete'
}
