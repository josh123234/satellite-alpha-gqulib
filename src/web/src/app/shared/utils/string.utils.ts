import { isString, memoize } from 'lodash'; // v4.17.21

/**
 * Maximum lengths for different string operations
 */
const STRING_LIMITS = {
  TRUNCATE_MAX: 1000,
  SLUG_MAX: 100,
  SEARCH_TERM_MAX: 50,
  IDENTIFIER_MAX: 64
} as const;

/**
 * Truncates a string to the specified length with ellipsis if needed.
 * Handles UTF-8 characters correctly and includes input validation.
 * 
 * @param value - The string to truncate
 * @param maxLength - Maximum length of the resulting string
 * @returns Truncated string with ellipsis if truncated
 * @throws Error if inputs are invalid
 */
export function truncateString(value: string, maxLength: number): string {
  if (!isString(value)) {
    throw new Error('Input must be a string');
  }
  
  if (!Number.isInteger(maxLength) || maxLength <= 0 || maxLength > STRING_LIMITS.TRUNCATE_MAX) {
    throw new Error(`MaxLength must be a positive integer not exceeding ${STRING_LIMITS.TRUNCATE_MAX}`);
  }

  if (value.length <= maxLength) {
    return value;
  }

  // Normalize string to handle UTF-8 characters correctly
  const normalized = value.normalize('NFC');
  return normalized.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalizes the first letter of a string with performance optimization through memoization.
 * Handles empty strings and UTF-8 characters correctly.
 * 
 * @param value - The string to capitalize
 * @returns String with first letter capitalized
 * @throws Error if input is invalid
 */
export const capitalizeFirstLetter = memoize((value: string): string => {
  if (!isString(value)) {
    throw new Error('Input must be a string');
  }

  if (!value) {
    return value;
  }

  // Normalize string for consistent UTF-8 handling
  const normalized = value.normalize('NFC');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
});

/**
 * Converts a string to a URL-friendly slug format.
 * Supports international characters and includes security measures.
 * 
 * @param value - The string to convert to slug
 * @returns URL-friendly slug string
 * @throws Error if input is invalid
 */
export function slugify(value: string): string {
  if (!isString(value)) {
    throw new Error('Input must be a string');
  }

  // Normalize string and convert to base characters
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    // Replace diacritics with base characters
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and special characters with hyphens
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  // Enforce maximum length
  return normalized.slice(0, STRING_LIMITS.SLUG_MAX);
}

/**
 * Sanitizes a search term with enhanced security measures.
 * Removes potentially dangerous characters and patterns.
 * 
 * @param value - The search term to sanitize
 * @returns Sanitized search term
 * @throws Error if input is invalid
 */
export function sanitizeSearchTerm(value: string): string {
  if (!isString(value)) {
    throw new Error('Input must be a string');
  }

  return value
    .trim()
    // Remove SQL injection patterns
    .replace(/['";]/g, '')
    // Remove XSS vulnerable characters
    .replace(/[<>]/g, '')
    // Normalize international characters
    .normalize('NFKC')
    .toLowerCase()
    // Limit length
    .slice(0, STRING_LIMITS.SEARCH_TERM_MAX);
}

/**
 * Formats an identifier string with enhanced validation and security.
 * Supports optional prefix and enforces consistent formatting.
 * 
 * @param value - The string to format as identifier
 * @param prefix - Optional prefix to add to the identifier
 * @returns Formatted identifier
 * @throws Error if inputs are invalid
 */
export function formatIdentifier(value: string, prefix?: string): string {
  if (!isString(value)) {
    throw new Error('Input must be a string');
  }

  if (prefix && !isString(prefix)) {
    throw new Error('Prefix must be a string if provided');
  }

  const cleanValue = value
    .replace(/[^A-Za-z0-9-_]/g, '')
    .toUpperCase();

  const formattedId = prefix 
    ? `${prefix}_${cleanValue}`
    : cleanValue;

  if (formattedId.length > STRING_LIMITS.IDENTIFIER_MAX) {
    throw new Error(`Identifier exceeds maximum length of ${STRING_LIMITS.IDENTIFIER_MAX} characters`);
  }

  // Validate final format
  if (!/^[A-Z][A-Z0-9_-]*$/.test(formattedId)) {
    throw new Error('Invalid identifier format');
  }

  return formattedId;
}