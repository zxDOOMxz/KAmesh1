import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool';
import { signAccessToken, signRefreshToken, verifyToken, getRefreshExpiresAt } from '../utils/tokens';
import { authMiddleware } from '../middleware/auth';
import type { User } from '../types';

const router = Router();

const registerSchema = z.object({
  login: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
  phone: z.string().min(10).max(20),
  full_name: z.string().min(1).max(256),
  email: z.string().email().optional(),
  department: z.string().optional(),
  position_title: z.string().optional(),
});

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await pool.query(
      'SELECT id FROM users WHERE login = $1 OR phone = $2',
      [data.login, data.phone]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Login or phone already taken' });
      return;
    }

    const password_hash = await bcrypt.hash(data.password, 12);
    const result = await pool.query<User>(
      `INSERT INTO users (login, password_hash, phone, full_name, email, department, position_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, login, phone, full_name, email, avatar_url, role, department, position_title, created_at`,
      [data.login, password_hash, data.phone, data.full_name, data.email || null, data.department || null, data.position_title || null]
    );

    const user = result.rows[0];
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await pool.query(
      'INSERT INTO sessions (user_id, refresh_token, device_info, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, refreshToken, req.headers['user-agent'] || null, req.ip, getRefreshExpiresAt()]
    );

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[auth] register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await pool.query<User>(
      'SELECT * FROM users WHERE login = $1 AND is_active = true',
      [data.login]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid login or password' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid login or password' });
      return;
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await pool.query(
      'INSERT INTO sessions (user_id, refresh_token, device_info, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, refreshToken, req.headers['user-agent'] || null, req.ip, getRefreshExpiresAt()]
    );

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const session = await pool.query(
      'SELECT user_id FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    if (session.rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const payload = verifyToken(refreshToken);
    const userResult = await pool.query<User>('SELECT role FROM users WHERE id = $1', [payload.userId]);
    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Rotate refresh token
    await pool.query('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);

    const newPayload = { userId: payload.userId, role: userResult.rows[0].role };
    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    await pool.query(
      'INSERT INTO sessions (user_id, refresh_token, device_info, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [payload.userId, newRefreshToken, req.headers['user-agent'] || null, req.ip, getRefreshExpiresAt()]
    );

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      res.status(404).json({ error: 'No account with this email' });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = [...Array(48)].map(() => Math.random().toString(36)[2]).join('');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create password_resets table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(256) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(
      'INSERT INTO password_resets (user_id, token, code, expires_at) VALUES ($1, $2, $3, $4)',
      [user.rows[0].id, token, code, expiresAt]
    );

    console.log(`[Password Reset] Email=${email} Code=${code} Token=${token.slice(0, 12)}...`);

    res.json({ ok: true, message: 'If the email exists, a reset code has been sent' });
  } catch (err) {
    console.error('[auth] forgot-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, code, and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      res.status(404).json({ error: 'No account with this email' });
      return;
    }

    const userId = user.rows[0].id;
    const reset = await pool.query(
      'SELECT id FROM password_resets WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [userId, code]
    );
    if (reset.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset code' });
      return;
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, userId]);
    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [reset.rows[0].id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    res.json({ ok: true, message: 'Password has been reset' });
  } catch (err) {
    console.error('[auth] reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);
    }
    // Optionally delete all sessions for this user
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query<User>(
      `SELECT id, login, phone, full_name, email, avatar_url, role, department, position_title, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
