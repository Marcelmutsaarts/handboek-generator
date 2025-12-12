# Robust SSE Streaming Parser Implementation

## Summary

Replaced fragile line-splitting SSE parsing in `/api/generate` with a robust implementation that handles chunk boundaries, malformed events, and provider variations gracefully.

## Problem

The original implementation used naive `buffer.split('\n')` parsing which:
- Assumed SSE events are separated by single newlines (spec uses `\n\n`)
- Could split JSON across chunk boundaries causing parse errors
- Had no fallback if streaming failed
- Silently swallowed errors
- Didn't handle provider-specific response variations

## Solution

### 1. Robust SSE Parser (`src/lib/sse.ts`)

Created a dedicated SSE parsing library using `eventsource-parser` that:
- ✅ Properly handles event boundaries (`\n\n` separators)
- ✅ Buffers incomplete events across chunks
- ✅ Gracefully handles malformed events
- ✅ Extracts content from various response formats
- ✅ Provides error extraction utilities

### 2. Fallback Mechanism

Added automatic fallback if streaming fails:
- If streaming parser encounters errors
- Attempts to read entire response as JSON
- Extracts content from non-streaming format
- Ensures we get content even with provider issues

### 3. Error Handling

Improved error handling:
- Extracts human-readable error messages from API responses
- Logs provider status codes (no secrets logged)
- Surfaces errors to client gracefully
- Never crashes on malformed data

### 4. Frontend Compatibility

**IMPORTANT**: Zero breaking changes to frontend:
- Same SSE format: `data: {type, content}\n\n`
- Same message types: `prompt`, `content`, `done`, `error`
- Same streaming behavior from client perspective
- No frontend code changes required

## Implementation Details

### Before (Fragile)
```typescript
// Line-splitting approach - breaks on chunk boundaries
buffer += decoder.decode(value);
const lines = buffer.split('\n');  // ❌ Wrong separator!

for (const line of lines) {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    const parsed = JSON.parse(data);  // ❌ Can break if JSON split
  }
}
```

### After (Robust)
```typescript
// Event-boundary-aware parsing with buffering
import { parseSSEStream } from '@/lib/sse';

await parseSSEStream(
  reader,
  (message) => {
    // Parser handles buffering and boundaries
    if (message.type === 'content') {
      controller.enqueue(formatMessage(message));
    }
  },
  (error) => {
    // Graceful error handling
    console.error('SSE parse error:', error);
  }
);
```

## Why This Is Safer

### 1. Proper Event Boundary Detection
- SSE spec: events separated by `\n\n` (two newlines)
- Old code: split on `\n` (single newline) ❌
- New code: `eventsource-parser` handles proper boundaries ✅

### 2. Handles Chunked JSON
**Scenario**: JSON split across TCP chunks
```
Chunk 1: "data: {\"choices\":[{\"delta\":"
Chunk 2: "{\"content\":\"Hello\"}}]}\n\n"
```
- Old code: JSON.parse fails on incomplete JSON ❌
- New code: Buffers until complete event, then parses ✅

### 3. Graceful Degradation
- Malformed events: Logged but don't crash ✅
- Streaming fails: Falls back to JSON ✅
- No content: Returns empty instead of error ✅

### 4. Provider Agnostic
Works with multiple response formats:
```typescript
// OpenAI streaming
{ choices: [{ delta: { content: "..." } }] }

// OpenAI non-streaming
{ choices: [{ message: { content: "..." } }] }

// Error responses
{ error: { message: "Rate limit" } }
```

## Testing

### Unit Tests (`src/lib/__tests__/sse.test.ts`)

Tests verify parser handles:
- ✅ JSON split across chunks
- ✅ Events split across chunk boundaries
- ✅ Malformed events
- ✅ Provider response variations

Run tests:
```bash
npm test src/lib/__tests__/sse.test.ts
```

### Manual Testing

The test file includes `manualSSETest()` function that demonstrates chunking:
```bash
npx ts-node src/lib/__tests__/sse.test.ts
```

Shows how content is split across chunks and how parser handles it.

## Observability

Added logging (no secrets):
```typescript
// Log provider response status
console.log('OpenRouter response:', {
  status: response.status,
  statusText: response.statusText,
  model: MODEL
});

// Log fallback usage
console.log('Stream failed, attempting fallback to JSON...');

// Log errors with context
console.error('API error:', {
  status: response.status,
  error: errorMsg
});
```

## Files Changed

### New Files
- `src/lib/sse.ts` - Robust SSE parsing utilities (~200 lines)
- `src/lib/__tests__/sse.test.ts` - Unit tests (~130 lines)

### Modified Files
- `src/app/api/generate/route.ts` - Use robust parser (~60 lines changed)
- `package.json` - Added `eventsource-parser` dependency

### Dependencies Added
- `eventsource-parser@1.1.2` - Industry-standard SSE parser library

## Migration Notes

### No Breaking Changes
- ✅ Frontend code unchanged
- ✅ API contract unchanged
- ✅ Response format unchanged
- ✅ Message types unchanged

### Behavior Changes (Improvements)
- ✅ More reliable parsing (handles edge cases)
- ✅ Better error messages (human-readable)
- ✅ Fallback on streaming failures (gets content anyway)
- ✅ Improved logging (debugging easier)

## Future Improvements

### Optional Enhancements
1. **Metrics**: Track fallback usage rate
2. **Retry Logic**: Auto-retry on transient errors
3. **Partial Responses**: Return partial content on timeout
4. **Test Coverage**: Add integration tests with real OpenRouter

### Not Needed Now
- Current implementation handles all known edge cases
- Fallback ensures we always try to get content
- Error handling is comprehensive
- Logging provides good observability

## References

- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [eventsource-parser Library](https://github.com/rexxars/eventsource-parser)
- [OpenRouter API Docs](https://openrouter.ai/docs#streaming)

## Verification Checklist

- [x] SSE parser handles chunk boundaries correctly
- [x] Fallback works when streaming fails
- [x] Error messages are human-readable
- [x] No secrets logged
- [x] Frontend compatibility maintained
- [x] Tests added and passing
- [x] Logging provides good observability
- [x] Dependency added to package.json
