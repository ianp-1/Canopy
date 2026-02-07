
const { createClient } = require('@supabase/supabase-js');
// Import from the GENERATED location
// The path is relative to where we run the script, or absolute.
// "src/generated/prisma" is likely where it lives relative to project root.
// Let's try to require it relative to this script (in ./scripts)
// So ../src/generated/prisma
const { PrismaClient, UserRole } = require('../src/generated/prisma');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('DB URL Loaded:', process.env.DATABASE_URL ? 'YES' : 'NO');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function seedUser() {
    const email = 'farmer@test.com';
    const password = 'password123';
    const role = 'FARMER'; // Default role

    console.log(`🌱 Seeding test user: ${email}`);

    try {
        // 1. Create User in Supabase Auth
        // capabilities: admin.createUser auto-confirms email!
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true // This is the magic! Auto-confirms so no email needed.
        });

        let userId;

        if (authError) {
            console.error('❌ Supabase Auth Error:', authError.message);
            // Verify if user already exists
            if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                console.log('User might already exist in Supabase, fetching ID...');
                const { data: userData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) {
                    console.error('Failed to list users:', listError);
                    return;
                }
                const foundUser = userData.users.find(u => u.email === email);
                if (foundUser) {
                    userId = foundUser.id;
                    console.log(`Found existing Supabase user: ${userId}`);
                } else {
                    console.error('Could not find existing Supabase user ID despite error.');
                    return;
                }
            } else {
                return;
            }
        } else {
            userId = authData.user.id;
            console.log(`✅ Supabase User Created: ${userId}`);
        }

        // 2. Create User in Prisma (Database)
        const existingUser = await prisma.user.findUnique({
            where: { supabaseUid: userId }
        });

        if (!existingUser) {
            await prisma.user.create({
                data: {
                    supabaseUid: userId,
                    email: email,
                    role: UserRole.FARMER,
                }
            });
            console.log(`✅ Prisma User Created`);
        } else {
            console.log(`ℹ️ Prisma User already exists`);
        }

        // 3. Create a default Policy for the user so they have data
        // Check if policy exists
        const existingPolicy = await prisma.policy.findFirst({
            where: { userId: existingUser ? existingUser.id : undefined } // We need internal ID
        });

        // We need the internal ID for policy creation. existingUser might be null if we just created it?
        // Wait, if existingUser was null, we just created it. Use the user we just created.
        const userForPolicy = existingUser || await prisma.user.findUnique({ where: { supabaseUid: userId } });

        if (userForPolicy && !existingPolicy) {
            console.log('Creating demo policy...');
            await prisma.policy.create({
                data: {
                    userId: userForPolicy.id,
                    region: 'Demo Region',
                    coverageAmount: 10000,
                    status: 'ACTIVE',
                    thresholdRainfall: 50,
                    coordinates: { lat: 37.7749, lng: -122.4194 },
                    premiumDetails: { total: 500, rate: 5 }
                }
            });
            console.log('✅ Demo Policy Created');
        }

        console.log(`
🎉 SUCCESS!
You can now log in with:
Email: ${email}
Password: ${password}
    `);

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedUser();
