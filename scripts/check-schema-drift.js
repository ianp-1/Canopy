#!/usr/bin/env node
/**
 * Schema Drift Prevention Script
 * 
 * This script checks for schema drift between local Prisma migrations
 * and the database before starting the dev server.
 * 
 * Usage: npm run dev:safe
 */

// Load environment variables (supports both .env and .env.local)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { execSync } = require('child_process');

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

function log(color, message) {
    console.log(`${color}${message}${COLORS.reset}`);
}

function checkSchemaDrift() {
    log(COLORS.cyan, '\n🔍 Checking for schema drift...\n');

    try {
        // Run prisma migrate status and capture output
        const output = execSync('npx prisma migrate status', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Check for common drift indicators
        const hasPendingMigrations = output.includes('Following migration') && output.includes('have not yet been applied');
        const hasDatabaseDrift = output.includes('drift') || output.includes('edited or deleted');
        const isUpToDate = output.includes('Database schema is up to date');

        if (isUpToDate) {
            log(COLORS.green, '✅ Database schema is up to date!\n');
            return true;
        }

        if (hasPendingMigrations) {
            log(COLORS.yellow, '⚠️  Pending migrations detected!');
            log(COLORS.yellow, '   Run: npm run db:reset');
            log(COLORS.yellow, '   Or:  npx prisma migrate dev\n');
            return false;
        }

        if (hasDatabaseDrift) {
            log(COLORS.red, '❌ Schema drift detected!');
            log(COLORS.red, '   Your database schema has drifted from your local migrations.');
            log(COLORS.red, '   Run: npm run db:reset\n');
            return false;
        }

        // Parse output for any issues
        console.log(output);
        return true;

    } catch (error) {
        // Handle connection errors
        if (error.message.includes('P1001') || error.message.includes("Can't reach database")) {
            log(COLORS.red, '❌ Cannot connect to database!');
            log(COLORS.red, '   Check your DATABASE_URL and DIRECT_URL in .env and .env.local\n');
            return false;
        }

        if (error.message.includes('P1000') || error.message.includes('Authentication failed')) {
            log(COLORS.red, '❌ Database authentication failed!');
            log(COLORS.red, '   Check your database credentials in .env and .env.local');
            log(COLORS.red, '   Make sure both files have the same password!\n');
            return false;
        }

        // Unknown error
        log(COLORS.red, `❌ Error checking schema: ${error.message}\n`);
        return false;
    }
}

function checkPrismaClient() {
    const fs = require('fs');
    const path = require('path');

    const clientPath = path.join(__dirname, '..', 'src', 'generated', 'prisma');

    if (!fs.existsSync(clientPath)) {
        log(COLORS.yellow, '⚠️  Prisma client not found. Generating...');
        try {
            execSync('npx prisma generate', { stdio: 'inherit' });
            log(COLORS.green, '✅ Prisma client generated!\n');
        } catch {
            log(COLORS.red, '❌ Failed to generate Prisma client\n');
            return false;
        }
    }

    return true;
}

// Main execution
log(COLORS.cyan, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log(COLORS.cyan, '  Prisma Schema Drift Check');
log(COLORS.cyan, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const clientOk = checkPrismaClient();
const schemaOk = checkSchemaDrift();

if (!clientOk || !schemaOk) {
    log(COLORS.red, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(COLORS.red, '  ❌ Pre-flight check failed. Fix issues above.');
    log(COLORS.red, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
}

log(COLORS.green, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log(COLORS.green, '  ✅ All checks passed. Starting dev server...');
log(COLORS.green, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
