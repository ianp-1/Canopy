
import 'dotenv/config'
import { performAgentReview } from '../lib/agent-review'

async function main() {
    const policyId = '6fb31f31-baaa-4dc3-b70f-dcaa8f90b878' // Using the ID from earlier check_db output
    console.log('BACKEND_URL:', process.env.BACKEND_URL)
    console.log(`Running agent review for policy ${policyId}...`)

    const result = await performAgentReview(policyId)
    console.log('Result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
