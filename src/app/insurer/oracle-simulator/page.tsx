'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Calendar, CheckCircle, Droplets, Flame, Loader2, Play, Thermometer, Wind, Zap } from "lucide-react"

interface Policy {
  id: string
  region: string
  status: string
  coverageAmount: string
  farmerEmail?: string
}

interface SimulationResult {
  success: boolean
  policy: Policy
  simulation: {
    targetDate: string
    cropType: string
    thresholds: {
      weeklyRainNeedMm: number
      heatThresholdK: number
      vpdThresholdKpa: number
    }
    severity: number
    severityPercent: string
    payoutThreshold: number
    payoutThresholdPercent: string
    wouldTrigger: boolean
    samplePoints: Array<{
      lat: number
      lon: number
      p_severity: number
      stress: {
        rain_stress: number
        heat_stress: number
        vpd_stress: number
      }
      weather_summary: {
        precip_sum: number
        max_temp_K: number
        vpd_avg: number
      }
    }>
  }
  canExecutePayout: boolean
  error?: string
}

const CROP_TYPES = ['corn', 'wheat', 'soy', 'other']

export default function OracleSimulatorPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('')
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [cropType, setCropType] = useState<string>('generic')
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [bypassSafeguards, setBypassSafeguards] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch active policies
  useEffect(() => {
    async function fetchPolicies() {
      try {
        const res = await fetch('/api/policies?status=ACTIVE')
        if (res.ok) {
          const data = await res.json()
          setPolicies(data.policies || [])
        }
      } catch (err) {
        console.error('Failed to fetch policies:', err)
      }
    }
    fetchPolicies()
  }, [])

  async function handleSimulate() {
    if (!selectedPolicyId || !targetDate) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/oracle/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: selectedPolicyId,
          targetDate,
          cropType,
          bypassSafeguards,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Simulation failed')
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleExecutePayout() {
    if (!result?.canExecutePayout) return

    setExecuting(true)
    setError(null)

    try {
      const res = await fetch('/api/oracle/execute-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: result.policy.id,
          confirmedSeverity: result.simulation.severity,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Payout execution failed')
        return
      }

      // Refresh result
      setResult(prev => prev ? {
        ...prev,
        policy: { ...prev.policy, status: 'CLAIMED' },
        canExecutePayout: false,
      } : null)

      alert(`✅ Payout executed!\nTx Hash: ${data.txHash}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="p-8 space-y-8 font-sans">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-[#1B3A2B] tracking-tight flex items-center gap-3">
          <Zap className="h-7 w-7 text-amber-500" />
          Pavilion Simulator
        </h1>
        <p className="text-muted-foreground">
          Test Pavilion AI evaluation for specific dates and manually trigger payouts
        </p>
      </div>

      {/* Controls */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Simulation Parameters</CardTitle>
          <CardDescription>Select a policy and target date to evaluate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Policy Selector */}
            <div className="space-y-2">
              <Label htmlFor="policy">Policy</Label>
              <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                <SelectTrigger id="policy">
                  <SelectValue placeholder="Select a policy..." />
                </SelectTrigger>
                <SelectContent>
                  {policies.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs">{p.id.slice(0, 8)}...</span>
                      <span className="ml-2 text-muted-foreground">{p.region}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
              <Label htmlFor="date">Target Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Crop Type */}
            <div className="space-y-2">
              <Label htmlFor="crop">Crop Type</Label>
              <Select value={cropType} onValueChange={setCropType}>
                <SelectTrigger id="crop">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CROP_TYPES.map(c => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Run Button */}
            <div className="space-y-2">
              <Label className="invisible">Action</Label>
              <Button
                onClick={handleSimulate}
                disabled={!selectedPolicyId || loading}
                className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Simulation
              </Button>
            </div>
          </div>

          {/* Bypass Safeguards Toggle */}
          <div className="mt-4 pt-4 border-t flex items-center gap-2">
            <input
              type="checkbox"
              id="bypass"
              checked={bypassSafeguards}
              onChange={(e) => setBypassSafeguards(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="bypass" className="text-sm text-muted-foreground cursor-pointer">
              Bypass Safeguards (testing only) — skip severity caps for raw model output
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Severity Gauge */}
          <Card className="border-none shadow-lg overflow-hidden">
            <div className={`p-6 ${result.simulation.wouldTrigger ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Severity Score</p>
                  <p className="text-5xl font-bold mt-1">{result.simulation.severityPercent}%</p>
                  <p className="text-white/80 mt-2">
                    Threshold: {result.simulation.payoutThresholdPercent}%
                  </p>
                </div>
                <div className="text-right">
                  {result.simulation.wouldTrigger ? (
                    <Badge className="bg-white/20 text-white text-lg px-4 py-2 border-0">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      PAYOUT TRIGGERED
                    </Badge>
                  ) : (
                    <Badge className="bg-white/20 text-white text-lg px-4 py-2 border-0">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      NO PAYOUT
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Stress Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.simulation.samplePoints[0] && (
              <>
                <StressCard
                  icon={Droplets}
                  label="Rain Stress"
                  value={result.simulation.samplePoints[0].stress.rain_stress}
                  detail={`${result.simulation.samplePoints[0].weather_summary.precip_sum.toFixed(1)}mm precipitation`}
                  color="blue"
                />
                <StressCard
                  icon={Flame}
                  label="Heat Stress"
                  value={result.simulation.samplePoints[0].stress.heat_stress}
                  detail={`${(result.simulation.samplePoints[0].weather_summary.max_temp_K - 273.15).toFixed(1)}°C max temp`}
                  color="red"
                />
                <StressCard
                  icon={Wind}
                  label="VPD Stress"
                  value={result.simulation.samplePoints[0].stress.vpd_stress}
                  detail={`${result.simulation.samplePoints[0].weather_summary.vpd_avg.toFixed(2)} kPa avg VPD`}
                  color="purple"
                />
              </>
            )}
          </div>

          {/* Execute Payout */}
          {result.canExecutePayout && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-amber-900">Ready to Execute Payout</h3>
                    <p className="text-amber-700">
                      Severity {result.simulation.severityPercent}% exceeds threshold. 
                      Policy can be paid out ({result.policy.coverageAmount} RLUSD).
                    </p>
                  </div>
                  <Button
                    onClick={handleExecutePayout}
                    disabled={executing}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {executing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Execute Payout
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Policy Info */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Policy Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Policy ID</dt>
                  <dd className="font-mono">{result.policy.id.slice(0, 12)}...</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Region</dt>
                  <dd>{result.policy.region}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={result.policy.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {result.policy.status}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coverage</dt>
                  <dd>{result.policy.coverageAmount} RLUSD</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

interface StressCardProps {
  icon: React.ElementType
  label: string
  value: number
  detail: string
  color: 'blue' | 'red' | 'purple'
}

function StressCard({ icon: Icon, label, value, detail, color }: StressCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
  }

  const percent = (value * 100).toFixed(1)

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <p className="text-2xl font-bold">{percent}%</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
