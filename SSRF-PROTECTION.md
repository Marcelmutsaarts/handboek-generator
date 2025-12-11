# SSRF Protection Implementation

## Overview

The `verify-sources` API endpoint has been hardened against Server-Side Request Forgery (SSRF) attacks and abuse. This document explains the protections, their limitations, and how to test them.

## What is SSRF?

Server-Side Request Forgery (SSRF) is a vulnerability where an attacker can make the server send requests to unintended locations, such as:
- Internal network resources (localhost, private IPs)
- Cloud metadata endpoints (AWS: 169.254.169.254, GCP, Azure)
- Internal services not exposed to the internet
- Sensitive file paths via file:// protocol

## Implemented Protections

### 1. URL Validation

#### HTTPS-Only Enforcement
- **Protection**: Only `https://` URLs are accepted
- **Blocks**: `http://`, `ftp://`, `file://`, `gopher://`, etc.
- **Why**: Prevents protocol smuggling and ensures encrypted connections

```typescript
// ✅ Allowed
https://example.com

// ❌ Blocked
http://example.com
file:///etc/passwd
ftp://internal-server
```

#### Credential Rejection
- **Protection**: URLs with usernames/passwords are rejected
- **Why**: Prevents credential leakage and authentication bypass attempts

```typescript
// ❌ Blocked
https://admin:password@internal-service
https://user@localhost
```

#### Length Validation
- **Protection**: URLs longer than 2048 characters are rejected
- **Why**: Prevents DoS attacks and excessive resource usage

### 2. Private Network Protection

#### IP Address Blocking

Blocks direct IP literals in private/internal ranges:

| Range | Description | Examples |
|-------|-------------|----------|
| `127.0.0.0/8` | Loopback | 127.0.0.1, 127.0.0.2 |
| `10.0.0.0/8` | Private Class A | 10.0.0.1, 10.255.255.255 |
| `172.16.0.0/12` | Private Class B | 172.16.0.1, 172.31.255.255 |
| `192.168.0.0/16` | Private Class C | 192.168.0.1, 192.168.255.255 |
| `169.254.0.0/16` | Link-local | 169.254.169.254 (AWS metadata!) |
| `0.0.0.0/8` | Current network | 0.0.0.0 |
| `::1` | IPv6 loopback | ::1 |
| `fc00::/7` | IPv6 unique local | fc00::1, fd00::1 |
| `fe80::/10` | IPv6 link-local | fe80::1 |
| `ff00::/8` | IPv6 multicast | ff02::1 |

```typescript
// ❌ All blocked
https://127.0.0.1
https://192.168.1.1
https://169.254.169.254  // AWS metadata endpoint
https://[::1]
```

#### DNS Resolution Checks

Even if a hostname looks public, we resolve it via DNS and check ALL returned IPs:

```typescript
// Example: malicious.example.com → 127.0.0.1
// ❌ Blocked because DNS resolution returns private IP
```

**Why this matters**: An attacker might register a domain that resolves to a private IP, bypassing naive hostname checks.

**Protection**: If ANY IP in the DNS response is private, the request is blocked.

### 3. Request Limits

#### Per-Request Limits
- **Max URLs**: 10 sources per request
- **Why**: Prevents bulk abuse and resource exhaustion

#### Rate Limiting
- **Limit**: 10 requests per IP per minute
- **Implementation**: In-memory fixed window
- **Response**: HTTP 429 with `Retry-After` header

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again in 45 seconds."
}
```

#### Concurrency Limiting
- **Limit**: 3 parallel fetches at a time
- **Why**: Prevents overwhelming external servers or our own resources
- **Implementation**: Batched processing with Promise.all

### 4. Safe Fetching

#### HEAD-First Strategy
1. Try HEAD request (no body download)
2. If HEAD fails, fallback to GET with `Range: bytes=0-0`
3. Never download full response bodies

**Why**: Minimizes bandwidth and prevents DoS via large responses

#### Strict Timeouts
- **Per-URL timeout**: 5 seconds
- **Total endpoint timeout**: 30 seconds
- **Implementation**: AbortController

#### Redirect Limiting
- **Max redirects**: 2
- **Why**: Prevents redirect loops and time-of-check-time-of-use (TOCTOU) attacks

**Attack scenario prevented**:
1. Attacker URL: `https://evil.com/redirect`
2. Redirect 1: → `https://another.com/redirect2`
3. Redirect 2: → `https://127.0.0.1` ❌ (would be blocked before following)

#### Manual Redirect Handling
- Redirects are handled manually, not automatically
- Each redirect target is re-validated through SSRF checks
- Prevents bypassing protections via redirects

### 5. Error Handling

#### No Internal Details Exposed
```typescript
// ❌ Bad (leaks internals)
{ error: "ECONNREFUSED connecting to 10.0.0.1:3306" }

// ✅ Good (safe)
{ error: "Network error" }
```

**Implementation**: All errors are sanitized to generic messages. Stack traces are logged server-side only.

## Response Format

```typescript
interface VerificationResult {
  url: string;              // Original URL
  title: string;            // Source title
  ok: boolean;              // Success status
  status: number;           // HTTP status code (0 if blocked)
  finalUrl: string;         // URL after redirects
  error?: string;           // Error message (if failed)
  isTrustedDomain: boolean; // Trusted domain flag
}
```

## Known Limitations

### 1. DNS Rebinding Attacks

**Attack**: An attacker controls DNS and can change A/AAAA records rapidly:
1. First DNS lookup: Returns public IP (passes validation)
2. Between validation and fetch: DNS changes to private IP
3. Fetch goes to private IP

**Mitigation**:
- We check DNS immediately before fetch
- Short-lived DNS cache in OS
- Consider: Re-resolve DNS right before fetch (not yet implemented)

### 2. Time-of-Check-Time-of-Use (TOCTOU)

**Attack**: Race condition between validation and fetch

**Current Mitigation**:
- Validation and fetch are close together in time
- DNS is re-checked for each redirect

**Additional Defense**: Consider using a single DNS resolution that's cached and used for both validation and fetch

### 3. Cloud Metadata Endpoints

**Partial Protection**: We block known metadata IPs (169.254.169.254), but cloud providers may have other endpoints.

**Additional Protections Recommended**:
- Network-level egress filtering
- IMDSv2 (AWS) with token requirements
- Workload Identity (GCP)

### 4. Application-Layer Bypasses

**Not Protected Against**:
- CRLF injection in URLs (handled by URL parser)
- Protocol smuggling (mitigated by HTTPS-only)
- Vulnerabilities in external sites being verified

**Defense in Depth**: This is just one layer. Use firewalls, VPCs, and principle of least privilege.

### 5. Single-Instance Rate Limiting

**Current Implementation**: In-memory rate limiter

**Limitation**: Won't work across multiple server instances (serverless, Kubernetes)

**Production Recommendation**: Use Redis, Upstash, or Vercel KV for distributed rate limiting

## Testing

### Automated Tests

Run unit tests:
```bash
npm test src/lib/__tests__/urlSafety.test.ts
```

### Manual Testing

1. **Browser Test Page**:
   Visit `http://localhost:3000/test-ssrf` after running `npm run dev`
   - Click "Run Automated Tests"
   - Tests both dangerous and safe URLs
   - Shows pass/fail for each test case

2. **Command Line**:
   ```bash
   curl -X POST http://localhost:3000/api/verify-sources \
     -H "Content-Type: application/json" \
     -d '{"sources":[{"title":"Test","url":"https://127.0.0.1"}]}'
   ```

   Expected response:
   ```json
   {
     "results": [{
       "ok": false,
       "error": "Private/internal IP addresses are not allowed"
     }]
   }
   ```

### Test Cases

#### Must Be Blocked
- ✓ `https://127.0.0.1`
- ✓ `https://localhost`
- ✓ `https://10.0.0.1`
- ✓ `https://192.168.1.1`
- ✓ `https://169.254.169.254` (AWS metadata)
- ✓ `https://[::1]`
- ✓ `http://example.com` (not HTTPS)
- ✓ `https://user:pass@example.com` (credentials)
- ✓ URLs > 2048 characters

#### Must Be Allowed
- ✓ `https://example.com`
- ✓ `https://wikipedia.org`
- ✓ `https://google.com`
- ✓ Public HTTPS URLs

## Files Changed

### New Files
- `src/lib/urlSafety.ts` - URL validation and SSRF protection utilities
- `src/lib/rateLimiter.ts` - In-memory rate limiting
- `src/lib/__tests__/urlSafety.test.ts` - Comprehensive unit tests
- `src/app/test-ssrf/page.tsx` - Manual testing interface
- `SSRF-PROTECTION.md` - This documentation

### Modified Files
- `src/app/api/verify-sources/route.ts` - Updated with SSRF protections
  - Changed runtime from `edge` to `nodejs` (needed for DNS APIs)
  - Added URL validation, rate limiting, concurrency control
  - Improved error handling and response format

## Runtime Change: Edge → Node.js

**Why the change?**
The route now uses `runtime = 'nodejs'` instead of `'edge'` because:
1. DNS resolution requires Node.js `dns` module (not available in Edge)
2. Net/IP parsing utilities need Node.js APIs

**Tradeoffs**:
- ✅ **Pros**: Full DNS resolution, better SSRF protection
- ❌ **Cons**: Slightly higher cold start latency
- ⚖️ **Impact**: Minimal - verification is not on critical path

## Production Deployment Checklist

- [ ] Run all tests: `npm test`
- [ ] Test in dev: Visit `/test-ssrf` and verify all tests pass
- [ ] Review rate limits for your traffic patterns
- [ ] Consider distributed rate limiting (Redis/Upstash) for multi-instance deployments
- [ ] Set up monitoring/alerting for failed verifications
- [ ] Enable egress filtering at network level (defense-in-depth)
- [ ] Review firewall rules to block private IP ranges
- [ ] Consider adding Content-Security-Policy headers
- [ ] Monitor for abuse patterns in logs

## Monitoring Recommendations

### Metrics to Track
- Request rate per IP
- Blocked URL attempts (by category: private IP, credentials, etc.)
- Rate limit hits
- Average verification time
- Success/failure ratios

### Alerts
- Spike in blocked requests (potential attack)
- High rate limit violations
- Unusually long verification times
- Errors in DNS resolution

### Logging
```typescript
// Already implemented server-side
console.error('Verify sources error:', error);
```

**What to log** (already done):
- Errors and exceptions
- Rate limit violations
- Blocked URLs (categorized by reason)

**What NOT to log** (privacy):
- Full request bodies
- Client IP addresses in public logs
- Internal error stack traces

## Security Contacts

If you discover a security vulnerability:
1. **Do not** open a public issue
2. Email: [Your security contact]
3. Use responsible disclosure practices

## References

- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PortSwigger SSRF](https://portswigger.net/web-security/ssrf)
- [RFC 1918 - Private IP Ranges](https://datatracker.ietf.org/doc/html/rfc1918)
- [AWS IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)

## Version History

### v2.0.0 - SSRF Hardening (Current)
- Added comprehensive SSRF protections
- Implemented DNS resolution checks
- Added rate limiting and concurrency control
- Changed runtime to Node.js
- Created test suite and documentation

### v1.0.0 - Initial Implementation
- Basic URL reachability checking
- Trusted domain flagging
- Simple timeout handling
