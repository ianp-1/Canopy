'use client'

import { useState, useEffect } from 'react'
import { getAllPolicies } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Download } from 'lucide-react'
import Link from 'next/link'

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ totalCoverage: 0, totalPremium: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  useEffect(() => {
    loadPolicies()
  }, [page, search, statusFilter])

  async function loadPolicies() {
    setLoading(true)
    try {
      const data = await getAllPolicies(page, 20, search, statusFilter)
      setPolicies(data.policies)
      setTotal(data.total)
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to load policies:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`
    return val.toString()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Policy Administration</h2>
          <p className="text-muted-foreground mr-4">
            Total active value: {formatCurrency(stats.totalCoverage)} XRP
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Policy ID or User Email..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CLAIMED">Claimed</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
           <CardTitle>Policies ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Coverage (XRP)</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No policies found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-mono text-xs">
                        {policy.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{policy.user?.email || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {policy.user?.walletAddress ? 
                              `${policy.user.walletAddress.slice(0, 4)}...${policy.user.walletAddress.slice(-4)}` : 
                              'No Wallet'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          policy.status === 'ACTIVE' ? 'secondary' : // green-ish usually
                          policy.status === 'CLAIMED' ? 'destructive' : 
                          'outline'
                        }>
                          {policy.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(policy.coverageAmount))}</TableCell>
                      <TableCell>{formatCurrency(Number(policy.premiumAmount))}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(policy.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/policy/${policy.id}`}>
                           <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Pagination Controls could go here */}
    </div>
  )
}
