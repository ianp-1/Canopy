import { Card, CardContent } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="p-8 space-y-8 font-sans animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-100 rounded" />
        </div>
        <div className="flex space-x-3">
          <div className="h-10 w-32 bg-gray-100 rounded-full" />
          <div className="h-10 w-36 bg-gray-200 rounded-full" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 bg-gray-200 rounded-xl" />
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 bg-gray-100 rounded" />
                <div className="h-7 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-80 bg-gray-100 rounded" />
          </div>
          <div className="flex-1 bg-slate-50 h-full" />
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <div className="p-6 border-b border-gray-100">
            <div className="h-6 w-32 bg-gray-200 rounded" />
          </div>
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
                <div className="h-5 w-12 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
