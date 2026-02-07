
const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://postgres:AIaZmoSx9s2qTptH@db.pvrlnclgogftwqirgvkh.supabase.co:5432/postgres?pgbouncer=true",
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();

        console.log('--- RECENT POLICIES ---');
        const res = await client.query('SELECT id, status, "createdAt" FROM "policies" ORDER BY "createdAt" DESC LIMIT 5');
        console.table(res.rows);

        console.log('\n--- RECENT ORACLE LOGS ---');
        const logs = await client.query('SELECT id, "policyId", action, "weatherData" FROM "oracle_logs" ORDER BY "createdAt" DESC LIMIT 5');

        logs.rows.forEach(log => {
            console.log(`\nLog ID: ${log.id}`);
            console.log(`Policy ID: ${log.policyId}`);
            console.log(`Action: ${log.action}`);
            console.log('WeatherData:', JSON.stringify(log.weatherData, null, 2));
        });

        console.log('\n--- VERIFICATION INSTRUCTIONS ---');
        console.log('1. Run the app: npm run dev');
        console.log('2. Go to http://localhost:3000/wizard and purchase a policy.');
        console.log('3. Wait 10-15 seconds for background job.');
        console.log('4. Run this script again: node check_db.js');
        console.log('5. Look for a new OracleLog with Action: CHECK_TRIGGERED and valid agentReview data.');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
