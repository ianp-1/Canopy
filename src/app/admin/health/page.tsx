'use client'

import { useState, useEffect } from 'react'
import { getSystemHealth, getOracleLogs, SystemHealth } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Activity, AlertTriangle, CheckCircle, Server } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function OracleHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadData()
  }, [page])

  async function loadData() {
    setLoading(true)
    try {
      const [healthData, logsData] = await Promise.all([
        getSystemHealth(),
        getOracleLogs(page, 20)
      ])
      setHealth(healthData)
      setLogs(logsData.logs)
      setTotalPages(logsData.pagination.pages)
    } catch (error) {
      console.error('Failed to load health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'PAYOUT_SUCCESS': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
      case 'PAYOUT_FAILED': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
      case 'CHECK_TRIGGERED': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
      case 'ESCROW_EXPIRED': return 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
      default: return 'bg-gray-500/10 text-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Oracle System Health</h2>
          <p className="text-muted-foreground">
            Monitor automated data fetching and contract execution
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Health Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className={cn("h-4 w-4", health?.status === 'operational' ? "text-green-500" : "text-red-500")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{health?.status || '...'}</div>
            <p className="text-xs text-muted-foreground">
              {health?.lastSync ? `Last Sync: ${new Date(health.lastSync).toLocaleTimeString()}` : 'No recent sync'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Activity</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.totalActions24h || 0}</div>
            <p className="text-xs text-muted-foreground">
              Oracle actions triggered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", (health?.recentErrors || 0) > 0 ? "text-red-500" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.recentErrors || 0}</div>
            <p className="text-xs text-muted-foreground">
              Failed executions in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Nodes</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.activeNodes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Data providers online
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Oracle Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Consensus</TableHead>
                <TableHead>Result / Error</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Loading logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/policy/${log.policyId}`} className="hover:underline font-mono text-xs">
                        {log.policyId.slice(0, 8)}...
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {log.policy?.user?.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.consensusScore ? `${(log.consensusScore * 100).toFixed(0)}%` : '-'}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {log.errorMessage ? (
                        <span className="text-red-500 text-xs flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {log.errorMessage}
                        </span>
                      ) : log.txHash ? (
                        <span className="font-mono text-xs text-blue-500">
                          Tx: {log.txHash.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                       {/* JSON view could go here in a dialog */}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Simple Pagination */}
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
