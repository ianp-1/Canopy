import { getAllUsers } from '../actions'
import { UserManagementTable } from './user-management-table'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const data = await getAllUsers()
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">
          View and manage user roles across the platform.
        </p>
      </div>

      <UserManagementTable 
        initialUsers={data.users} 
        totalUsers={data.total} 
      />
    </div>
  )
}

