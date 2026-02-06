// Type declarations for modules without @types packages

declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson'
  
  function shpjs(buffer: ArrayBuffer): Promise<FeatureCollection>
  export default shpjs
}

declare module '@tmcw/togeojson' {
  import type { FeatureCollection } from 'geojson'
  export function kml(doc: Document): FeatureCollection
  export function gpx(doc: Document): FeatureCollection
}

declare module 'jszip' {
  interface JSZipFile {
    async(type: 'string' | 'arraybuffer' | 'blob'): Promise<any>
  }
  interface JSZip {
    loadAsync(data: any): Promise<JSZip>
    files: { [key: string]: JSZipFile }
  }
  const JSZip: {
    new (): JSZip
    loadAsync(data: any): Promise<JSZip>
  }
  export default JSZip
}
