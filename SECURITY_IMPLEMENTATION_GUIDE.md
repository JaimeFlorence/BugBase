# Security Implementation Guide for BugBase

## Overview
This guide provides step-by-step instructions for implementing the security hardening features in BugBase. All security components have been created and are ready to be integrated into your application.

## 🚀 Quick Start Integration

### 1. Install Required Dependencies

```bash
cd backend
npm install bcryptjs speakeasy qrcode isomorphic-dompurify jsdom validator zod helmet compression
npm install --save-dev @types/bcryptjs @types/speakeasy @types/qrcode @types/validator
```

### 2. Update Your Main Application File

Replace or update your `backend/src/index.ts`:

```typescript
import express from 'express';
import { setupSecurity } from './app.security';

const app = express();

// Setup all security middleware
async function initializeApp() {
  // Apply security configuration
  const security = await setupSecurity(app);
  
  // Your routes here
  app.use('/api/auth', authRoutes);
  app.use('/api/bugs', bugRoutes);
  // ... other routes
  
  // Error handler (must be last)
  app.use(errorHandler);
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

initializeApp().catch(console.error);
```

### 3. Update Route Files

Example for bug routes with security:

```typescript
import { Router } from 'express';
import { validate, bugSchemas } from '../middleware/validation.middleware';
import { rateLimiters } from '../middleware/rate-limit.middleware';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Create bug with validation
router.post('/',
  rateLimiters.write,
  validate({ body: bugSchemas.create }),
  BugController.createBug
);

// Get bugs with validation and rate limiting
router.get('/',
  rateLimiters.read,
  validate({ query: bugSchemas.filters }),
  BugController.getBugs
);
```

## 📋 Security Features Implementation

### 1. Input Validation

All input validation is handled by Zod schemas in `validation.middleware.ts`:

```typescript
// Use in routes
import { validate, bugSchemas } from './middleware/validation.middleware';

router.post('/bugs',
  validate({ body: bugSchemas.create }),
  createBugHandler
);
```

Features:
- Automatic sanitization of all inputs
- XSS prevention
- SQL injection prevention
- Type validation
- Length limits
- Format validation

### 2. CSRF Protection

CSRF tokens are automatically handled:

```typescript
// Frontend implementation
// Get CSRF token from cookie
const csrfToken = getCookie('XSRF-TOKEN');

// Include in requests
fetch('/api/bugs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': csrfToken
  },
  body: JSON.stringify(data)
});
```

### 3. Rate Limiting

Different limits for different operations:

```typescript
// Authentication endpoints (strict)
router.post('/login', rateLimiters.auth, loginHandler);

// Read operations (lenient)
router.get('/bugs', rateLimiters.read, getBugsHandler);

// Write operations (moderate)
router.post('/bugs', rateLimiters.write, createBugHandler);

// File uploads (very strict)
router.post('/upload', rateLimiters.upload, uploadHandler);
```

### 4. Security Headers

Automatically applied based on environment. In production:
- Content Security Policy
- HSTS (Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- And more...

### 5. XSS Protection

Three layers of protection:
1. Input sanitization (automatic)
2. Output encoding (automatic)
3. Content Security Policy

```typescript
// For rich text content, specify mode
app.use(xssProtection({
  mode: 'rich', // or 'strict', 'basic', 'markdown'
}));
```

### 6. Authentication Security

Enhanced authentication with:
- Password strength checking
- Account lockout protection
- Two-factor authentication
- Suspicious login detection

```typescript
// Password strength check
const strength = AuthSecurityService.checkPasswordStrength(password);
if (!strength.isStrong) {
  return res.status(400).json({
    error: 'Password not strong enough',
    feedback: strength.feedback
  });
}

// Setup 2FA
const { secret, qrCode } = await AuthSecurityService.setupTwoFactor(userId);

// Verify 2FA token
const isValid = AuthSecurityService.verifyTwoFactorToken(secret, token);
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Security
SESSION_SECRET=your-session-secret-here
PASSWORD_PEPPER=your-password-pepper-here
COOKIE_SECRET=your-cookie-secret-here

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting (optional - uses defaults if not set)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (for distributed rate limiting)
REDIS_URL=redis://localhost:6379
```

## 🧪 Testing Security Features

### 1. Test Input Validation

```bash
# Should fail - missing required fields
curl -X POST http://localhost:3000/api/bugs \
  -H "Content-Type: application/json" \
  -d '{}'

# Should fail - XSS attempt
curl -X POST http://localhost:3000/api/bugs \
  -H "Content-Type: application/json" \
  -d '{"title": "<script>alert(1)</script>"}'
```

### 2. Test Rate Limiting

```bash
# Make multiple requests quickly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "wrong"}'
done
# Should get 429 Too Many Requests after 5 attempts
```

### 3. Test CSRF Protection

```bash
# Should fail without CSRF token
curl -X POST http://localhost:3000/api/bugs \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}'
```

### 4. Check Security Headers

```bash
curl -I http://localhost:3000
# Should see security headers like:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# etc.
```

## 📊 Monitoring Security

### 1. Security Events Logging

Security events are automatically logged:
- Failed login attempts
- Account lockouts
- Suspicious logins
- Password resets
- Permission denials

### 2. Metrics to Monitor

- Failed login attempts per user
- Rate limit violations
- CSRF token failures
- XSS attempts blocked
- Suspicious IP addresses

### 3. Security Alerts

Implement alerts for:
- Multiple failed login attempts
- Login from new location
- Concurrent sessions from different locations
- Repeated rate limit violations

## 🚨 Incident Response

### If Security Breach Detected:

1. **Immediate Actions**
   - Block suspicious IPs: `ipBlocker.blockIP(ipAddress)`
   - Force logout affected users
   - Reset all sessions if widespread

2. **Investigation**
   - Check security logs
   - Review recent authentication attempts
   - Analyze request patterns

3. **Remediation**
   - Force password reset for affected users
   - Review and update security rules
   - Patch any vulnerabilities found

## 📝 Security Best Practices

### Development
1. Never commit secrets to version control
2. Use environment variables for sensitive data
3. Keep dependencies updated
4. Run security audits regularly: `npm audit`

### Deployment
1. Use HTTPS everywhere
2. Enable all security headers in production
3. Configure firewall rules
4. Use a WAF (Web Application Firewall)
5. Regular security updates

### Ongoing Maintenance
1. Review security logs daily
2. Update dependencies weekly
3. Perform security audits monthly
4. Penetration testing quarterly

## 🔄 Migration Guide

### From Existing System

1. **Phase 1**: Add security headers and rate limiting
2. **Phase 2**: Implement input validation
3. **Phase 3**: Add CSRF protection
4. **Phase 4**: Enhance authentication security
5. **Phase 5**: Full security audit

### Breaking Changes
- All inputs now validated - ensure frontend sends correct data types
- CSRF tokens required for state-changing operations
- Rate limits may affect automated scripts
- Stricter password requirements

## 📚 Additional Resources

- [OWASP Security Guidelines](https://owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## 🆘 Troubleshooting

### Common Issues

1. **"CSRF token missing"**
   - Ensure cookies are enabled
   - Include X-XSRF-TOKEN header
   - Check CORS configuration

2. **"Too many requests"**
   - Rate limit exceeded
   - Wait for reset time
   - Check Retry-After header

3. **"Invalid input"**
   - Check validation errors in response
   - Ensure data types match schema
   - Remove any HTML from inputs

## ✅ Security Checklist

Before going to production:

- [ ] All routes have authentication
- [ ] All inputs are validated
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Security headers active
- [ ] HTTPS configured
- [ ] Secrets in environment variables
- [ ] Error messages don't leak information
- [ ] Security logging enabled
- [ ] Incident response plan ready

---

**Remember**: Security is an ongoing process, not a one-time implementation. Regularly review and update your security measures.