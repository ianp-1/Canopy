
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    //ssl: { rejectUnauthorized: false }, // Let's see if default fails
});

async function testWebAuth() {
    console.log('Testing Authentication with pg client...');
    console.log('Connection String (masked):', process.env.DIRECT_URL.replace(/:([^:@]+)@/, ':****@'));

    try {
        await client.connect();
        console.log('Authentication successful!');
        const res = await client.query('SELECT NOW()');
        console.log('Query result:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('Authentication failed:', err.message);
        if (err.code) console.error('Error code:', err.code);
        await client.end();
        process.exit(1);
    }
}

testWebAuth();
