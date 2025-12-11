# Slug Security Implementation

## Overview

The `upload-public-html` API endpoint has been hardened against path traversal and injection attacks through strict slug validation. This document explains the security measures, attack scenarios prevented, and how to test them.

## What Are Slug Injection Attacks?

Slugs are user-provided identifiers used in file paths and URLs. Without proper validation, attackers can manipulate slugs to:
- **Path Traversal**: Access files outside the intended directory (`../../../etc/passwd`)
- **Directory Injection**: Create/access subdirectories (`admin/settings`)
- **Encoding Bypasses**: Use URL encoding to bypass filters (`%2f` = `/`)
- **Overwrite Critical Files**: Replace system or application files

## Attack Scenarios Prevented

### 1. Path Traversal
**Attack**: `../../../etc/passwd`
**Goal**: Access sensitive files outside the uploads directory
**Prevention**: Block any slug containing `..`

### 2. Directory Injection
**Attack**: `user/admin/settings`
**Goal**: Create nested directories or access subdirectories
**Prevention**: Block `/` and `\` characters

### 3. Encoded Path Separators
**Attack**: `user%2fadmin` (where `%2f` = `/`)
**Goal**: Bypass simple filters using URL encoding
**Prevention**: Block `%2f` and `%5c` (case-insensitive), plus any `%` character

### 4. Double Encoding
**Attack**: `user%252fadmin` (where `%252f` = `%2f` = `/`)
**Goal**: Bypass decoders that only decode once
**Prevention**: Block all percent-encoded characters

### 5. Whitespace Injection
**Attack**: `user admin` or `user\tadmin`
**Goal**: Cause parsing errors or bypass filters
**Prevention**: Block all whitespace characters

### 6. Special Character Injection
**Attack**: `user__admin`, `user@admin`, `user$admin`
**Goal**: Inject shell metacharacters or break parsing
**Prevention**: Allow only `a-z`, `0-9`, and `-`

## Implemented Protections

### Validation Rules

All slugs must satisfy these rules:

| Rule | Description | Example Valid | Example Invalid |
|------|-------------|---------------|-----------------|
| **Lowercase only** | Only `a-z` letters | `geschiedenis` | `Geschiedenis` |
| **Allowed characters** | `a-z`, `0-9`, `-` only | `vmbo-1` | `vmbo_1`, `vmbo@1` |
| **Max length** | 60 characters max | `geschiedenis-vmbo1` | `a` × 61 |
| **Start position** | Must start with letter or number | `1-test`, `a-test` | `-test`, `_test` |
| **End position** | Cannot end with hyphen | `test-1` | `test-` |
| **No path separators** | No `/` or `\` | `test-abc` | `test/abc`, `test\abc` |
| **No encoding** | No `%` characters | `test-123` | `test%20abc` |
| **No traversal** | No `..` | `test-2` | `test..2`, `../test` |
| **No whitespace** | No spaces, tabs, newlines | `test-abc` | `test abc`, `test\tabc` |
| **No consecutive hyphens** | No `--` | `test-1-2` | `test--1` |

### Implementation

#### Helper Module: `src/lib/slug.ts`

```typescript
// Strict validation (throws on invalid)
assertValidSlug(slug: string): void

// Normalize user input to safe slug
normalizeSlug(input: string): string

// Check validity without throwing
isValidSlug(slug: string): boolean

// Self-test function
testSlugValidation(): { passed: boolean; results: TestResult[] }
```

#### API Route: `src/app/api/upload-public-html/route.ts`

Both `POST` and `DELETE` handlers validate slugs before any file operations:

```typescript
// Validate slug for security
try {
  assertValidSlug(slug);
} catch (error) {
  return NextResponse.json(
    { error: error.message },
    { status: 400 }
  );
}
```

### Storage Path Safety

All file paths use validated slugs in predictable formats:

```typescript
// HTML file
const fileName = `${slug}.html`;

// Image files
const fileName = `${slug}/img-${i}.${ext}`;
```

**Key Safety Features:**
- No dynamic path segments beyond the slug
- Slug is validated before path construction
- Extension is controlled by the application (`.html`, `.png`, etc.)
- File index (`i`) is a number controlled by the loop
- No user input directly concatenated into paths

## Validation Flow

```
User Input → assertValidSlug() → File Operations
     ↓              ↓                     ↓
   "foo"         Pass ✅              foo.html
   "../x"        Fail ❌              [Rejected]
   "a/b"         Fail ❌              [Rejected]
   "a%2fb"       Fail ❌              [Rejected]
```

## Testing

### Automated Tests

Run unit tests:
```bash
npm test src/lib/__tests__/slug.test.ts
```

The test suite covers:
- ✅ Path traversal attempts (`../x`, `../../etc/passwd`)
- ✅ Directory injection (`a/b`, `user/admin`)
- ✅ Encoded separators (`a%2fb`, `a%5cb`)
- ✅ Whitespace (`a b`, `a\tb`)
- ✅ Invalid characters (`a__b`, `a@b`, `a#b`)
- ✅ Position rules (`-start`, `end-`)
- ✅ Case sensitivity (`UPPERCASE`)
- ✅ Length limits (empty, >60 chars)
- ✅ Valid slugs (`geschiedenis-vmbo1`)

### Browser Testing

Visit `http://localhost:3000/test-slug` after running `npm run dev`

Features:
- Automated test results display
- Custom slug validation
- Slug normalization demo
- Visual pass/fail indicators
- Security rules documentation

### Manual API Testing

```bash
# Should be REJECTED (path traversal)
curl -X POST http://localhost:3000/api/upload-public-html \
  -H "Content-Type: application/json" \
  -d '{"slug":"../etc/passwd","html":"<html></html>"}'

# Expected: 400 Bad Request
# {"error":"Slug cannot contain \"..\" (path traversal attempt)"}

# Should be REJECTED (directory injection)
curl -X POST http://localhost:3000/api/upload-public-html \
  -H "Content-Type: application/json" \
  -d '{"slug":"user/admin","html":"<html></html>"}'

# Expected: 400 Bad Request
# {"error":"Slug cannot contain forward slashes (/)"}

# Should be ACCEPTED
curl -X POST http://localhost:3000/api/upload-public-html \
  -H "Content-Type: application/json" \
  -d '{"slug":"geschiedenis-vmbo1","html":"<html></html>"}'

# Expected: 200 OK (if authenticated)
# {"success":true,"url":"...","imageUrlMap":{}}
```

## Test Cases

### Must Be Blocked ❌

| Slug | Reason | Error Message |
|------|--------|---------------|
| `../x` | Path traversal | Cannot contain ".." |
| `../../etc/passwd` | Path traversal | Cannot contain ".." |
| `a/b` | Directory injection | Cannot contain forward slashes |
| `a\b` | Backslash separator | Cannot contain backslashes |
| `a%2fb` | Encoded slash | Cannot contain encoded path separators |
| `a%2Fb` | Encoded slash (uppercase) | Cannot contain encoded path separators |
| `a%5cb` | Encoded backslash | Cannot contain encoded path separators |
| `a%20b` | Percent encoding | Cannot contain percent-encoded characters |
| `a b` | Whitespace | Cannot contain whitespace |
| `a\tb` | Tab character | Cannot contain whitespace |
| `a__b` | Double underscore | Contains invalid characters: _ |
| `a_b` | Underscore | Contains invalid characters: _ |
| `-start` | Starts with hyphen | Must start with a letter or number |
| `end-` | Ends with hyphen | Cannot end with a hyphen |
| `UPPERCASE` | Not lowercase | Must be lowercase |
| `a--b` | Consecutive hyphens | Cannot contain consecutive hyphens |
| `` (empty) | Empty string | Slug cannot be empty |
| `a` × 61 | Too long | Slug is too long (max 60 characters) |

### Must Be Allowed ✅

| Slug | Description |
|------|-------------|
| `geschiedenis-vmbo1` | Standard slug |
| `wiskunde-havo-3` | With numbers |
| `natuur-en-techniek` | Multiple hyphens |
| `a` | Single letter |
| `1` | Single number |
| `a1b2c3` | Alphanumeric |
| `test-123` | Mixed with hyphen |
| `a` × 60 | Maximum length |

## Normalization (Optional)

The `normalizeSlug()` function converts user-friendly input to safe slugs:

```typescript
normalizeSlug("Geschiedenis VMBO 1")  → "geschiedenis-vmbo-1"
normalizeSlug("Natuur & Techniek")     → "natuur-techniek"
normalizeSlug("Wiskunde__A")           → "wiskunde-a"
normalizeSlug("  Hello World  ")       → "hello-world"
```

**Use Cases:**
- User-facing forms where slugs are auto-generated
- Migration scripts cleaning up legacy data
- Import/export tools

**Important:** Normalization still enforces strict validation. If the normalized result would be invalid, it throws an error.

## Security Checklist

- [x] Slug validation in POST handler
- [x] Slug validation in DELETE handler
- [x] Validation before any file operations
- [x] No user input directly in file paths
- [x] Path separators blocked (/, \, %2f, %5c)
- [x] Path traversal blocked (..)
- [x] Encoding blocked (%)
- [x] Whitespace blocked
- [x] Special characters blocked
- [x] Length limits enforced
- [x] Position rules enforced
- [x] Comprehensive test coverage
- [x] Browser test interface
- [x] Error messages don't leak information

## Known Limitations

### 1. Unicode Normalization
**Current**: Only allows `a-z`, `0-9`, `-` (ASCII)
**Limitation**: International characters (é, ñ, 中) are rejected
**Workaround**: Use `normalizeSlug()` to convert to ASCII-safe format
**Future**: Could support Unicode with stricter normalization

### 2. Race Conditions
**Current**: Slug validation happens once at request time
**Limitation**: Theoretical TOCTOU (time-of-check-time-of-use) if slug could change
**Impact**: Minimal - slugs are immutable after validation
**Mitigation**: Slugs are copied to local variables before use

### 3. Storage Backend Trust
**Current**: Assumes Supabase Storage correctly handles paths
**Limitation**: If storage has path traversal bugs, slugs alone won't protect
**Defense-in-Depth**: Use storage permissions, network isolation, principle of least privilege

### 4. Collision Handling
**Current**: No automatic collision detection
**Limitation**: Two users could theoretically use the same slug
**Mitigation**: Application logic prevents this (slugs are per-handboek, checked in DB)

## Response Structure

The validation doesn't change the API response structure:

### Success Response (Unchanged)
```typescript
{
  "success": true,
  "url": "https://storage.url/slug.html",
  "imageUrlMap": {
    "data:image/png;base64,..." : "https://storage.url/slug/img-0.png"
  }
}
```

### New Error Response (Invalid Slug)
```typescript
{
  "error": "Slug cannot contain forward slashes (/)"
}
// Status: 400 Bad Request
```

## Files Changed

### New Files
- `src/lib/slug.ts` - Slug validation utilities (200+ lines)
- `src/lib/__tests__/slug.test.ts` - Comprehensive tests (400+ lines)
- `src/app/test-slug/page.tsx` - Browser test interface (300+ lines)
- `SLUG-SECURITY.md` - This documentation

### Modified Files
- `src/app/api/upload-public-html/route.ts` - Added slug validation
  - Line 3: Import `assertValidSlug`
  - Lines 31-41: POST handler validation
  - Lines 143-153: DELETE handler validation

**Total**: ~900 lines added

## Production Deployment

### Pre-Deploy Checklist
- [ ] Run tests: `npm test src/lib/__tests__/slug.test.ts`
- [ ] Visit `/test-slug` and verify all tests pass
- [ ] Test with real slugs in dev environment
- [ ] Review any existing public handboeken for slug compliance
- [ ] Plan migration for any non-compliant existing slugs

### Monitoring
Track these metrics:
- Invalid slug attempts (potential attacks)
- Most common validation failures
- Slug normalization usage

### Alerts
Set up alerts for:
- Spike in validation failures (potential attack)
- Path traversal attempts (`..` in slugs)
- Encoded separator attempts (`%2f`, `%5c`)

## Migration Guide

If you have existing handboeken with non-compliant slugs:

### Check Compliance
```typescript
import { isValidSlug } from '@/lib/slug';

const existingSlugs = [...]; // from database
const nonCompliant = existingSlugs.filter(s => !isValidSlug(s));

console.log('Non-compliant slugs:', nonCompliant);
```

### Fix Non-Compliant Slugs
```typescript
import { normalizeSlug } from '@/lib/slug';

for (const oldSlug of nonCompliant) {
  const newSlug = normalizeSlug(oldSlug);
  // Update database
  // Rename files in storage
  // Update public URLs
}
```

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [URL Encoding Reference](https://www.w3schools.com/tags/ref_urlencode.asp)

## Version History

### v1.0.0 - Slug Security Hardening (Current)
- Added strict slug validation
- Created slug validation utilities
- Added comprehensive test suite
- Created browser test interface
- Documentation created

### v0.x.x - Initial Implementation (Before)
- No slug validation
- Vulnerable to path traversal
- Vulnerable to directory injection
