import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Activity, Settings } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Manage users, view system health, and configure settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/users">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="p-3 bg-primary/10 rounded-full w-fit">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="mt-4">User Management</CardTitle>
              <CardDescription>
                View all users, change roles, and manage access permissions.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Card className="opacity-50">
          <CardHeader>
            <div className="p-3 bg-muted rounded-full w-fit">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">System Health</CardTitle>
            <CardDescription>
              Monitor system metrics and view logs. Coming soon.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="p-3 bg-muted rounded-full w-fit">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Settings</CardTitle>
            <CardDescription>
              Configure platform settings and preferences. Coming soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
