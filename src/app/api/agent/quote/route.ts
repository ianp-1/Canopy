/**
 * Agent Quote API — Dynamic Premium Generation
 *
 * Proxies to the Python backend's /agent/quote endpoint which runs the
 * LangGraph underwriting graph (Pavilion AI Agent).  Returns a dynamic
 * premium calculated from real-time weather, ML risk model, land
 * verification, and storm data — instead of hardcoded static rates.
 *
 * @route POST /api/agent/quote
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

interface AgentQuoteRequest {
  latitude: number
  longitude: number
  farm_size_hectares: number
  crop_type: string
  coverage_rlusd: number
}

export async function POST(request: NextRequest) {
  try {
    const body: AgentQuoteRequest = await request.json()

    const { latitude, longitude, farm_size_hectares, crop_type, coverage_rlusd } = body

    if (
      latitude == null ||
      longitude == null ||
      !crop_type ||
      !coverage_rlusd
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: latitude, longitude, crop_type, coverage_rlusd' },
        { status: 400 },
      )
    }

    // Call the Python agent's underwriting graph
    const backendResponse = await fetch(`${BACKEND_URL}/agent/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        farm_size_hectares: farm_size_hectares || 10,
        crop_type,
        coverage_rlusd,
      }),
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Agent quote backend error:', errorText)
      return NextResponse.json(
        { error: `Pavilion agent error: ${errorText}` },
        { status: 502 },
      )
    }

    const data = await backendResponse.json()

    return NextResponse.json({
      success: true,
      status: data.status,
      premium_rlusd: data.premium_rlusd,
      risk_score: data.risk_score,
      risk_level: data.risk_level,
      weather_data: data.weather_data,
      reasoning_log: data.reasoning_log || [],
    })
  } catch (error) {
    console.error('Agent quote error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
