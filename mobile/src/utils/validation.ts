// Validation rules matching the website frontend exactly (source of truth).
// Messages mirror what the website shows so the mobile app behaves identically.

export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'. -]*$/u;
export const USERNAME_RE = /^[a-zA-Z0-9_]{4,30}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?\d[\d\s-]{7,20}$/;
export const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
export const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Calculate age in years from a YYYY-MM-DD date. */
export function calcAge(dob: string): number | null {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Live-field helper: empty → show "required" only after the field has been
 * touched (blurred or submitted); non-empty → validate live while typing.
 */
export function fieldError(
  value: string,
  touched: boolean,
  validate: (v: string) => string | null
): string | null {
  if (!value) return touched ? 'Required' : null;
  return validate(value);
}

export function validateUsername(value: string): string | null {
  if (value.length < 2) return 'Enter at least 2 characters';
  if (value.length > 60) return 'Too long (maximum 60 characters)';
  if (!NAME_RE.test(value)) return "Letters, spaces, and ' . - only";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!EMAIL_RE.test(value)) return 'Invalid email format (e.g. name@example.com)';
  return null;
}

export function validateEmailOrPhone(value: string): string | null {
  if (EMAIL_RE.test(value) || PHONE_RE.test(value)) return null;
  if (value.includes('@')) return 'Invalid email format (e.g. name@example.com)';
  return 'Enter a valid email or mobile number (e.g. +14165550198)';
}

export function validatePhone(value: string): string | null {
  if (!PHONE_RE.test(value)) return 'Enter a valid phone number (e.g. +94771234567)';
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Minimum 8 characters';
  if (!/[A-Z]/.test(value)) return 'Needs at least 1 uppercase letter';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
    return 'Needs at least 1 special character (!@#$...)';
  return null;
}

export function validateLoginPassword(value: string): string | null {
  if (!value) return 'Required';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

export function validateBusinessName(value: string): string | null {
  if (value.length < 2) return 'Required. Minimum 2 characters';
  if (value.length > 80) return 'Too long (maximum 80 characters)';
  return null;
}

// ── Profile fields (aligned with backend routes/profiles.js) ──────────────────
export function validateName(value: string): string | null {
  if (value.length < 2) return 'Full name must be at least 2 characters';
  if (value.length > 60) return 'Too long (maximum 60 characters)';
  return null;
}

export function validateDob(value: string): string | null {
  if (!DOB_RE.test(value)) return 'Invalid format. Expected: YYYY-MM-DD';
  const age = calcAge(value);
  if (age === null) return 'Enter a valid date of birth';
  if (age < 18) return 'Must be 18 years or older';
  return null;
}

export function validateHeightFeet(value: string): string | null {
  const n = Number(value);
  if (isNaN(n) || n < 3 || n > 7) return 'Expected a value between 3 and 7';
  return null;
}

export function validateHeightInches(value: string): string | null {
  const n = Number(value);
  if (isNaN(n) || n < 0 || n > 11) return 'Expected a value between 0 and 11';
  return null;
}

export function validateLongText(value: string, label: string): string | null {
  if (value.length < 2) return `${label} must be at least 2 characters`;
  if (value.length > 200) return 'Too long (maximum 200 characters)';
  return null;
}

export function validateAboutMe(value: string): string | null {
  const len = value.trim().length;
  if (len < 50) return `Too short. Required: minimum 50 characters (currently ${len})`;
  if (len > 2000) return 'Too long (maximum 2000 characters)';
  return null;
}

// ── Profile wizard step constants (matching website) ──────────────────────────
export const POSTED_BY = ['Self', 'Son', 'Daughter', 'Brother', 'Sister', 'Relative', 'Friend', 'Client'];

export const DIET_OPTIONS = [
  { value: 'any', label: 'Any / Flexible' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non_vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
];
export const FAMILY_VALUES = [
  { value: 'traditional', label: 'Traditional' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'liberal', label: 'Liberal' },
];
export const CAREER_GOALS = [
  { value: 'working', label: 'Career Oriented / Working' },
  { value: 'home_maker', label: 'Home Maker' },
  { value: 'open', label: 'Flexible / Open' },
];
export const RELOCATE = [
  { value: 'open', label: 'Open to Relocate' },
  { value: 'local_only', label: 'Local Only' },
  { value: 'overseas_only', label: 'Overseas Only' },
];
export const INCOME_RANGE = [
  { value: 'Under $50k', label: 'Under $50k' },
  { value: '$50k - $100k', label: '$50k - $100k' },
  { value: '$100k - $150k', label: '$100k - $150k' },
  { value: '$150k+', label: '$150k+' },
];
export const MANGLIK = [
  { value: 'no', label: 'No Dosham / Non-Manglik' },
  { value: 'yes', label: 'Chevvai Dosham / Manglik' },
  { value: 'dont_know', label: "Don't Know" },
];

// ── Profile form type ────────────────────────────────────────────────────────
export interface ProfileForm {
  profile_registered_for: string;
  name: string;
  gender: 'M' | 'F' | '';
  date_of_birth: string;
  height_feet: string;
  height_inches: string;
  education: string;
  occupation: string;
  religion_id: string;
  caste_id: string;
  sub_religion: string;
  raasi_id: string;
  star_id: string;
  born_country_id: string;
  current_country_id: string;
  city_or_state: string;
  about_me: string;
  blur_photo: number;
  blur_horoscope: number;
  diet: string;
  family_values: string;
  career_goals: string;
  willing_to_relocate: string;
  income_range: string;
  manglik_status: string;
}

export const EMPTY_FORM: ProfileForm = {
  profile_registered_for: 'Self',
  name: '',
  gender: '',
  date_of_birth: '',
  height_feet: '5',
  height_inches: '6',
  education: '',
  occupation: '',
  religion_id: '',
  caste_id: '',
  sub_religion: '',
  raasi_id: '',
  star_id: '',
  born_country_id: '',
  current_country_id: '',
  city_or_state: '',
  about_me: '',
  blur_photo: 0,
  blur_horoscope: 0,
  diet: 'any',
  family_values: 'moderate',
  career_goals: 'working',
  willing_to_relocate: 'open',
  income_range: '$50k - $100k',
  manglik_status: 'no',
};

// ── Wizard step definitions ──────────────────────────────────────────────────
export interface ProfileStepDef {
  key: string;
  title: string;
  hint: string;
  icon: string;
  fields: (keyof ProfileForm)[];
}

export const profileSteps: ProfileStepDef[] = [
  { key: 'basic', title: 'Basics', hint: 'Who is this profile for?', icon: 'person', fields: ['profile_registered_for', 'name', 'gender', 'date_of_birth'] },
  { key: 'education', title: 'Education & Career', hint: 'Your academic and professional background', icon: 'school', fields: ['education', 'occupation'] },
  { key: 'height', title: 'Height', hint: 'Physical details', icon: 'resize', fields: ['height_feet', 'height_inches'] },
  { key: 'lifestyle', title: 'Lifestyle', hint: 'Day-to-day preferences', icon: 'heart', fields: ['diet', 'family_values', 'career_goals', 'willing_to_relocate'] },
  { key: 'income', title: 'Income & Dosham', hint: 'Financial and astrological preferences', icon: 'wallet', fields: ['income_range', 'manglik_status'] },
  { key: 'religion', title: 'Religion & Caste', hint: 'Community details', icon: 'library', fields: ['religion_id', 'caste_id', 'sub_religion'] },
  { key: 'astrology', title: 'Astrology', hint: 'Raasi and nakshatram', icon: 'star', fields: ['raasi_id', 'star_id'] },
  { key: 'location', title: 'Location', hint: 'Where you were born and live now', icon: 'location', fields: ['born_country_id', 'current_country_id', 'city_or_state'] },
  { key: 'media', title: 'Photos & Privacy', hint: 'Upload media and set privacy', icon: 'camera', fields: ['blur_photo', 'blur_horoscope'] },
  { key: 'bio', title: 'Bio & Review', hint: 'Tell your story', icon: 'document-text', fields: ['about_me'] },
];

// ── Step validation (mirrors website's Zod schemas) ──────────────────────────
function validateNameField(v: string): string | null { return validateName(v); }
function validatePostedBy(v: string): string | null {
  if (!POSTED_BY.includes(v)) return 'Select who posted this profile';
  return null;
}
function validateGender(v: string): string | null {
  if (v !== 'M' && v !== 'F') return 'Please select a gender';
  return null;
}

export function validateProfileStep(step: number, form: ProfileForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const stepDef = profileSteps[step];
  if (!stepDef) return errors;

  const addError = (field: string, msg: string) => { errors[field] = msg; };

  for (const field of stepDef.fields) {
    const val = String(form[field] ?? '');

    switch (field) {
      case 'profile_registered_for': {
        const e = validatePostedBy(val); if (e) addError(field, e);
        break;
      }
      case 'name': {
        const e = validateNameField(val); if (e) addError(field, e);
        break;
      }
      case 'gender': {
        const e = validateGender(val); if (e) addError(field, e);
        break;
      }
      case 'date_of_birth': {
        const e = validateDob(val); if (e) addError(field, e);
        break;
      }
      case 'height_feet': {
        const e = validateHeightFeet(val); if (e) addError(field, e);
        break;
      }
      case 'height_inches': {
        const e = validateHeightInches(val); if (e) addError(field, e);
        break;
      }
      case 'education': {
        const e = validateLongText(val, 'Education'); if (e) addError(field, e);
        break;
      }
      case 'occupation': {
        const e = validateLongText(val, 'Occupation'); if (e) addError(field, e);
        break;
      }
      case 'diet': {
        if (!DIET_OPTIONS.some(o => o.value === val)) addError(field, 'Select a dietary preference');
        break;
      }
      case 'family_values': {
        if (!FAMILY_VALUES.some(o => o.value === val)) addError(field, 'Select family values');
        break;
      }
      case 'career_goals': {
        if (!CAREER_GOALS.some(o => o.value === val)) addError(field, 'Select career goals');
        break;
      }
      case 'willing_to_relocate': {
        if (!RELOCATE.some(o => o.value === val)) addError(field, 'Select relocation preference');
        break;
      }
      case 'income_range': {
        if (!val) addError(field, 'Select an income range');
        break;
      }
      case 'manglik_status': {
        if (!MANGLIK.some(o => o.value === val)) addError(field, 'Select an option');
        break;
      }
      case 'religion_id': {
        if (!val) addError(field, 'Select a religion');
        break;
      }
      case 'caste_id': {
        if (!val) addError(field, 'Select a caste');
        break;
      }
      case 'raasi_id': {
        if (!val) addError(field, 'Select a raasi');
        break;
      }
      case 'star_id': {
        if (!val) addError(field, 'Select a star / nakshatram');
        break;
      }
      case 'born_country_id': {
        if (!val) addError(field, 'Select a country of birth');
        break;
      }
      case 'current_country_id': {
        if (!val) addError(field, 'Select a country of residence');
        break;
      }
      case 'city_or_state': {
        if (val.length < 2) addError(field, 'Enter city or state');
        break;
      }
      case 'about_me': {
        const e = validateAboutMe(val); if (e) addError(field, e);
        break;
      }
    }
  }
  return errors;
}

// Hint text shown when a field is empty (guides the user on the expected format).
export const HINTS = {
  username: 'Letters, spaces, and \' . - only',
  email: 'name@example.com',
  phone: '+94 771234567 (Sri Lanka default, or select your country)',
  password: 'Min 8 chars, 1 uppercase, 1 special character',
  confirm: 'Re-enter your password',
  businessName: 'Your agency name (min 2 characters)',
  name: 'Min 2 characters, letters and spaces only',
  dob: 'YYYY-MM-DD (e.g. 1995-06-15). Must be 18+',
  heightFeet: '3-7',
  heightInches: '0-11',
  education: 'e.g. B.E. Computer Science',
  occupation: 'e.g. Software Engineer',
  city: 'e.g. Chennai',
  diet: 'e.g. Vegetarian, Non-vegetarian, Vegan',
  familyValues: 'e.g. Traditional, Moderate, Liberal',
  aboutMe: 'Tell your story (minimum 50 characters)',
  subReligion: 'e.g. Saiva Siddhantam (optional)',
} as const;
