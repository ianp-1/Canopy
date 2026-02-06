'use client'

import { useState } from 'react'
import { updateUserRole, type UserListItem } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Users, Shield, ShieldCheck, User } from 'lucide-react'

const ROLE_CONFIG = {
  USER: { label: 'User', icon: User, color: 'bg-gray-100 text-gray-700' },
  INSURER: { label: 'Insurer', icon: Shield, color: 'bg-blue-100 text-blue-700' },
  ADMIN: { label: 'Admin', icon: ShieldCheck, color: 'bg-purple-100 text-purple-700' },
} as const

type UserRole = keyof typeof ROLE_CONFIG

interface UserManagementTableProps {
  initialUsers: UserListItem[]
  totalUsers: number
}

export function UserManagementTable({ initialUsers, totalUsers }: UserManagementTableProps) {
  const [users, setUsers] = useState<UserListItem[]>(initialUsers)
  const [updating, setUpdating] = useState<string | null>(null)

  // Sort users by created date desc
  const sortedUsers = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdating(userId)
    try {
      const result = await updateUserRole(userId, newRole)
      if (result.success) {
        setUsers(users.map(u => 
          u.id === userId ? { ...u, role: newRole } : u
        ))
      } else {
        console.error('Failed to update role:', result.error)
        // Ideally add toast here
      }
    } catch (error) {
      console.error('Failed to update role:', error)
    } finally {
      setUpdating(null)
    }
  }

  // Calculate stats dynamically from current state
  const insurerCount = users.filter(u => u.role === 'INSURER').length
  const adminCount = users.filter(u => u.role === 'ADMIN').length

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
        />
        <StatCard
          title="Insurers"
          value={insurerCount}
          icon={Shield}
        />
        <StatCard
          title="Admins"
          value={adminCount}
          icon={ShieldCheck}
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage user roles. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => {
                const roleConfig = ROLE_CONFIG[user.role as UserRole] || ROLE_CONFIG.USER
                const Icon = roleConfig.icon

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.email || 'No email'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.walletAddress 
                        ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                        : '—'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge className={`${roleConfig.color} border-none gap-1`}>
                        <Icon className="h-3 w-3" />
                        {roleConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">User</SelectItem>
                          <SelectItem value="INSURER">Insurer</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-full">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
