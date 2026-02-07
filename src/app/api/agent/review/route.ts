/**
 * Agent Review API — Pavilion AI Policy Review
 *
 * When a farmer creates a new policy, this endpoint triggers the
 * Pavilion AI agent to review it.  The agent runs the LangGraph
 * underwriting graph to assess land verification, weather risk, storm
 * events, and ML risk — then stores its recommendation (APPROVE /
 * REJECT with reasoning) in the OracleLog for the insurer dashboard.
 *
 * @route POST /api/agent/review
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OracleAction } from '@/generated/prisma'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

interface ReviewRequest {
  policyId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json()
    const { policyId } = body

    if (!policyId) {
      return NextResponse.json(
        { error: 'policyId is required' },
        { status: 400 },
      )
    }

    // Fetch the policy with its details
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { user: true },
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 },
      )
    }

    // Extract location from policy
    const coords = policy.coordinates as { lat: number; lng: number } | null
    const premiumDetails = policy.premiumDetails as Record<string, unknown> | null

    if (!coords) {
      // Store a review log noting missing coordinates
      await prisma.oracleLog.create({
        data: {
          policyId,
          action: OracleAction.CHECK_TRIGGERED,
          consensusScore: 0,
          weatherData: {
            agentReview: true,
            agentName: 'Pavilion',
            recommendation: 'NEEDS_INFO',
            reasoning: 'Policy has no coordinates — cannot perform land or weather verification.',
            reviewedAt: new Date().toISOString(),
          },
        },
      })

      return NextResponse.json({
        success: true,
        recommendation: 'NEEDS_INFO',
        message: 'No coordinates available for agent review',
      })
    }

    // Determine crop type and coverage
    const cropType = (premiumDetails?.crop as string) || 'corn'
    const coverageXrp = Number(policy.coverageAmount) || 1000
    const areaHectares = (premiumDetails?.areaHectares as number) || 10

    // Call the Python agent's underwriting graph for review
    const backendResponse = await fetch(`${BACKEND_URL}/agent/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: coords.lat,
        longitude: coords.lng,
        farm_size_hectares: areaHectares,
        crop_type: cropType,
        coverage_xrp: coverageXrp,
      }),
    })

    let agentResult: Record<string, unknown> | null = null
    let recommendation = 'UNKNOWN'
    let confidenceScore = 0
    let reasoningLog: unknown[] = []

    if (backendResponse.ok) {
      agentResult = await backendResponse.json()
      const status = agentResult?.status as string

      if (status === 'quote_pending') {
        recommendation = 'APPROVE'
        confidenceScore = 1.0 - ((agentResult?.risk_score as number) || 0.5)
      } else if (status === 'rejected') {
        recommendation = 'DENY'
        confidenceScore = (agentResult?.risk_score as number) || 0.5
      }

      reasoningLog = (agentResult?.reasoning_log as unknown[]) || []
    } else {
      const errorText = await backendResponse.text()
      recommendation = 'ERROR'
      reasoningLog = [{ error: errorText }]
    }

    // Store the agent's review in OracleLog
    await prisma.oracleLog.create({
      data: {
        policyId,
        action: OracleAction.CHECK_TRIGGERED,
        consensusScore: confidenceScore,
        weatherData: {
          agentReview: true,
          agentName: 'Pavilion',
          recommendation,
          premium_xrp: agentResult?.premium_xrp ?? null,
          risk_score: agentResult?.risk_score ?? null,
          risk_level: agentResult?.risk_level ?? null,
          reasoning_log: reasoningLog,
          weather_summary: agentResult?.weather_data ?? null,
          reviewedAt: new Date().toISOString(),
        } as any,
      },
    })

    return NextResponse.json({
      success: true,
      recommendation,
      premium_xrp: agentResult?.premium_xrp ?? null,
      risk_score: agentResult?.risk_score ?? null,
      risk_level: agentResult?.risk_level ?? null,
      reasoning_log: reasoningLog,
      confidence: confidenceScore,
    })
  } catch (error) {
    console.error('Agent review error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
