/**
 * Runtime-safe Base64 decoding utilities
 *
 * Why Node.js Buffer instead of atob/Blob:
 * - atob() is browser API, may not be available in all Node environments
 * - Blob() behavior differs between Node.js and Edge runtime
 * - Buffer is native to Node.js and provides consistent binary handling
 * - No runtime compatibility issues or polyfill requirements
 *
 * This ensures production stability across Next.js deployment targets.
 */

export interface DecodedBase64 {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Safely decode a data URI base64 string to a Buffer
 *
 * @param dataUri - Data URI string (e.g., "data:image/png;base64,iVBORw0KG...")
 * @returns Decoded buffer and MIME type, or null if invalid
 *
 * @example
 * ```typescript
 * const result = decodeDataUri('data:image/png;base64,iVBORw0KG...');
 * if (result) {
 *   console.log(result.mimeType); // "image/png"
 *   console.log(result.buffer);   // Buffer instance
 * }
 * ```
 */
export function decodeDataUri(dataUri: string): DecodedBase64 | null {
  try {
    // Validate and parse data URI format
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return null;
    }

    const mimeType = match[1];
    const base64Data = match[2];

    // Validate MIME type is reasonable
    if (!mimeType || mimeType.length > 100) {
      return null;
    }

    // Decode using Node.js Buffer (runtime-safe)
    // This will throw if base64 is invalid
    const buffer = Buffer.from(base64Data, 'base64');

    // Sanity check: decoded data should not be empty
    if (buffer.length === 0) {
      return null;
    }

    return { buffer, mimeType };
  } catch (error) {
    // Invalid base64 or other parsing error
    console.warn('Base64 decode error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Validate that a string is valid base64
 *
 * @param str - String to validate
 * @returns True if valid base64, false otherwise
 */
export function isValidBase64(str: string): boolean {
  try {
    // Try to decode - if it throws, it's invalid
    Buffer.from(str, 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file extension from MIME type
 *
 * @param mimeType - MIME type (e.g., "image/png")
 * @returns File extension (e.g., "png")
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const parts = mimeType.split('/');
  if (parts.length === 2) {
    // Handle special cases
    const subtype = parts[1];
    if (subtype === 'jpeg') return 'jpg';
    if (subtype === 'svg+xml') return 'svg';
    return subtype;
  }
  return 'bin'; // Fallback for unknown types
}
