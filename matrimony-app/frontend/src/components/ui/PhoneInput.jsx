import { forwardRef, useId, useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Phone, Search, X } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, PRIORITY_CODES } from '../../lib/phoneCountries';
import {
  parsePhoneE164,
  normalizeLocalNumber,
  buildE164,
  validateLocalNumber,
} from '../../lib/phoneUtils';
import FieldMessage from './FieldMessage';

/**
 * PhoneInput — a professional country-code + phone-number input.
 *
 * Props:
 *   label        {string}   Field label
 *   value        {string}   Full E.164 value (controlled) e.g. "+94771234567"
 *   onChange     {function} Called with full E.164 string on every change
 *   error        {string}   Validation error text
 *   success      {string}   Success message
 *   help         {string}   Hint text
 *   required     {boolean}
 *   disabled     {boolean}
 *   floating     {boolean}  Use floating-label style (default: true)
 *   id           {string}   Custom id for the number input
 *   className    {string}   Wrapper class
 *
 * The component is intentionally NOT wired as a react-hook-form ref input.
 * Use it via Controller / setValue pattern (see Signup.jsx).
 */
const PhoneInput = forwardRef(function PhoneInput(
  {
    label = 'Mobile Number',
    value = '',
    onChange,
    error,
    success,
    help,
    required,
    disabled,
    floating = true,
    id,
    className = '',
  },
  _ref
) {
  const autoId = useId();
  const inputId = id || `pi-${autoId}`;
  const msgId = `${inputId}-msg`;

  // ── Internal state ──────────────────────────────────────────────────────────
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const wrapRef = useRef(null);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // ── Sync incoming value prop → internal state ────────────────────────────────
  useEffect(() => {
    if (!value) {
      // Keep country selection but clear local number
      setLocalNumber('');
      return;
    }
    const { country, localNumber: local } = parsePhoneE164(value);
    setSelectedCountry(country);
    setLocalNumber(local);
  }, [value]);

  // ── Country list filtering ───────────────────────────────────────────────────
  const q = searchQuery.toLowerCase().trim();
  const filteredCountries = q
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dialCode.includes(q) ||
          c.code.toLowerCase().includes(q)
      )
    : COUNTRIES;

  // Priority countries appear first when no search
  const priorityList = q ? [] : filteredCountries.filter((c) => PRIORITY_CODES.includes(c.code));
  const restList = q
    ? filteredCountries
    : filteredCountries.filter((c) => !PRIORITY_CODES.includes(c.code));

  // ── Close dropdown on outside click / Escape ─────────────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [dropdownOpen]);

  // Focus search box when dropdown opens
  useEffect(() => {
    if (dropdownOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [dropdownOpen]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCountrySelect = useCallback(
    (country) => {
      setSelectedCountry(country);
      setDropdownOpen(false);
      setSearchQuery('');
      // Emit updated E.164 with new country code
      const e164 = buildE164(country.dialCode, localNumber);
      onChange?.(e164);
      // Re-focus phone input
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [localNumber, onChange]
  );

  const handleLocalChange = useCallback(
    (e) => {
      const raw = e.target.value;
      // Allow digits, spaces, and dashes (normalise on blur / submit)
      const cleaned = raw.replace(/[^\d\s\-]/g, '');
      setLocalNumber(cleaned);
      const e164 = buildE164(selectedCountry.dialCode, cleaned);
      onChange?.(e164);
    },
    [selectedCountry, onChange]
  );

  const handleLocalBlur = useCallback(() => {
    setFocused(false);
    // Auto-normalise on blur: strip accidental country-code prefix
    const normalised = normalizeLocalNumber(localNumber, selectedCountry.dialCode);
    if (normalised !== localNumber) {
      setLocalNumber(normalised);
      const e164 = buildE164(selectedCountry.dialCode, normalised);
      onChange?.(e164);
    }
  }, [localNumber, selectedCountry, onChange]);

  // ── State classes ────────────────────────────────────────────────────────────
  const stateClass = error ? 'input-error' : success ? 'input-success' : '';
  const hasMsg = !!(error || success || help);

  // ─── Shared wrapper style ────────────────────────────────────────────────────
  const wrapperStyle = [
    'phone-input-wrap',
    stateClass,
    focused && !error && !success ? 'phone-input-focused' : '',
    disabled ? 'phone-input-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ─── Dropdown ────────────────────────────────────────────────────────────────
  const CountryItem = ({ country, isSelected }) => (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`phone-dropdown-item ${isSelected ? 'phone-dropdown-item-selected' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault(); // prevent blur on input
        handleCountrySelect(country);
      }}
    >
      <span className="phone-dropdown-flag" aria-hidden="true">
        {country.flag}
      </span>
      <span className="phone-dropdown-name">{country.name}</span>
      <span className="phone-dropdown-code">{country.dialCode}</span>
    </button>
  );

  const dropdown = dropdownOpen && (
    <div
      className="phone-dropdown"
      role="listbox"
      aria-label="Select country"
      id={`${inputId}-dropdown`}
    >
      {/* Search */}
      <div className="phone-search-wrap">
        <Search className="phone-search-icon" size={14} aria-hidden="true" />
        <input
          ref={searchRef}
          type="text"
          className="phone-search"
          placeholder="Search country…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search countries"
        />
        {searchQuery && (
          <button
            type="button"
            className="phone-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Country list */}
      <div className="phone-dropdown-list">
        {/* Priority section */}
        {priorityList.length > 0 && (
          <>
            <div className="phone-dropdown-section">Popular</div>
            {priorityList.map((c) => (
              <CountryItem key={c.code} country={c} isSelected={c.code === selectedCountry.code} />
            ))}
            <div className="phone-dropdown-divider" />
          </>
        )}

        {/* All / filtered countries */}
        {restList.length > 0 ? (
          restList.map((c) => (
            <CountryItem key={c.code} country={c} isSelected={c.code === selectedCountry.code} />
          ))
        ) : (
          <div className="phone-dropdown-empty">No countries found</div>
        )}
      </div>
    </div>
  );

  // ─── Floating label variant ──────────────────────────────────────────────────
  if (floating) {
    return (
      <div className={`fl-field phone-fl-field ${className}`} ref={wrapRef}>
        {/* Combined phone row: [country btn] [number input] */}
        <div
          className={`phone-input-wrap ${stateClass} ${focused ? 'phone-input-focused' : ''} ${disabled ? 'phone-input-disabled' : ''}`}
          aria-expanded={dropdownOpen}
        >
          {/* Country selector */}
          <button
            type="button"
            id={`${inputId}-country`}
            className="phone-country-btn"
            onClick={() => !disabled && setDropdownOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-controls={`${inputId}-dropdown`}
            aria-label={`Country: ${selectedCountry.name} (${selectedCountry.dialCode})`}
            disabled={disabled}
            tabIndex={0}
          >
            <span className="phone-flag" aria-hidden="true">
              {selectedCountry.flag}
            </span>
            <span className="phone-dial-code">{selectedCountry.dialCode}</span>
            <ChevronDown
              size={13}
              className={`phone-chevron ${dropdownOpen ? 'phone-chevron-open' : ''}`}
              aria-hidden="true"
            />
          </button>

          {/* Divider */}
          <span className="phone-divider" aria-hidden="true" />

          {/* Number input */}
          <input
            ref={inputRef}
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className="phone-number-input fl-has-icon"
            placeholder=" "
            value={localNumber}
            onChange={handleLocalChange}
            onFocus={() => setFocused(true)}
            onBlur={handleLocalBlur}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={hasMsg ? msgId : undefined}
            aria-required={required}
          />

          {/* Floating label */}
          <label className="fl-label phone-fl-label" htmlFor={inputId}>
            {label}
            {required && <span className="text-[var(--error)]"> *</span>}
          </label>
        </div>

        {/* Dropdown */}
        {dropdown}

        <FieldMessage error={error} success={success} help={help} id={msgId} />
      </div>
    );
  }

  // ─── Non-floating (standard label) variant ───────────────────────────────────
  return (
    <div className={`phone-field-wrap ${className}`} ref={wrapRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-[var(--ink-soft)] mb-1.5"
        >
          {label}
          {required && <span className="text-[var(--error)]"> *</span>}
        </label>
      )}

      <div
        className={`phone-input-wrap ${stateClass} ${focused ? 'phone-input-focused' : ''} ${disabled ? 'phone-input-disabled' : ''}`}
      >
        {/* Country selector */}
        <button
          type="button"
          id={`${inputId}-country`}
          className="phone-country-btn"
          onClick={() => !disabled && setDropdownOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-controls={`${inputId}-dropdown`}
          aria-label={`Country: ${selectedCountry.name} (${selectedCountry.dialCode})`}
          disabled={disabled}
        >
          <span className="phone-flag" aria-hidden="true">
            {selectedCountry.flag}
          </span>
          <span className="phone-dial-code">{selectedCountry.dialCode}</span>
          <ChevronDown
            size={13}
            className={`phone-chevron ${dropdownOpen ? 'phone-chevron-open' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Divider */}
        <span className="phone-divider" aria-hidden="true" />

        {/* Number input */}
        <input
          ref={inputRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          className="phone-number-input"
          placeholder="77 123 4567"
          value={localNumber}
          onChange={handleLocalChange}
          onFocus={() => setFocused(true)}
          onBlur={handleLocalBlur}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={hasMsg ? msgId : undefined}
          aria-required={required}
        />
      </div>

      {/* Dropdown */}
      {dropdown}

      <FieldMessage error={error} success={success} help={help} id={msgId} />
    </div>
  );
});

export default PhoneInput;
