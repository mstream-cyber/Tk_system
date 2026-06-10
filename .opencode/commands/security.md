---
description: Run comprehensive security review
agent: security-reviewer
subtask: true
---

# Security Review Command

Conduct a comprehensive security review: $ARGUMENTS

## Your Task

Analyze the specified code for security vulnerabilities following OWASP guidelines.

## Security Checklist

### OWASP Top 10
1. **Injection** - Parameterized queries? File upload magic bytes?
2. **Broken Authentication** - JWT validation? Admin password in env?
3. **Sensitive Data Exposure** - service_role key server-side only?
4. **XXE** - Any XML parsing?
5. **Broken Access Control** - authMiddleware on admin routes?
6. **Security Misconfiguration** - Helmet? Rate limiting? CORS?
7. **XSS** - React auto-escaping sufficient? Email templates safe?
8. **Insecure Deserialization** - Any JSON.parse on user input?
9. **Known Vulnerabilities** - npm audit results?
10. **Insufficient Logging** - Security events logged?

### Additional Checks
- Secrets in code (API keys, passwords)
- Environment variable handling
- CORS configuration
- Rate limiting active
- Secure file upload validation

## Report Format

### Critical Issues
[Issues that must be fixed immediately]

### High Priority
[Issues that should be fixed before release]

### Recommendations
[Security improvements to consider]

---

**IMPORTANT**: Security issues are blockers. Do not proceed until critical issues are resolved.
