const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const {
  setAuthCookie,
  setAdminAuthCookie,
  clearAuthCookie,
  requireAuth,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_TTL_MS,
} = require('../middleware/auth');
const { rateLimit, clientIp } = require('../middleware/rateLimit');
const { logAdminLogin } = require('../utils/adminLogger');
const { sendMail, otpEmailTemplate } = require('../utils/email');

const router = express.Router();

// Brute-force protection for the admin login endpoint: max 10 attempts per
// IP + email within a 15-minute window, then a 429 with Retry-After.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
});

const USERNAME_RE = /^[a-zA-Z0-9_]{4,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

function validateSignup(body) {
  const errors = {};
  if (!body.username || !USERNAME_RE.test(body.username))
    errors.username = 'Invalid Format. Expected: 4-30 characters, letters/numbers/underscore only';
  if (!body.email || !EMAIL_RE.test(body.email))
    errors.email = 'Invalid Format. Expected format: name@example.com';
  if (!body.password || !PASSWORD_RE.test(body.password))
    errors.password = 'Password too weak. Required: Min 8 chars, 1 uppercase, 1 special character';
  if (!body.phone_number || !PHONE_RE.test(body.phone_number))
    errors.phone_number = 'Invalid Format. Expected format: +94771234567';
  if (!['regular', 'broker'].includes(body.role))
    errors.role = 'Please select Regular User or Marriage Broker';
  if (body.role === 'broker' && (!body.business_name || body.business_name.trim().length < 2))
    errors.business_name = 'Business name is required for broker accounts (min 2 characters)';
  if (body.ui_language && !['en', 'ta'].includes(body.ui_language))
    errors.ui_language = 'Invalid language selection';
  return errors;
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const errors = validateSignup(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    const { username, email, password, phone_number, role, business_name, ui_language } = req.body;

    const bannedUser = await db.get('SELECT id FROM users WHERE email = ? AND is_banned = 1', [email]);
    if (bannedUser) {
      return res.status(403).json({ errors: { email: 'Your account has been banned. You are not allowed to create a new account.' } });
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ errors: { email: 'An account with this email or username already exists' } });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const is_approved = role === 'regular' ? 1 : 0;

    const info = await db.run(
      'INSERT INTO users (username, email, password_hash, phone_number, role, business_name, is_approved, ui_language) VALUES (?,?,?,?,?,?,?,?)',
      [username, email, password_hash, phone_number, role, business_name || null, is_approved, ui_language || 'en']
    );

    const user = await db.get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);

    if (role === 'regular') {
      setAuthCookie(res, user);
      return res.status(201).json({ user: sanitize(user), status: 'active' });
    }
    return res.status(201).json({ status: 'pending_approval', message: 'Account Created. Waiting for Email Verification & Admin Approval' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ errors: { email: 'Email and password are required' } });

    const identifier = email.trim();
    const user = await db.get('SELECT * FROM users WHERE email = ? OR phone_number = ?', [identifier, identifier]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ errors: { password: 'Incorrect email or password' } });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been banned. Please contact support.' });
    }
    if (user.role === 'broker' && !user.is_approved) {
      return res.status(403).json({ status: 'pending_approval', message: 'Account Created. Waiting for Email Verification & Admin Approval' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admins must log in at /admin' });
    }
    setAuthCookie(res, user);
    res.json({ user: sanitize(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Mobile token auth ─────────────────────────────────────────────────────────
// Returns a short-lived access token + rotating refresh token (no cookies).
// Reuses the same credential checks as /login so behaviour stays identical.
router.post('/mobile/login', async (req, res) => {
  try {
    const { email, password, device_info } = req.body;
    if (!email || !password) return res.status(400).json({ errors: { email: 'Email and password are required' } });

    const identifier = email.trim();
    const user = await db.get('SELECT * FROM users WHERE email = ? OR phone_number = ?', [identifier, identifier]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ errors: { password: 'Incorrect email or password' } });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been banned. Please contact support.' });
    }
    if (user.role === 'broker' && !user.is_approved) {
      return res.status(403).json({ status: 'pending_approval', message: 'Account Created. Waiting for Email Verification & Admin Approval' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admins must log in via the admin panel' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info) VALUES (?,?,?,?)',
      [user.id, hashToken(refreshToken), String(expiresAt), device_info || 'mobile']
    );

    res.json({ user: sanitize(user), accessToken, refreshToken, expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/mobile/refresh — rotate refresh token, issue new access token.
router.post('/mobile/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const tokenHash = hashToken(refreshToken);
    const stored = await db.get('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    if (!stored || stored.revoked_at) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    if (Date.now() > Number(stored.expires_at)) {
      await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [Date.now(), stored.id]);
      return res.status(401).json({ error: 'Refresh token expired, please log in again' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [stored.user_id]);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (user.is_banned) {
      await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ?', [Date.now(), user.id]);
      return res.status(403).json({ error: 'Your account has been banned. Please contact support.' });
    }

    // Rotate: revoke the old token, issue a fresh pair.
    await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [Date.now(), stored.id]);
    const accessToken = signAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    const expiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info) VALUES (?,?,?,?)',
      [user.id, hashToken(newRefreshToken), String(expiresAt), stored.device_info || 'mobile']
    );

    res.json({ user: sanitize(user), accessToken, refreshToken: newRefreshToken, expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/mobile/logout — revoke the presented refresh token.
router.post('/mobile/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?', [Date.now(), hashToken(refreshToken)]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/admin-login
router.post('/admin-login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ip = clientIp(req);
    const ua = req.headers['user-agent'] || '';

    // Validate input — both fields are mandatory.
    if (!email || !password) {
      logAdminLogin({ ok: false, email, ip, reason: 'missing_fields', userAgent: ua });
      return res.status(400).json({ errors: { general: 'Email and password are required' } });
    }
    if (typeof email !== 'string' || email.length > 255) {
      return res.status(400).json({ errors: { general: 'Invalid email format' } });
    }

    // Fetch admin user (don't reveal whether the email exists).
    const user = await db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email.trim().toLowerCase(), 'admin']);

    // Always run bcrypt compare (even against a fake hash) to prevent timing attacks.
    const fakeHash = '$2b$12$invalidhashfortimingprotectiononly000000000000000000';
    const hashToCompare = user ? user.password_hash : fakeHash;
    const passwordOk = bcrypt.compareSync(String(password), hashToCompare);

    // Single generic message: never reveal which credential was wrong.
    if (!user || !passwordOk) {
      logAdminLogin({ ok: false, email: email.trim(), ip, reason: 'bad_credentials', userAgent: ua });
      return res.status(401).json({ errors: { general: 'Invalid email or password' } });
    }

    if (user.is_approved !== 1) {
      logAdminLogin({ ok: false, email: email.trim(), ip, reason: 'not_approved', userAgent: ua });
      return res.status(403).json({ error: 'Account not authorized' });
    }

    // Success — short-lived, sliding admin session.
    setAdminAuthCookie(res, user);
    logAdminLogin({ ok: true, email: email.trim(), ip, userAgent: ua });
    res.json({ user: sanitize(user) });
  } catch (err) {
    console.error('[ADMIN-AUTH] Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.is_banned) {
      clearAuthCookie(res);
      return res.status(403).json({ error: 'Your account has been banned. Please contact support.' });
    }
    res.json({ user: sanitize(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password/request
router.post('/forgot-password/request', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ errors: { email: 'No account found with this email' } });

    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = String(Date.now() + 30 * 60 * 1000);
    await db.run('UPDATE users SET reset_otp = ?, reset_otp_expires = ? WHERE id = ?', [otp, expires, user.id]);

    const emailSent = await sendMail({
      to: user.email,
      subject: 'Mukurtham Matrimony — Password Reset Code',
      html: otpEmailTemplate(otp),
    }).catch(() => false);

    if (!emailSent)
      return res.status(500).json({ error: 'Could not send email. Please try again later.' });

    res.json({ message: 'Verification code sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ errors: { otp: 'Invalid or expired code' } });
    }
    if (String(user.reset_otp) !== String(otp)) {
      return res.status(400).json({ errors: { otp: 'Invalid code. Please check and try again' } });
    }
    if (Date.now() > Number(user.reset_otp_expires)) {
      return res.status(400).json({ errors: { otp: 'Code expired. Please request a new one' } });
    }
    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password/reset
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || String(user.reset_otp) !== String(otp) || Date.now() > Number(user.reset_otp_expires)) {
      return res.status(400).json({ errors: { otp: 'Invalid or expired code' } });
    }
    if (!PASSWORD_RE.test(new_password || '')) {
      return res.status(400).json({ errors: { new_password: 'Password too weak. Required: Min 8 chars, 1 uppercase, 1 special character' } });
    }
    const password_hash = bcrypt.hashSync(new_password, 10);
    await db.run('UPDATE users SET password_hash = ?, reset_otp = NULL, reset_otp_expires = NULL WHERE id = ?', [password_hash, user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Signup email verification ────────────────────────────────────────────────
// POST /api/auth/signup/verify/request — send a 6-digit OTP for email verification
router.post('/signup/verify/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ errors: { email: 'Valid email is required' } });
    }
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (!user) {
      return res.status(404).json({ errors: { email: 'No account found with this email' } });
    }
    if (user.email_verified) {
      return res.status(400).json({ errors: { email: 'Email is already verified' } });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = String(Date.now() + 30 * 60 * 1000);
    await db.run('UPDATE users SET reset_otp = ?, reset_otp_expires = ? WHERE id = ?', [otp, expires, user.id]);

    const emailSent = await sendMail({
      to: user.email,
      subject: 'Mukurtham Matrimony — Email Verification Code',
      html: otpEmailTemplate(otp),
    }).catch(() => false);

    if (!emailSent) {
      return res.status(500).json({ error: 'Could not send verification email. Please try again later.' });
    }
    res.json({ message: 'Verification code sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/signup/verify — verify the OTP and mark email as verified
router.post('/signup/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ errors: { otp: 'Email and code are required' } });
    }
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (!user) {
      return res.status(400).json({ errors: { otp: 'Invalid or expired code' } });
    }
    if (String(user.reset_otp) !== String(otp)) {
      return res.status(400).json({ errors: { otp: 'Invalid code. Please check and try again' } });
    }
    if (Date.now() > Number(user.reset_otp_expires)) {
      return res.status(400).json({ errors: { otp: 'Code expired. Please request a new one' } });
    }

    await db.run(
      'UPDATE users SET email_verified = 1, reset_otp = NULL, reset_otp_expires = NULL WHERE id = ?',
      [user.id]
    );
    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function sanitize(user) {
  const { password_hash, reset_otp, reset_otp_expires, ...rest } = user;
  return rest;
}

module.exports = router;
