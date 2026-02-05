import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Hidden on mobile, typically controlled by a sheet/drawer for mobile but keeping simple for now */}
      <aside className="hidden lg:block w-72 bg-secondary/20 border-r border-border/50 sticky top-0 h-screen">
        <DashboardNav />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 lg:p-12 overflow-auto">
        {children}
      </main>
    </div>
  );
}
