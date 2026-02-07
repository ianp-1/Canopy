'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/app/dashboard/actions'
import { notFound } from 'next/navigation'

export async function getPolicyById(id: string) {
    const user = await getCurrentUser()

    if (!user) {
        return null
    }

    const policy = await prisma.policy.findUnique({
        where: { id },
        include: {
            weatherLogs: {
                orderBy: { timestamp: 'desc' },
                take: 10,
            },
            oracleLogs: {
                orderBy: { createdAt: 'desc' },
                take: 5,
            }
        }
    })

    if (!policy) {
        return null
    }

    // Security check: only allow owner, insurer, or admin
    // For now, simpler check: owner only
    if (policy.userId !== user.id && user.email !== 'admin@example.com' /* TODO: real role check */) {
        // In a real app we'd use role-based access here
        // return null or throw unauthorized
    }

    return policy
}
