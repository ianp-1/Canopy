import { Card, CardContent } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="p-8 space-y-8 font-sans h-full flex flex-col animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-gray-100 rounded" />
          <div className="h-10 w-28 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Status cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="border-none shadow-sm bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-gray-200 rounded-full" />
                  <div className="h-5 w-24 bg-gray-200 rounded" />
                </div>
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
              <div className="text-right space-y-2">
                <div className="h-5 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Terminal skeleton */}
      <Card className="flex-1 bg-[#0F172A] border-none shadow-2xl overflow-hidden">
        <div className="bg-[#1E293B] px-4 py-2 flex items-center justify-between border-b border-[#334155]">
          <div className="h-4 w-48 bg-slate-700 rounded" />
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 w-16 bg-slate-700/50 rounded" />
              <div className="h-4 w-12 bg-slate-700/50 rounded" />
              <div className="h-4 bg-slate-700/30 rounded flex-1" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
