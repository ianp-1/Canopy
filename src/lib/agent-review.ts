
import prisma from '@/lib/prisma'
import { OracleAction } from '@/generated/prisma'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

/**
 * Performs the Pavilion Agent review for a given policy.
 * This function is shared between the API route (for manual triggers)
 * and the payment action (for automatic background triggering).
 */
export async function performAgentReview(policyId: string) {
    try {
        if (!policyId) {
            throw new Error('policyId is required')
        }

        // Fetch the policy with its details
        const policy = await prisma.policy.findUnique({
            where: { id: policyId },
            include: { user: true },
        })

        if (!policy) {
            throw new Error('Policy not found')
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

            return {
                success: true,
                recommendation: 'NEEDS_INFO',
                message: 'No coordinates available for agent review',
            }
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
                confidenceScore = 1.0 - ((agentResult?.risk_score as number) ?? 0.5)
            } else if (status === 'rejected') {
                recommendation = 'DENY'
                confidenceScore = (agentResult?.risk_score as number) ?? 0.5
            }

            reasoningLog = (agentResult?.reasoning_log as unknown[]) || []
        } else {
            const errorText = await backendResponse.text()
            recommendation = 'ERROR'
            reasoningLog = [{ error: errorText }]
            console.error('Backend agent/quote failed:', errorText)
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
                    reasoning_log: reasoningLog as any,
                    weather_summary: agentResult?.weather_data ?? null,
                    reviewedAt: new Date().toISOString(),
                },
            },
        })

        return {
            success: true,
            recommendation,
            premium_xrp: agentResult?.premium_xrp ?? null,
            risk_score: agentResult?.risk_score ?? null,
            risk_level: agentResult?.risk_level ?? null,
            reasoning_log: reasoningLog,
            confidence: confidenceScore,
        }

    } catch (error) {
        console.error('Agent review internal error:', error)
        // We re-throw or return error structure depending on preference,
        // but here we just return the error info so callers can handle it.
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }
    }
}
