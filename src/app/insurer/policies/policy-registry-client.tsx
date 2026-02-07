"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, MoreHorizontal, CheckCircle2, AlertCircle, Clock, X, ChevronDown, MapPin, Wheat, Shield, DollarSign, Calendar, Activity, ExternalLink, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

// Policy interface with extended details
// Policy interface for UI
interface PolicyUI {
  id: string
  farmer: string
  crop: string
  coverage: string
  premium: string
  risk: string
  status: string
  lastUpdate: string
  // Extended details for modal
  region?: string
  coordinates?: { lat: number; lng: number }
  startDate?: string
  endDate?: string
  thresholdRainfall?: string
  escrowAddress?: string
  nftTokenId?: string
  oracleLastCheck?: string
  weatherCondition?: string
}

interface PolicyRegistryClientProps {
  initialPolicies: any[]
}

// Filter constants
const STATUS_OPTIONS = ["Active", "Warning", "Triggered", "PENDING", "DENIED", "CLAIMED"] as const
const CROP_OPTIONS = ["Corn", "Soy", "Wheat", "Cotton", "Unknown"] as const
const RISK_LEVELS = [
  { label: "Low (< 20%)", value: "low", max: 20 },
  { label: "Medium (20-50%)", value: "medium", min: 20, max: 50 },
  { label: "High (> 50%)", value: "high", min: 50 },
] as const

type StatusOption = typeof STATUS_OPTIONS[number]
type CropOption = typeof CROP_OPTIONS[number]
type RiskLevel = typeof RISK_LEVELS[number]["value"]

interface Filters {
  statuses: StatusOption[]
  crops: CropOption[]
  riskLevels: RiskLevel[]
}

function getRiskLevel(riskPercent: number): RiskLevel {
  if (riskPercent < 20) return "low"
  if (riskPercent < 50) return "medium"
  return "high"
}

export function PolicyRegistryClient({ initialPolicies }: PolicyRegistryClientProps) {
  // Map initialPolicies to UI format
  const policies: PolicyUI[] = useMemo(() => {
    return initialPolicies.map((p) => {
       const crop = (p.premiumDetails as any)?.crop || "Unknown"
       // Calculate risk score based on rainfall threshold (lower threshold = higher risk of drought)
       const riskVal = p.thresholdRainfall ? Math.min(100, Math.round((100 - p.thresholdRainfall) / 2)) : 10
       
       const weatherData = (p as any).weatherData;
       const oracleLastCheckRaw = (p as any).oracleLastCheck;
       const oracleTime = oracleLastCheckRaw ? new Date(oracleLastCheckRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Pending";

       return {
            id: p.id,
            farmer: p.user.email ? p.user.email.split('@')[0] : (p.user.walletAddress?.slice(0, 8) + '...' || "Unknown"),
            crop: crop.charAt(0).toUpperCase() + crop.slice(1),
            coverage: `${p.coverageAmount.toLocaleString()} RLUSD`,
            premium: p.premiumAmount ? `${p.premiumAmount.toLocaleString()} RLUSD` : "Pending",
            risk: `${riskVal}%`,
            status: p.status === 'ACTIVE' ? 'Active' : p.status.charAt(0).toUpperCase() + p.status.slice(1).toLowerCase(), 
            lastUpdate: new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            region: p.region,
            coordinates: p.coordinates,
            startDate: new Date(p.createdAt).toLocaleDateString(),
            endDate: p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "N/A",
            thresholdRainfall: p.thresholdRainfall ? `< ${p.thresholdRainfall}mm` : "N/A",
            escrowAddress: p.xrplEscrowId || "Pending",
            nftTokenId: p.nftTokenId || "Pending",
            oracleLastCheck: oracleTime,
            weatherCondition: weatherData?.condition || "No Data" 
       }
    })
  }, [initialPolicies])

  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<Filters>({
    statuses: [],
    crops: [],
    riskLevels: [],
  })
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyUI | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Calculate total active filters
  const activeFilterCount = filters.statuses.length + filters.crops.length + filters.riskLevels.length

  // Filter policies based on search and filters
  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      // Search filter
      const query = searchQuery.toLowerCase()
      const matchesSearch = !query || 
        policy.id.toLowerCase().includes(query) ||
        policy.farmer.toLowerCase().includes(query) ||
        policy.crop.toLowerCase().includes(query)

      if (!matchesSearch) return false

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(policy.status as StatusOption)) {
        return false
      }

      // Crop filter
      if (filters.crops.length > 0 && !filters.crops.includes(policy.crop as CropOption)) {
        return false
      }

      // Risk level filter
      if (filters.riskLevels.length > 0) {
        const riskPercent = parseInt(policy.risk)
        const policyRiskLevel = getRiskLevel(riskPercent)
        if (!filters.riskLevels.includes(policyRiskLevel)) {
          return false
        }
      }

      return true
    })
  }, [searchQuery, filters])

  // Toggle filter helpers
  function toggleStatus(status: StatusOption) {
    setFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }))
  }

  function toggleCrop(crop: CropOption) {
    setFilters((prev) => ({
      ...prev,
      crops: prev.crops.includes(crop)
        ? prev.crops.filter((c) => c !== crop)
        : [...prev.crops, crop],
    }))
  }

  function toggleRiskLevel(level: RiskLevel) {
    setFilters((prev) => ({
      ...prev,
      riskLevels: prev.riskLevels.includes(level)
        ? prev.riskLevels.filter((r) => r !== level)
        : [...prev.riskLevels, level],
    }))
  }

  function clearAllFilters() {
    setFilters({ statuses: [], crops: [], riskLevels: [] })
    setSearchQuery("")
  }

  function handlePolicyClick(policy: PolicyUI) {
    setSelectedPolicy(policy)
    setIsModalOpen(true)
  }

  return (
    <>
      <Card className="border-none shadow-sm bg-white flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Policy ID, Farmer, or Crop..." 
              className="pl-9 bg-gray-50 border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="text-muted-foreground">
                <Filter className="h-4 w-4 mr-2" /> 
                Filter
                {activeFilterCount > 0 && (
                  <Badge className="ml-2 bg-[#1B3A2B] text-white px-1.5 py-0.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filters.statuses.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                >
                  <StatusBadge status={status} />
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Crop Type</DropdownMenuLabel>
              {CROP_OPTIONS.map((crop) => (
                <DropdownMenuCheckboxItem
                  key={crop}
                  checked={filters.crops.includes(crop)}
                  onCheckedChange={() => toggleCrop(crop)}
                >
                  {crop}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Risk Level</DropdownMenuLabel>
              {RISK_LEVELS.map((level) => (
                <DropdownMenuCheckboxItem
                  key={level.value}
                  checked={filters.riskLevels.includes(level.value)}
                  onCheckedChange={() => toggleRiskLevel(level.value)}
                >
                  {level.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters button */}
          {activeFilterCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-red-600"
            >
              <X className="h-4 w-4 mr-1" /> Clear filters
            </Button>
          )}
        </div>
        
        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex gap-2 flex-wrap bg-gray-50/50">
            {filters.statuses.map((status) => (
              <Badge 
                key={status} 
                variant="secondary" 
                className="cursor-pointer hover:bg-gray-200"
                onClick={() => toggleStatus(status)}
              >
                {status} <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {filters.crops.map((crop) => (
              <Badge 
                key={crop} 
                variant="secondary" 
                className="cursor-pointer hover:bg-gray-200"
                onClick={() => toggleCrop(crop)}
              >
                {crop} <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {filters.riskLevels.map((level) => (
              <Badge 
                key={level} 
                variant="secondary" 
                className="cursor-pointer hover:bg-gray-200"
                onClick={() => toggleRiskLevel(level)}
              >
                {RISK_LEVELS.find((r) => r.value === level)?.label} <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="w-[180px]">Policy ID</TableHead>
                <TableHead>Farmer / Location</TableHead>
                <TableHead>Crop Type</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pavilion Sync</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Search className="h-8 w-8 mb-2 opacity-50" />
                      <p className="font-medium">No policies found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPolicies.map((policy) => (
                  <TableRow 
                    key={policy.id} 
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => handlePolicyClick(policy)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{policy.id}</TableCell>
                    <TableCell className="font-medium text-[#1B3A2B]">{policy.farmer}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">{policy.crop}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{policy.coverage}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${
                        parseInt(policy.risk) > 50 ? 'text-red-500' : 'text-green-600'
                      }`}>{policy.risk}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={policy.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" /> {policy.lastUpdate}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePolicyClick(policy)
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs text-muted-foreground">
          <span>Showing {filteredPolicies.length} of {policies.length} policies{activeFilterCount > 0 && " (filtered)"}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </Card>

      {/* Policy Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPolicy && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold text-[#1B3A2B] flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Policy Details
                    </DialogTitle>
                    <DialogDescription className="font-mono text-sm mt-1">
                      {selectedPolicy.id}
                    </DialogDescription>
                  </div>
                  <StatusBadge status={selectedPolicy.status} />
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Overview Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Farmer / Location</span>
                    </div>
                    <p className="font-medium text-[#1B3A2B]">{selectedPolicy.farmer}</p>
                    {selectedPolicy.region && (
                      <p className="text-sm text-muted-foreground">{selectedPolicy.region}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wheat className="h-4 w-4" />
                      <span>Crop Type</span>
                    </div>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {selectedPolicy.crop}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Coverage & Premium */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                      <Shield className="h-4 w-4" />
                      <span>Coverage</span>
                    </div>
                    <p className="font-bold text-lg text-green-800">{selectedPolicy.coverage}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-blue-700 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Premium</span>
                    </div>
                    <p className="font-bold text-lg text-blue-800">{selectedPolicy.premium}</p>
                  </div>
                  <div className={`rounded-lg p-4 ${
                    parseInt(selectedPolicy.risk) > 50 ? 'bg-red-50' : 
                    parseInt(selectedPolicy.risk) > 20 ? 'bg-yellow-50' : 'bg-green-50'
                  }`}>
                    <div className={`flex items-center gap-2 text-sm mb-1 ${
                      parseInt(selectedPolicy.risk) > 50 ? 'text-red-700' : 
                      parseInt(selectedPolicy.risk) > 20 ? 'text-yellow-700' : 'text-green-700'
                    }`}>
                      <Activity className="h-4 w-4" />
                      <span>Risk Score</span>
                    </div>
                    <p className={`font-bold text-lg ${
                      parseInt(selectedPolicy.risk) > 50 ? 'text-red-800' : 
                      parseInt(selectedPolicy.risk) > 20 ? 'text-yellow-800' : 'text-green-800'
                    }`}>{selectedPolicy.risk}</p>
                  </div>
                </div>

                <Separator />

                {/* Policy Period */}
                <div>
                  <h4 className="font-semibold text-sm text-[#1B3A2B] mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Policy Period
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="font-medium">{selectedPolicy.startDate || "N/A"}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="font-medium">{selectedPolicy.endDate || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Weather Threshold */}
                <div>
                  <h4 className="font-semibold text-sm text-[#1B3A2B] mb-3">Weather Conditions</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Payout Threshold</p>
                      <p className="font-medium">{selectedPolicy.thresholdRainfall || "N/A"}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Current Weather</p>
                      <p className="font-medium">{selectedPolicy.weatherCondition || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Blockchain Info */}
                <div>
                  <h4 className="font-semibold text-sm text-[#1B3A2B] mb-3">Blockchain Details</h4>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Escrow Address</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm truncate">{selectedPolicy.escrowAddress || "N/A"}</p>
                        {selectedPolicy.escrowAddress && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Policy NFT Token ID</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm truncate">{selectedPolicy.nftTokenId || "N/A"}</p>
                        {selectedPolicy.nftTokenId && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Oracle Status */}
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Pavilion Last Sync</p>
                      <p className="text-xs text-muted-foreground">{selectedPolicy.oracleLastCheck || selectedPolicy.lastUpdate}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Refresh Data
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1 bg-[#1B3A2B] hover:bg-[#2E7D32]">
                    View on XRPL Explorer
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Download Report
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-100 shadow-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>
  }
  if (status === "Warning") {
    return <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-100 shadow-none"><AlertCircle className="w-3 h-3 mr-1" /> Warning</Badge>
  }
  if (status === "Triggered") {
    return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-100 shadow-none"><AlertCircle className="w-3 h-3 mr-1" /> Triggered</Badge>
  }
  return <Badge variant="secondary">{status}</Badge>
}
