import { InsurerNav } from "@/components/insurer/insurer-nav"
import { requireRole } from "@/lib/auth/role-guard"

export default async function InsurerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Require INSURER role to access this section
  await requireRole('INSURER')

  return (
    <div className="flex h-screen w-full bg-[#E8EAE6] overflow-hidden">
       {/* Sidebar - Fixed Width */}
       <aside className="w-64 hidden md:block shadow-2xl z-20">
          <InsurerNav />
       </aside>

       {/* Main Content - Scrollable */}
       <main className="flex-1 overflow-y-auto">
          {children}
       </main>
    </div>
  )
}
