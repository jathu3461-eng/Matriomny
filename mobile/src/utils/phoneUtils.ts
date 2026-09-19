/**
 * Phone number utilities for the React Native mobile app.
 * Mirrors web/src/lib/phoneUtils.js (TypeScript version).
 */

import { Country, COUNTRIES, DEFAULT_COUNTRY } from './phoneCountries';

// ─── Parsing ─────────────────────────────────────────────────────────────────

export interface ParsedPhone {
  country: Country;
  localNumber: string;
}

/**
 * Parse a full E.164 number into country + local number.
 *
 * parsePhoneE164('+94771234567') →
 *   { country: { code:'LK', dialCode:'+94', ... }, localNumber: '771234567' }
 */
export function parsePhoneE164(e164: string): ParsedPhone {
  if (!e164 || typeof e164 !== 'string') {
    return { country: DEFAULT_COUNTRY, localNumber: '' };
  }

  const cleaned = e164.trim();

  if (cleaned.startsWith('+')) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sorted) {
      if (cleaned.startsWith(country.dialCode)) {
        const localNumber = cleaned.slice(country.dialCode.length);
        return { country, localNumber };
      }
    }
  }

  return { country: DEFAULT_COUNTRY, localNumber: cleaned.replace(/^\+/, '') };
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Sanitise raw user input for the local number field.
 * - Strips an accidentally typed country code prefix.
 * - Removes non-digit characters.
 */
export function normalizeLocalNumber(raw: string, dialCode: string): string {
  if (!raw) return '';
  let v = raw.trim();

  // Strip selected dial code if user typed it
  if (dialCode && v.startsWith(dialCode)) {
    v = v.slice(dialCode.length);
  }

  // Strip any remaining leading + (match against all dial codes)
  if (v.startsWith('+')) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sorted) {
      if (v.startsWith(country.dialCode)) {
        v = v.slice(country.dialCode.length);
        break;
      }
    }
    v = v.replace(/^\+/, '');
  }

  // Keep digits only
  return v.replace(/\D/g, '');
}

// ─── Building ─────────────────────────────────────────────────────────────────

/**
 * Build a full E.164 string.
 *
 * buildE164('+94', '771234567') → '+94771234567'
 */
export function buildE164(dialCode: string, localNumber: string): string {
  const digitsOnly = (localNumber ?? '').replace(/\D/g, '');
  return `${dialCode}${digitsOnly}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the local portion of a phone number.
 * Returns an error string or null (valid).
 */
export function validateLocalNumber(localNumber: string, dialCode: string): string | null {
  if (!localNumber || !localNumber.trim()) return 'Phone number is required';

  const digits = localNumber.replace(/\D/g, '');
  if (!digits) return 'Enter digits only — no letters';

  const full = buildE164(dialCode || '+1', digits);

  // Backend regex: /^\+[1-9]\d{7,14}$/
  if (!/^\+[1-9]\d{7,14}$/.test(full)) {
    return 'Enter a valid phone number';
  }

  return null;
}

/**
 * Validate a full E.164 string.
 * Returns an error string or null.
 */
export function validateE164(e164: string): string | null {
  if (!e164 || !e164.trim()) return 'Phone number is required';
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return 'Enter a valid phone number (e.g. +94771234567)';
  return null;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Format a stored E.164 number for display.
 *
 * formatPhoneDisplay('+94771234567') → '🇱🇰 +94 771234567'
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164) return '';
  const { country, localNumber } = parsePhoneE164(e164);
  if (!localNumber) return e164;
  return `${country.flag} ${country.dialCode} ${localNumber}`;
}
