import { z } from 'zod';

/* ─────────────────────────────────────────────────────────────
   Shared regexes (aligned with backend auth/profile validators)
   ───────────────────────────────────────────────────────────── */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?\d[\d\s-]{7,20}$/;
export const USERNAME_RE = /^[a-zA-Z0-9_]{4,30}$/;
export const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'. -]*$/u;

export const POSTED_BY = ['Self', 'Son', 'Daughter', 'Brother', 'Sister', 'Relative', 'Friend', 'Client'];

export function calcAge(dob) {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function passwordRules(pwd = '') {
  return {
    min8: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    all: pwd.length >= 8 && /[A-Z]/.test(pwd) && /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
  };
}

/* ─────────────────────────────────────────────────────────────
   Field-level primitives
   ───────────────────────────────────────────────────────────── */
const name = z
  .string()
  .trim()
  .min(2, 'Enter at least 2 characters')
  .max(60, 'Too long (maximum 60 characters)')
  .refine((v) => NAME_RE.test(v), 'Letters, spaces, and \' . - only');

const email = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine((v) => EMAIL_RE.test(v), 'Invalid email format (e.g. name@example.com)');

const emailOrMobile = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine((v) => EMAIL_RE.test(v) || PHONE_RE.test(v), 'Enter a valid email or mobile number');

const password = z
  .string()
  .min(8, 'Minimum 8 characters')
  .refine((v) => PASSWORD_RE.test(v), 'Needs at least 1 uppercase letter and 1 special character');

const phone = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine((v) => PHONE_RE.test(v), 'Enter a valid phone number (e.g. +94771234567)');


const businessName = z
  .string()
  .trim()
  .min(2, 'Required. Minimum 2 characters')
  .max(80, 'Too long (maximum 80 characters)');

/* ─────────────────────────────────────────────────────────────
   Auth schemas
   ───────────────────────────────────────────────────────────── */
export function createSignupSchema(isBroker = false) {
  const shape = {
    username: name,
    email,
    password,
    phone_number: phone,
  };
  if (isBroker) shape.business_name = businessName;
  return z
    .object({
      ...shape,
      confirm_password: z.string().min(1, 'Confirm your password'),
    })
    .refine((v) => v.password === v.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    });
}

export const signupSchema = createSignupSchema(false);

export const loginSchema = z.object({
  email: emailOrMobile,
  password: z.string().min(1, 'Required'),
});

export const forgotPasswordSchema = z.object({
  email: email,
});

export const resetPasswordSchema = z.object({
  password,
  confirm_password: z.string().min(1, 'Confirm your password'),
}).refine((v) => v.password === v.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

/* ─────────────────────────────────────────────────────────────
   Profile wizard step schemas (10 steps, backend-aligned fields)
   ───────────────────────────────────────────────────────────── */
const dob = z
  .string()
  .min(1, 'Required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine((v) => {
    const age = calcAge(v);
    return age !== null && age >= 18;
  }, 'Must be 18 years or older');

const heightFeet = z.coerce.number().int().min(3, 'Invalid. Expected 3-7').max(7, 'Invalid. Expected 3-7');
const heightInches = z.coerce.number().int().min(0, 'Invalid. Expected 0-11').max(11, 'Invalid. Expected 0-11');
const longText = z.string().trim().min(2, 'Minimum 2 characters').max(200, 'Too long (maximum 200 characters)');
const aboutMe = z.string().trim().min(50, 'Minimum 50 characters').max(2000, 'Too long (maximum 2000 characters)');
const plainText = z.string().trim().max(200, 'Too long (maximum 200 characters)').optional();

export const profileSteps = [
  {
    key: 'basic',
    title: 'Basics',
    hint: 'Who is this profile for?',
    icon: 'User',
    fields: ['profile_registered_for', 'name', 'gender', 'date_of_birth'],
    schema: z.object({
      profile_registered_for: z.enum(POSTED_BY),
      name,
      gender: z.enum(['M', 'F'], { message: 'Please select a gender' }),
      date_of_birth: dob,
    }),
  },
  {
    key: 'education',
    title: 'Education & Career',
    hint: 'Your academic and professional background',
    icon: 'GraduationCap',
    fields: ['education', 'occupation'],
    schema: z.object({
      education: longText,
      occupation: longText,
    }),
  },
  {
    key: 'height',
    title: 'Height',
    hint: 'Physical details',
    icon: 'Ruler',
    fields: ['height_feet', 'height_inches'],
    schema: z.object({
      height_feet: heightFeet,
      height_inches: heightInches,
    }),
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle',
    hint: 'Day-to-day preferences',
    icon: 'Heart',
    fields: ['diet', 'family_values', 'career_goals', 'willing_to_relocate'],
    schema: z.object({
      diet: z.enum(['any', 'vegetarian', 'non_vegetarian', 'vegan', 'jain']),
      family_values: z.enum(['traditional', 'moderate', 'liberal']),
      career_goals: z.enum(['working', 'home_maker', 'open']),
      willing_to_relocate: z.enum(['open', 'local_only', 'overseas_only']),
    }),
  },
  {
    key: 'income',
    title: 'Income & Dosham',
    hint: 'Financial and astrological preferences',
    icon: 'Wallet',
    fields: ['income_range', 'manglik_status'],
    schema: z.object({
      income_range: z.string().min(1, 'Select an income range'),
      manglik_status: z.enum(['no', 'yes', 'dont_know'], { message: 'Select an option' }),
    }),
  },
  {
    key: 'religion',
    title: 'Religion & Caste',
    hint: 'Community details',
    icon: 'Landmark',
    fields: ['religion_id', 'caste_id', 'sub_religion'],
    schema: z.object({
      religion_id: z.union([z.string().min(1, 'Select a religion'), z.number()]),
      caste_id: z.union([z.string().min(1, 'Select a caste'), z.number()]),
      sub_religion: plainText,
    }),
  },
  {
    key: 'astrology',
    title: 'Astrology',
    hint: 'Raasi and nakshatram',
    icon: 'Star',
    fields: ['raasi_id', 'star_id'],
    schema: z.object({
      raasi_id: z.union([z.string().min(1, 'Select a raasi'), z.number()]),
      star_id: z.union([z.string().min(1, 'Select a star / nakshatram'), z.number()]),
    }),
  },
  {
    key: 'location',
    title: 'Location',
    hint: 'Where you were born and live now',
    icon: 'MapPin',
    fields: ['born_country_id', 'current_country_id', 'city_or_state'],
    schema: z.object({
      born_country_id: z.string().min(1, 'Select a country of birth'),
      current_country_id: z.string().min(1, 'Select a country of residence'),
      city_or_state: z.string().trim().min(2, 'Enter city or state').max(100, 'Too long'),
    }),
  },
  {
    key: 'media',
    title: 'Photos & Privacy',
    hint: 'Upload media and set privacy',
    icon: 'Camera',
    fields: ['main_profile_picture', 'horoscope_chart', 'blur_photo', 'blur_horoscope'],
    schema: z.object({
      blur_photo: z.union([z.number(), z.literal(0), z.literal(1)]),
      blur_horoscope: z.union([z.number(), z.literal(0), z.literal(1)]),
    }),
  },
  {
    key: 'bio',
    title: 'Bio & Review',
    hint: 'Tell your story',
    icon: 'FileText',
    fields: ['about_me'],
    schema: z.object({
      about_me: aboutMe,
    }),
  },
];

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */
export function getStepSchema(stepIndex) {
  return profileSteps[stepIndex].schema;
}

/** Validate one step's values → { [field]: message } */
export function validateStep(stepIndex, values) {
  const res = getStepSchema(stepIndex).safeParse(values);
  if (res.success) return {};
  return res.error.flatten().fieldErrors;
}

/** Validate a single field within a step → message or undefined */
export function validateStepField(stepIndex, field, values) {
  const res = getStepSchema(stepIndex).safeParse(values);
  if (res.success) return undefined;
  const list = res.error.flatten().fieldErrors[field];
  return list ? list[0] : undefined;
}

/** Validate one field of an object schema (auth forms) */
export function validateField(schema, field, value) {
  const res = schema.safeParse({ [field]: value });
  if (res.success) return undefined;
  const list = res.error.flatten().fieldErrors[field];
  return list ? list[0] : undefined;
}

/** Normalize backend error payloads ({ field: 'msg' | [msgs] }) → { field: firstMsg } */
export function normalizeApiErrors(payload) {
  const errors = payload?.errors || payload?.error || payload;
  if (!errors || typeof errors !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(errors)) {
    if (Array.isArray(v)) out[k] = v[0];
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}
