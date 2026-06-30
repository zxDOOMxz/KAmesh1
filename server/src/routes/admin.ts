import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin, requireRole } from '../middleware/requireRole';
import type { User } from '../types';

const router = Router();

// Все админские маршруты требуют авторизации
router.use(authMiddleware);

// ============ УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ============

// GET /api/admin/users — список всех пользователей (admin)
router.get('/users', requireAdmin(), async (_req, res) => {
  try {
    const result = await pool.query<User>(
      `SELECT id, login, phone, full_name, email, avatar_url, role, department, position_title, is_active, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users/:id — информация о пользователе
router.get('/users/:id', requireRole('operator'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id as string);
    const result = await pool.query<User>(
      `SELECT id, login, phone, full_name, email, avatar_url, role, department, position_title, is_active, created_at
       FROM users WHERE id = $1`,
      [userId]
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

// PATCH /api/admin/users/:id — изменить пользователя (admin может всё, operator — ограниченно)
router.patch('/users/:id', requireRole('operator'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id as string);
    const { role, department, position_title, is_active, full_name, phone, email } = req.body;

    // operator не может менять роль на admin
    if (req.user!.role === 'operator' && role === 'admin') {
      res.status(403).json({ error: 'Operator cannot assign admin role' });
      return;
    }

    // operator не может менять роль другим operator или admin
    if (req.user!.role === 'operator') {
      const target = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (target.rows.length > 0 && target.rows[0].role !== 'user') {
        res.status(403).json({ error: 'Operator can only edit regular users' });
        return;
      }
    }

    const result = await pool.query<User>(
      `UPDATE users SET
        role = COALESCE($1, role),
        department = COALESCE($2, department),
        position_title = COALESCE($3, position_title),
        is_active = COALESCE($4, is_active),
        full_name = COALESCE($5, full_name),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, login, phone, full_name, email, avatar_url, role, department, position_title, is_active, created_at`,
      [role || null, department || null, position_title || null, is_active ?? null, full_name || null, phone || null, email || null, userId]
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

// POST /api/admin/users — создать пользователя (admin)
router.post('/users', requireAdmin(), async (req, res) => {
  try {
    const schema = z.object({
      login: z.string().min(3).max(64),
      password: z.string().min(6).max(128),
      phone: z.string().min(10).max(20),
      full_name: z.string().min(1).max(256),
      role: z.enum(['user', 'operator', 'admin']).default('user'),
      email: z.string().email().optional(),
      department: z.string().optional(),
      position_title: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE login = $1 OR phone = $2', [data.login, data.phone]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Login or phone already taken' });
      return;
    }

    const password_hash = await bcrypt.hash(data.password, 12);
    const result = await pool.query<User>(
      `INSERT INTO users (login, password_hash, phone, full_name, role, email, department, position_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, login, phone, full_name, email, avatar_url, role, department, position_title, is_active, created_at`,
      [data.login, password_hash, data.phone, data.full_name, data.role, data.email || null, data.department || null, data.position_title || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[admin] create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id — деактивировать пользователя (admin)
router.delete('/users/:id', requireAdmin(), async (req, res) => {
  try {
    const userId = parseInt(req.params.id as string);
    if (userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot deactivate yourself' });
      return;
    }
    await pool.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ СИСТЕМНЫЕ НАСТРОЙКИ ============

// GET /api/admin/stats — статистика системы (admin)
router.get('/stats', requireAdmin(), async (_req, res) => {
  try {
    const [users, chats, messages, conferences] = await Promise.all([
      pool.query('SELECT COUNT(*)::int FROM users'),
      pool.query('SELECT COUNT(*)::int FROM chats'),
      pool.query('SELECT COUNT(*)::int FROM messages'),
      pool.query('SELECT COUNT(*)::int FROM conferences WHERE status = $1', ['active']),
    ]);

    res.json({
      stats: {
        total_users: users.rows[0].count,
        total_chats: chats.rows[0].count,
        total_messages: messages.rows[0].count,
        active_conferences: conferences.rows[0].count,
      },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
