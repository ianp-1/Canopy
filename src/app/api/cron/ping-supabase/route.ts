/**
 * Supabase Keep-Alive Cron Job
 *
 * Runs a lightweight query against the database every day to prevent
 * Supabase from pausing due to inactivity.
 *
 * @route GET /api/cron/ping-supabase
 *
 * Security: Protected by CRON_SECRET header (enforced in production)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Lightweight query — just counts users to keep the connection alive
    const count = await prisma.user.count()

    console.log(`[Cron] Supabase ping successful — ${count} user(s) in DB`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Supabase keep-alive ping successful',
      userCount: count,
    })
  } catch (error) {
    console.error('[Cron] Supabase ping failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database ping failed with unknown error' },
      { status: 500 }
    )
  }
}
