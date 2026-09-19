/**
 * Phone number utilities shared across all phone-input components.
 *
 * Strategy: The backend (and DB) always store full E.164 (+94771234567).
 * The UI presents: [country selector] [local number input].
 * These helpers convert between the two representations.
 */

import { COUNTRIES, DEFAULT_COUNTRY, findCountryByDialCode } from './phoneCountries';

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse an E.164 phone number into its components.
 *
 * parsePhoneE164('+94771234567') →
 *   { country: { code:'LK', dialCode:'+94', ... }, localNumber: '771234567' }
 *
 * Returns the DEFAULT_COUNTRY (Sri Lanka) with an empty local number
 * if the input is empty or unrecognised.
 */
export function parsePhoneE164(e164) {
  if (!e164 || typeof e164 !== 'string') {
    return { country: DEFAULT_COUNTRY, localNumber: '' };
  }

  const cleaned = e164.trim();

  // If it starts with + — find the matching country by dial prefix
  if (cleaned.startsWith('+')) {
    // Sort countries by dialCode length desc to match longest prefix first
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sorted) {
      if (cleaned.startsWith(country.dialCode)) {
        const localNumber = cleaned.slice(country.dialCode.length);
        return { country, localNumber };
      }
    }
  }

  // Fallback: no prefix found, treat entire value as local number with default country
  return { country: DEFAULT_COUNTRY, localNumber: cleaned.replace(/^\+/, '') };
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Sanitise a user's local number input:
 *   - Strip leading spaces / dashes / dots
 *   - Remove all non-digit chars except leading +
 *   - Prevent accidental duplicate country codes
 *     (e.g. user types "+94771234567" in the local field when +94 is selected)
 *
 * normalizeLocalNumber('+94771234567', '+94') → '771234567'
 * normalizeLocalNumber('077 123 4567', '+94') → '0771234567'
 */
export function normalizeLocalNumber(raw, dialCode) {
  if (!raw) return '';

  let v = raw.trim();

  // Strip the selected dial code prefix if the user accidentally typed it
  if (dialCode && v.startsWith(dialCode)) {
    v = v.slice(dialCode.length);
  }
  // Also strip a leading + (e.g. user types "+771234567" without the code)
  if (v.startsWith('+')) {
    // Check if it looks like another dial code prefix
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sorted) {
      if (v.startsWith(country.dialCode)) {
        v = v.slice(country.dialCode.length);
        break;
      }
    }
    // Remove any remaining leading +
    v = v.replace(/^\+/, '');
  }

  // Keep only digits (and spaces/dashes for display — stripped on submit)
  v = v.replace(/[^\d\s\-]/g, '');

  return v;
}

// ─── Building ─────────────────────────────────────────────────────────────────

/**
 * Build a full E.164 number from dial code + local number.
 *
 * buildE164('+94', '771234567') → '+94771234567'
 * buildE164('+94', '077 123 4567') → '+940771234567'
 *
 * Strips all non-digits from localNumber before concatenating.
 */
export function buildE164(dialCode, localNumber) {
  const digitsOnly = (localNumber ?? '').replace(/\D/g, '');
  return `${dialCode}${digitsOnly}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the local portion of a phone number.
 * Returns an error string or null (valid).
 *
 * Rules:
 *   - Must not be empty
 *   - Must contain only digits (after stripping spaces/dashes)
 *   - Combined E.164 must match /^\+[1-9]\d{7,14}$/ (backend rule)
 */
export function validateLocalNumber(localNumber, dialCode) {
  if (!localNumber || !localNumber.trim()) return 'Phone number is required';

  const digits = localNumber.replace(/\D/g, '');
  if (!digits) return 'Enter digits only — no letters';

  const full = buildE164(dialCode || '+1', digits);

  // Backend regex: /^\+[1-9]\d{7,14}$/
  if (!/^\+[1-9]\d{7,14}$/.test(full)) {
    return 'Enter a valid phone number';
  }

  return null; // valid
}

/**
 * Validate a complete E.164 string (used at form submission level).
 * Returns an error string or null.
 */
export function validateE164(e164) {
  if (!e164 || !e164.trim()) return 'Phone number is required';
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return 'Enter a valid phone number (e.g. +94771234567)';
  return null;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Format a stored E.164 number for human-readable display.
 *
 * formatPhoneDisplay('+94771234567') → '🇱🇰 +94 771234567'
 */
export function formatPhoneDisplay(e164) {
  if (!e164) return '';
  const { country, localNumber } = parsePhoneE164(e164);
  if (!localNumber) return e164;
  return `${country.flag} ${country.dialCode} ${localNumber}`;
}
