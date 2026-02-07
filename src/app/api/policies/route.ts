/**
 * List Policies API
 * 
 * Returns policies, optionally filtered by status.
 * Used by the Oracle Simulator to list active policies for selection.
 * 
 * @route GET /api/policies?status=ACTIVE
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PolicyStatus } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.toUpperCase() as PolicyStatus | null;

    const where = status ? { status } : {};

    const policies = await prisma.policy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        region: true,
        status: true,
        coverageAmount: true,
        createdAt: true,
        expiresAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      policies: policies.map(p => ({
        id: p.id,
        region: p.region,
        status: p.status,
        coverageAmount: p.coverageAmount.toString(),
        farmerEmail: p.user?.email,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt?.toISOString(),
      })),
      total: policies.length,
    });
  } catch (error) {
    console.error('List policies error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
