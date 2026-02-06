import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { UserProfileButton } from "@/components/auth/user-profile-button";

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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Dashboard Header */}
        <header className="h-16 border-b border-border/50 bg-background/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="lg:hidden font-semibold">Canopy</div>
          <div className="ml-auto flex items-center gap-4">
            <UserProfileButton />
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
