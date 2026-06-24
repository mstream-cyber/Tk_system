import app from './app';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'ADMIN_PASSWORD'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} environment variable is not set`);
    process.exit(1);
  }
}

const pwd = process.env.ADMIN_PASSWORD!;
if (pwd.length < 8 || /^(admin|password|12345)/i.test(pwd)) {
  console.warn('WARNING: ADMIN_PASSWORD is weak. Use a strong password (8+ chars, mixed case, numbers).');
}

if (!process.env.SCAN_RESET_PASSWORD) {
  console.warn('WARNING: SCAN_RESET_PASSWORD not set. Scan reset feature will be unavailable.');
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
