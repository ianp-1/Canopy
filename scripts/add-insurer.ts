import { UserRole } from '@prisma/client'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load env before importing prisma
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env') })
if (result.error) console.error('Error loading .env:', result.error)

const resultLocal = dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
if (resultLocal.error && resultLocal.error.code !== 'ENOENT') console.error('Error loading .env.local:', resultLocal.error)

console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes (Length: ' + process.env.DATABASE_URL.length + ')' : 'No')
if (process.env.DATABASE_URL) {
    // Mask password for logging
    console.log('DATABASE_URL format:', process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'))
}
console.log('DIRECT_URL loaded:', process.env.DIRECT_URL ? 'Yes (Length: ' + process.env.DIRECT_URL.length + ')' : 'No')

if (process.env.DIRECT_URL) {
    console.log('Swapping DATABASE_URL with DIRECT_URL to bypass pooler...')
    process.env.DATABASE_URL = process.env.DIRECT_URL
}

// Import the configured prisma instance
// We use dynamic import to ensure env is loaded first if it matters, 
// though here we are top-level. 
// We need to resolve the path correctly.
// import prisma from '../src/lib/prisma' // Removed static import

// const prisma = new PrismaClient() // Removed


async function main() {
    // Dynamic import to ensure ENV vars are set/swapped BEFORE prisma initializes
    const { default: prisma } = await import('../src/lib/prisma')

    const args = process.argv.slice(2)
    const emailOrUid = args[0]

    if (!emailOrUid) {
        console.log('Usage: npx tsx scripts/add-insurer.ts <email_or_supabase_uid>')
        console.log('Listing existing users...')
        const users = await prisma.user.findMany()
        console.table(users.map(u => ({ id: u.id, email: u.email, role: u.role, uid: u.supabaseUid })))
        return
    }

    console.log(`Looking for user with identifier: ${emailOrUid}`)

    // Try to find user by email, supabaseUid, or walletAddress
    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: emailOrUid },
                { supabaseUid: emailOrUid },
                { walletAddress: emailOrUid }
            ]
        }
    })

    if (user) {
        console.log(`Found user: ${user.email} (${user.id}). Updating role to INSURER...`)
        user = await prisma.user.update({
            where: { id: user.id },
            data: { role: UserRole.INSURER }
        })
        console.log(`User ${user.email} is now an INSURER.`)
    } else {
        console.log(`User not found. Creating new user...`)
        // Create new user
        // We need a supabaseUid. If the input assumes email, we generate a fake uid.
        // If input looks like a UUID, we assume it is the uid.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emailOrUid)

        const supabaseUid = isUuid ? emailOrUid : `mock-uid-${Date.now()}`
        const email = isUuid ? `user-${Date.now()}@example.com` : emailOrUid

        try {
            user = await prisma.user.create({
                data: {
                    supabaseUid,
                    email,
                    role: UserRole.INSURER,
                    // Wallet address is optional
                }
            })
            console.log(`Created new INSURER user:`)
            console.log(`Email: ${user.email}`)
            console.log(`Supabase UID: ${user.supabaseUid}`)
            console.log(`Role: ${user.role}`)
        } catch (e) {
            console.error('Error creating user:', e)
        }
    }

    // Also create an Insurer entity if one doesn't exist for demo purposes?
    // The schema doesn't link User to Insurer, so maybe not strictly required for login,
    // but good for the dashboard to show data.
    // Let's check if any insurer exists.
    const insurerCount = await prisma.insurer.count()
    if (insurerCount === 0) {
        console.log('No Insurer entity found. Creating a default "Global Insurer"...')
        await prisma.insurer.create({
            data: {
                name: 'Global Farmer Insurance',
                walletAddress: 'rDefaultInsurerWalletAddress123456', // Mock address
                totalLiquidity: 1000000
            }
        })
        console.log('Created default Insurer entity.')
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        // No disconnect needed here, Prisma client is managed by the script's lifecycle
    })
