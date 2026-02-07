import { requireRole } from "@/lib/auth/role-guard"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Require ADMIN role to access this section
  await requireRole('ADMIN')

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container flex h-16 items-center px-4">
          <h1 className="text-xl font-bold">Admin Portal</h1>
        </div>
      </div>
      <main className="container py-6 px-4">
        {children}
      </main>
    </div>
  )
}
