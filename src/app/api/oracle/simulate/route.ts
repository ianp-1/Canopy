/**
 * Oracle Simulation API
 * 
 * Allows manual evaluation of a policy for a specific date without triggering payout.
 * Used by the Oracle Simulator dashboard for testing and verification.
 * 
 * @route POST /api/oracle/simulate
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PolicyStatus } from '@/generated/prisma';
import { getCropThresholds, SEVERITY_THRESHOLD } from '@/lib/crop-requirements';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

interface SimulateRequest {
  policyId: string;
  targetDate: string; // ISO date string YYYY-MM-DD
  cropType?: string;
  bypassSafeguards?: boolean;
}

interface BackendEvaluationResponse {
  p_severity_farm: number;
  sample_points: Array<{
    lat: number;
    lon: number;
    p_severity: number;
    stress: {
      rain_stress: number;
      heat_stress: number;
      vpd_stress: number;
    };
    weather_summary: {
      precip_sum: number;
      max_temp_K: number;
      vpd_avg: number;
      avg_temp_7d: number;
    };
  }>;
  note: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SimulateRequest = await request.json();
    const { policyId, targetDate, cropType = 'generic', bypassSafeguards = false } = body;

    if (!policyId || !targetDate) {
      return NextResponse.json(
        { error: 'policyId and targetDate are required' },
        { status: 400 }
      );
    }

    // Fetch policy
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { user: true },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Get geometry from policy
    const geometry = policy.geometry as object | null;
    const coords = policy.coordinates as { lat: number; lng: number } | null;

    if (!geometry && !coords) {
      return NextResponse.json(
        { error: 'Policy has no geometry or coordinates' },
        { status: 400 }
      );
    }

    // Build evaluation geometry
    const lat = coords?.lat || 0;
    const lng = coords?.lng || 0;
    const evaluationGeometry = geometry || {
      type: 'Polygon',
      coordinates: [[
        [lng - 0.01, lat - 0.01],
        [lng + 0.01, lat - 0.01],
        [lng + 0.01, lat + 0.01],
        [lng - 0.01, lat + 0.01],
        [lng - 0.01, lat - 0.01],
      ]],
    };

    // Get crop thresholds
    const thresholds = getCropThresholds(cropType);

    // Call FastAPI backend
    const backendResponse = await fetch(`${BACKEND_URL}/oracle/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        geometry: evaluationGeometry,
        crop_type: cropType,
        date: targetDate,
        weekly_rain_need_mm: policy.weeklyRainNeedMm || thresholds.weeklyRainNeedMm,
        heat_threshold_K: policy.heatThresholdK || thresholds.heatThresholdK,
        vpd_threshold_kpa: policy.vpdThresholdKpa || thresholds.vpdThresholdKpa,
        bypass_safeguards: bypassSafeguards,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: 502 }
      );
    }

    const evaluation: BackendEvaluationResponse = await backendResponse.json();
    const severity = evaluation.p_severity_farm;
    const wouldTrigger = severity >= SEVERITY_THRESHOLD;

    return NextResponse.json({
      success: true,
      policy: {
        id: policy.id,
        region: policy.region,
        status: policy.status,
        coverageAmount: policy.coverageAmount.toString(),
        farmerEmail: policy.user?.email,
      },
      simulation: {
        targetDate,
        cropType,
        thresholds: {
          weeklyRainNeedMm: policy.weeklyRainNeedMm || thresholds.weeklyRainNeedMm,
          heatThresholdK: policy.heatThresholdK || thresholds.heatThresholdK,
          vpdThresholdKpa: policy.vpdThresholdKpa || thresholds.vpdThresholdKpa,
        },
        severity,
        severityPercent: (severity * 100).toFixed(1),
        payoutThreshold: SEVERITY_THRESHOLD,
        payoutThresholdPercent: (SEVERITY_THRESHOLD * 100).toFixed(1),
        wouldTrigger,
        samplePoints: evaluation.sample_points,
        note: evaluation.note,
      },
      canExecutePayout: wouldTrigger && policy.status === PolicyStatus.ACTIVE,
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
