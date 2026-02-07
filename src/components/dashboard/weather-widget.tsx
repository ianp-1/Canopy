import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CloudRain, Sun, Droplets, Wind, MapPin } from "lucide-react"

interface WeatherWidgetProps {
  weather?: {
    temp?: number
    humidity?: number
    wind?: number
    precip?: number
    condition?: string
  }
  location?: string
}

export function WeatherWidget({ weather, location }: WeatherWidgetProps) {
  const temp = weather?.temp ?? '--'
  const humidity = weather?.humidity ?? '--'
  const wind = weather?.wind ?? '--'
  const precip = weather?.precip ?? '--'
  const condition = weather?.condition ?? 'No Data'

  return (
    <Card className="col-span-full border-none shadow-md bg-white overflow-hidden relative">
      <div className="absolute top-0 right-0 p-32 bg-secondary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      
      <CardHeader className="flex flex-row items-center justify-between pb-2 z-10 relative">
        <div className="flex flex-col">
          <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
            Local Weather
            {location && <Badge variant="outline" className="text-xs font-normal"><MapPin className="h-3 w-3 mr-1" /> {location}</Badge>}
          </CardTitle>
        </div>
        <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-primary/20 text-primary">
          <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse" />
          Live Oracle
        </Badge>
      </CardHeader>
      
      <CardContent className="z-10 relative">
        <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-6">
          
          {/* Main Temp */}
          <div className="flex items-center gap-4">
             <div className="relative">
                <Sun className="h-20 w-20 text-yellow-500 fill-yellow-500 animate-[spin_10s_linear_infinite]" />
                <CloudRain className="h-12 w-12 text-blue-500 fill-blue-500 absolute -bottom-2 -right-2" />
             </div>
             <div>
                <div className="text-6xl font-bold font-mono tracking-tighter text-foreground">
                   {temp}°
                </div>
                <p className="text-muted-foreground font-medium">{condition}</p>
             </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-8 w-full md:w-auto">
             <div className="space-y-1">
                <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider">
                   <Droplets className="h-3 w-3 mr-1" /> Humidity
                </div>
                <div className="text-2xl font-bold font-mono">{humidity}%</div>
             </div>
             <div className="space-y-1">
                <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider">
                   <Wind className="h-3 w-3 mr-1" /> Wind
                </div>
                <div className="text-2xl font-bold font-mono">{wind} mph</div>
             </div>
             <div className="space-y-1">
                <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider">
                   <CloudRain className="h-3 w-3 mr-1" /> Precip
                </div>
                <div className="text-2xl font-bold font-mono text-primary">{precip}"</div>
             </div>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}
