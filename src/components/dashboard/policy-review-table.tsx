'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, MapPin, Loader2, Search, Eye, Filter } from 'lucide-react'
import { approvePolicy, denyPolicy } from '@/app/dashboard/insurer-actions'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { PolicyDetailModal } from '@/components/insurer/policy-detail-modal'

interface Policy {
  id: string
  farmerName: string
  region: string
  crop: string
  amount: number
  premium: number
  status: string
  requestedAt: Date
}

interface PolicyReviewTableProps {
  initialPolicies: Policy[]
}

export function PolicyReviewTable({ initialPolicies }: PolicyReviewTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [cropFilter, setCropFilter] = useState('ALL')
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()

  // Extract unique crops for the filter dropdown
  const uniqueCrops = useMemo(() => {
    const crops = new Set(initialPolicies.map(p => p.crop).filter(Boolean))
    return Array.from(crops).sort()
  }, [initialPolicies])

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    setProcessingId(id)
    try {
      await approvePolicy(id)
      router.refresh()
    } catch (error) {
      console.error('Failed to approve:', error)
      alert('Failed to approve policy')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeny = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    if (!confirm('Are you sure you want to deny this policy?')) return
    setProcessingId(id)
    try {
      await denyPolicy(id)
      router.refresh()
    } catch (error) {
      console.error('Failed to deny:', error)
      alert('Failed to deny policy')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRowClick = (policyId: string) => {
    setSelectedPolicyId(policyId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedPolicyId(null)
  }

  const filteredPolicies = useMemo(() => {
    return initialPolicies.filter(p => {
      // Text search (farmer name, region, or crop)
      const searchTerm = filter.toLowerCase()
      const matchesSearch = !filter || 
        p.farmerName.toLowerCase().includes(searchTerm) || 
        p.region.toLowerCase().includes(searchTerm) ||
        p.crop.toLowerCase().includes(searchTerm)
      
      // Status filter
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter
      
      // Crop filter
      const matchesCrop = cropFilter === 'ALL' || p.crop.toLowerCase() === cropFilter.toLowerCase()
      
      return matchesSearch && matchesStatus && matchesCrop
    })
  }, [initialPolicies, filter, statusFilter, cropFilter])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Policy Management</CardTitle>
              <CardDescription>Review pending policies and monitor active coverage. Click any row to view details.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search farmer, region, crop..." 
                  className="pl-8 w-[220px]"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="CLAIMED">Claimed</SelectItem>
                  <SelectItem value="DENIED">Denied</SelectItem>
                </SelectContent>
              </Select>
              {uniqueCrops.length > 0 && (
                <Select value={cropFilter} onValueChange={setCropFilter}>
                  <SelectTrigger className="w-[130px]">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Crop" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Crops</SelectItem>
                    {uniqueCrops.map(crop => (
                      <SelectItem key={crop} value={crop} className="capitalize">
                        {crop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 md:pl-4 font-medium text-muted-foreground">Farmer</th>
                  <th className="pb-3 font-medium text-muted-foreground">Region / Crop</th>
                  <th className="pb-3 font-medium text-muted-foreground">Coverage</th>
                  <th className="pb-3 font-medium text-muted-foreground">Premium</th>
                  <th className="pb-3 font-medium text-muted-foreground">Status</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.length === 0 ? (
                  <tr>
                     <td colSpan={6} className="py-8 text-center text-muted-foreground">
                       No policies found matching your criteria.
                     </td>
                  </tr>
                ) : (
                  filteredPolicies.map((policy) => (
                    <tr 
                      key={policy.id} 
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(policy.id)}
                    >
                      <td className="py-4 md:pl-4 font-medium">
                        {policy.farmerName}
                        <div className="text-xs text-muted-foreground font-normal">
                          {new Date(policy.requestedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                           <MapPin className="h-3 w-3 text-muted-foreground" /> {policy.region}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 capitalize">{policy.crop}</div>
                      </td>
                      <td className="py-4 font-mono">{policy.amount.toLocaleString()} RLUSD</td>
                      <td className="py-4 font-mono text-muted-foreground">{policy.premium.toLocaleString()} RLUSD</td>
                      <td className="py-4">
                        <Badge variant={
                          policy.status === 'ACTIVE' ? 'default' : 
                          policy.status === 'PENDING' ? 'secondary' : 
                          policy.status === 'CLAIMED' ? 'destructive' : 'outline'
                        }>
                          {policy.status}
                        </Badge>
                      </td>
                      <td className="py-4 text-right pr-4">
                        {policy.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button 
                               size="sm" 
                               className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700" 
                               onClick={(e) => handleApprove(policy.id, e)}
                               disabled={!!processingId}
                            >
                              {processingId === policy.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button 
                               size="sm" 
                               variant="destructive" 
                               className="h-8 w-8 p-0"
                               onClick={(e) => handleDeny(policy.id, e)}
                               disabled={!!processingId}
                            >
                               {processingId === policy.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}
                        {policy.status !== 'PENDING' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRowClick(policy.id)
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Policy Detail Modal */}
      <PolicyDetailModal
        policyId={selectedPolicyId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  )
}
