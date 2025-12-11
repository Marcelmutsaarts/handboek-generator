# Slug Security Implementation - Quick Summary

## ✅ Completed

All requirements for slug hardening have been implemented in the `upload-public-html` API endpoint.

## 📦 Deliverables

### 1. Helper Module
**File**: `src/lib/slug.ts` (200+ lines)

Core functions:
- `assertValidSlug(slug: string): void` - Strict validation (throws on invalid)
- `normalizeSlug(input: string): string` - Convert user input to safe slug
- `isValidSlug(slug: string): boolean` - Check without throwing
- `testSlugValidation()` - Self-test function

### 2. Updated API Route
**File**: `src/app/api/upload-public-html/route.ts`

Added validation in:
- **POST handler** (line 31-41): Validates slug before file uploads
- **DELETE handler** (line 143-153): Validates slug before file deletion

Response structure unchanged for valid requests - maintains backward compatibility.

### 3. Comprehensive Tests
**Unit Tests**: `src/lib/__tests__/slug.test.ts` (400+ lines)
- Tests all attack scenarios
- Tests all validation rules
- Tests normalization function
- Manual test runner included

**Browser Test Page**: `src/app/test-slug/page.tsx` (300+ lines)
- Interactive testing interface
- Automated test suite display
- Custom slug validation tool
- Normalization demo

### 4. Documentation
- **SLUG-SECURITY.md** - Complete security documentation (600+ lines)
- **Updated CLAUDE.md** - Added Slug Validation section

## 🔒 Security Features

### Validation Rules

| Rule | Example Valid | Example Invalid |
|------|---------------|-----------------|
| Lowercase only | `geschiedenis` | `Geschiedenis` |
| Allowed chars: a-z, 0-9, - | `vmbo-1` | `vmbo_1`, `vmbo@1` |
| Max 60 characters | `test-123` | `a` × 61 |
| Start with letter/number | `1-test`, `a-test` | `-test` |
| Cannot end with hyphen | `test-1` | `test-` |
| No path separators | `test-abc` | `test/abc`, `test\abc` |
| No encoding | `test-123` | `test%20abc` |
| No path traversal | `test-2` | `test..2`, `../test` |
| No whitespace | `test-abc` | `test abc` |
| No consecutive hyphens | `test-1-2` | `test--1` |

### Attack Scenarios Blocked

1. ✅ **Path Traversal**: `../../../etc/passwd`
2. ✅ **Directory Injection**: `user/admin`
3. ✅ **Encoded Slashes**: `a%2fb`, `a%5cb`
4. ✅ **Double Encoding**: `a%252fb`
5. ✅ **Whitespace**: `a b`, `a\tb`
6. ✅ **Special Characters**: `a__b`, `a@b`, `a#b`
7. ✅ **Position Attacks**: `-start`, `end-`
8. ✅ **Case Bypasses**: `UPPERCASE`

### Storage Path Safety

All file paths use validated slugs in safe formats:

```typescript
// HTML file
`${slug}.html`  // e.g., "geschiedenis-vmbo1.html"

// Image files
`${slug}/img-${i}.png`  // e.g., "geschiedenis-vmbo1/img-0.png"
```

**Key Safety Features:**
- Slug validated before path construction
- No dynamic path segments beyond slug
- Extensions controlled by application
- File index is numeric loop counter
- No user input directly in paths

## 🧪 How to Verify

### Quick Test (30 seconds)
```bash
# Run unit tests
npm test src/lib/__tests__/slug.test.ts

# Expected: All tests pass
```

### Browser Test (2 minutes)
```bash
# 1. Start dev server
npm run dev

# 2. Visit test page
open http://localhost:3000/test-slug

# 3. Expected: All automated tests show green checkmarks ✅

# 4. Try custom slugs:
#    - "geschiedenis-vmbo1" → ✅ Valid
#    - "../etc/passwd" → ❌ Blocked
#    - "a/b" → ❌ Blocked
```

### Manual API Test
```bash
# Should be BLOCKED (path traversal)
curl -X POST http://localhost:3000/api/upload-public-html \
  -H "Content-Type: application/json" \
  -d '{"slug":"../x","html":"<html></html>"}'

# Expected: 400 Bad Request
# {"error":"Slug cannot contain \"..\" (path traversal attempt)"}

# Should be BLOCKED (directory injection)
curl -X POST http://localhost:3000/api/upload-public-html \
  -H "Content-Type: application/json" \
  -d '{"slug":"a/b","html":"<html></html>"}'

# Expected: 400 Bad Request
# {"error":"Slug cannot contain forward slashes (/)"}

# Should be ALLOWED
curl -X POST http://localhost:3000/api/upload-public-html \
  -H "Content-Type: application/json" \
  -d '{"slug":"geschiedenis-vmbo1","html":"<html></html>"}'

# Expected: 200 OK (if authenticated)
# {"success":true,"url":"...","imageUrlMap":{}}
```

## 📊 Test Coverage

### Slugs That Must Be Blocked ❌
- [x] `../x` - Path traversal
- [x] `a/b` - Directory injection
- [x] `a%2fb` - Encoded forward slash
- [x] `a%5cb` - Encoded backslash
- [x] `a b` - Whitespace
- [x] `a__b` - Double underscore
- [x] `a..b` - Double dots
- [x] `-start` - Starts with hyphen
- [x] `end-` - Ends with hyphen
- [x] `UPPERCASE` - Not lowercase
- [x] `a--b` - Consecutive hyphens

### Slugs That Must Be Allowed ✅
- [x] `geschiedenis-vmbo1` - Standard valid slug
- [x] `wiskunde-havo-3` - With numbers
- [x] `natuur-en-techniek` - Multiple hyphens
- [x] `a` - Single letter
- [x] `1` - Single number
- [x] `test-123` - Mixed alphanumeric

## 📁 Files Changed

### New Files (4)
1. `src/lib/slug.ts` - Validation utilities
2. `src/lib/__tests__/slug.test.ts` - Unit tests
3. `src/app/test-slug/page.tsx` - Browser test page
4. `SLUG-SECURITY.md` - Comprehensive docs

### Modified Files (2)
1. `src/app/api/upload-public-html/route.ts` - Added validation
2. `CLAUDE.md` - Added Slug Validation section

### Documentation (2)
1. `SLUG-SECURITY.md` - Complete security documentation
2. `SLUG-SECURITY-SUMMARY.md` - This file

**Total**: ~900 lines added

## 🎯 Quick Reference

### Validation Function
```typescript
import { assertValidSlug } from '@/lib/slug';

try {
  assertValidSlug(userInput);
  // Slug is safe to use
} catch (error) {
  // Slug is invalid
  console.error(error.message);
}
```

### Normalization (Optional)
```typescript
import { normalizeSlug } from '@/lib/slug';

const userInput = "Geschiedenis VMBO 1";
const safeSlug = normalizeSlug(userInput);
// Result: "geschiedenis-vmbo-1"
```

### Error Response Format
```typescript
{
  "error": "Slug cannot contain forward slashes (/)"
}
// Status: 400 Bad Request
```

### Success Response Format (Unchanged)
```typescript
{
  "success": true,
  "url": "https://storage.url/slug.html",
  "imageUrlMap": {
    "data:image/png;base64,..." : "https://storage.url/slug/img-0.png"
  }
}
```

## ⚠️ Known Limitations

1. **ASCII Only**: International characters (é, ñ, 中) are rejected
   - Workaround: Use `normalizeSlug()` to convert to ASCII
   - Future: Could support Unicode with normalization

2. **Single Storage Backend**: Assumes Supabase Storage handles paths correctly
   - Defense-in-Depth: Use storage permissions, network isolation

3. **No Collision Detection**: Validation doesn't check for existing slugs
   - Mitigation: Application handles uniqueness checks separately

See `SLUG-SECURITY.md` for complete limitation details.

## ✅ Verification Checklist

Run through this checklist:

1. [ ] Run unit tests: `npm test src/lib/__tests__/slug.test.ts`
2. [ ] All unit tests pass
3. [ ] Start dev server: `npm run dev`
4. [ ] Visit `http://localhost:3000/test-slug`
5. [ ] All automated tests show green ✅
6. [ ] Test custom slug: `../x` → Should be blocked ❌
7. [ ] Test custom slug: `geschiedenis-vmbo1` → Should be allowed ✅
8. [ ] Try normalization: `Hello World` → `hello-world` ✅
9. [ ] Review code changes in route file
10. [ ] Verify API response structure unchanged

If all checkboxes pass: ✅ **Slug security is working correctly!**

## 🎉 Summary

**All slug security features implemented and tested.**

The `upload-public-html` API endpoint is now protected against:
- ✅ Path traversal (`../`, `../../`)
- ✅ Directory injection (`a/b`, subdirectories)
- ✅ Encoded separators (`%2f`, `%5c`)
- ✅ Special characters (underscores, spaces, etc.)
- ✅ Position attacks (leading/trailing hyphens)
- ✅ Length attacks (>60 chars)

**Zero breaking changes** for valid slugs - all existing functionality preserved.

**Backward compatible** - API response structure unchanged for successful requests.
