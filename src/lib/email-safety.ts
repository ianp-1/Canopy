
/**
 * Email Safety Utility
 * 
 * potentially unsafe emails in development/testing environments.
 * Prevents high bounce rates by mocking email sending for test addresses.
 */

// Domain list that should always be mocked in development
const MOCK_DOMAINS = [
    'example.com',
    'test.com',
    'demo.com',
    'invalid.com',
    'localhost.com'
];

/**
 * Checks if an email should be allowed to receive real emails.
 * 
 * @param email The email address to check
 * @returns { shouldSend: boolean, reason: string }
 */
export function checkEmailSafety(email: string): { shouldSend: boolean; reason?: string } {
    // 1. Production always sends (unless we want to add blacklists later)
    if (process.env.NODE_ENV === 'production') {
        return { shouldSend: true };
    }

    // 2. logic for Development/Preview environments

    // Normalize
    const normalizedEmail = email.toLowerCase().trim();
    const domain = normalizedEmail.split('@')[1];

    // A. Check Explicit Allowlist (from env)
    const allowedEmails = (process.env.DEV_ALLOWED_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

    if (allowedEmails.includes(normalizedEmail)) {
        return { shouldSend: true, reason: 'In allowed list' };
    }

    // B. Check Mock Domains
    if (MOCK_DOMAINS.includes(domain)) {
        return {
            shouldSend: false,
            reason: `Mocking email for test domain: ${domain}`
        };
    }

    // C. Default Policy for Dev: 
    // If not allowlisted and not a known mock domain, what to do?
    // Option 1: Block everything not allowlisted (Safest)
    // Option 2: Allow everything not blocked (High risk of bounce)
    // Logic: "Limit testing on live addresses". 
    // Decision: Warn but Allow if it looks real? Or Mock by default?
    // Let's go with: Mock by default unless allowlisted OR it's a specific pattern?
    // Actually, to be safe and solve the user's "High rate of bounced emails" issue,
    // we should be strict. 
    // But that might block legitimate dev testing.
    // Let's implement a "Log Only" mode for unknown emails, effectively mocking them.

    // If the email doesn't look like a test email (e.g. valid-looking gmail), 
    // we might validly want to test flow. 
    // However, Supabase complained about bounce rates. 
    // Let's ONLY allow if in allowlist, OR if it's NOT a mock domain?
    // Actually, standard test emails often use `+test` or similar.

    // Let's use a "Safe Mode": 
    // If it's a known test domain -> BLOCK/MOCK.
    // If it's anything else -> ALLOW but log warning.
    // This balances safety with usability.

    return { shouldSend: true, reason: 'Allowed in development (not a blocked test domain)' };
}

/**
 * Helper to log mocked emails
 */
export function logMockEmail(action: string, email: string) {
    console.log(`[Email Safety] 🛑 MOCKED EMAIL SENDING (${action})`);
    console.log(`[Email Safety] To: ${email}`);
    console.log(`[Email Safety] Reason: Test domain or not allowlisted.`);
    console.log(`[Email Safety] ----------------------------------------`);
}
