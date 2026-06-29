import app from './app';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'ADMIN_PASSWORD', 'SCAN_PIN', 'VERIFICATION_SALT'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} environment variable is not set`);
    process.exit(1);
  }
}

const pwd = process.env.ADMIN_PASSWORD!;
const weakPassword = pwd.length < 8 || /^(admin|password|12345)/i.test(pwd) || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd);
if (weakPassword) {
  console.error('FATAL: ADMIN_PASSWORD is too weak. Use 8+ chars with mixed case, numbers, and avoid common patterns.');
  process.exit(1);
}

if (!process.env.SCAN_RESET_PASSWORD) {
  console.warn('WARNING: SCAN_RESET_PASSWORD not set. Scan reset feature will be unavailable.');
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
