import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
           <Skeleton className="h-8 w-64 rounded-full" />
           <Skeleton className="h-4 w-48 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Weather Widget Skeleton */}
         <div className="lg:col-span-2">
            <Card className="border-none shadow-md h-[250px] relative overflow-hidden">
               <CardHeader className="flex flex-row justify-between">
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
               </CardHeader>
               <CardContent className="flex items-center gap-6 mt-8">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="space-y-2">
                     <Skeleton className="h-12 w-32 rounded-lg" />
                     <Skeleton className="h-4 w-24 rounded-full" />
                  </div>
               </CardContent>
            </Card>
         </div>
         <Skeleton className="h-[250px] w-full rounded-2xl" />
      </div>

      <div className="space-y-6">
         <div className="flex justify-between">
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
               <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
            ))}
         </div>
      </div>
    </div>
  )
}
