// @ts-nocheck
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
    const policies = await prisma.policy.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            oracleLogs: true
        }
    });

    console.log('Found', policies.length, 'policies.');
    for (const policy of policies) {
        console.log(`Policy ID: ${policy.id}, Status: ${policy.status}`);
        console.log('Oracle Logs:', policy.oracleLogs.length);
        policy.oracleLogs.forEach(log => {
            console.log('  Log ID:', log.id);
            console.log('  Action:', log.action);
            console.log('  WeatherData:', JSON.stringify(log.weatherData, null, 2));
        });
        console.log('---');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
