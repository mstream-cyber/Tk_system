# Email Verification Fix Plan

## Root Cause

`routes/booking.ts` generates a 6-digit code, stores it + `verification_code_sent_at` in the DB, but **never emails the code**. The resend endpoint (`routes/verify.ts`) checks the cooldown against that `verification_code_sent_at`, which was just set — so it immediately returns 429 "Please wait ~55s" without ever sending an email.

## Changes

### Fix 1: `server/src/routes/booking.ts`

**Remove** the code generation + hash + sent_at block (lines 99–107), and the now-unused helpers at the top:

- Delete `import crypto from 'crypto';` (line 3) — only used for verification code
- Delete `const VERIFICATION_SALT = ...` (line 9)
- Delete `function hashCode(...)` (lines 11–13)
- Delete `function generateCode(...)` (lines 15–17)
- Delete `const verificationCode = generateCode();` through `.eq('id', order.id);` (lines 99–107)

Order creation now just inserts the order. The code is generated, stored, and emailed only in the resend endpoint.

### Fix 2: `client/src/pages/BookingPage.tsx`

The auto-resend effect (lines 259–276) already handles errors gracefully. With Fix 1, the resend endpoint will no longer hit a false cooldown, so the auto-resend should succeed on the first call and the user will receive the code immediately. No code changes needed here.

### Verification

1. `npm run build` in both `client/` and `server/` — must pass
2. Full flow: create booking → step 3 → code arrives in email → enter code → step 4
