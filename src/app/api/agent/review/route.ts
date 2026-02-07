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
import { performAgentReview } from '@/lib/agent-review'

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

    const result = await performAgentReview(policyId)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Agent review error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
