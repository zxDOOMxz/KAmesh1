import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import type { Chat, UserPublic } from '../types';

const router = Router();

const createChatSchema = z.object({
  name: z.string().max(256).optional(),
  type: z.enum(['direct', 'group', 'department']),
  description: z.string().optional(),
  member_ids: z.array(z.number()).min(1),
});

// GET /api/chats — список чатов пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query<Chat>(
      `SELECT c.* FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE cm.user_id = $1 AND c.is_archived = false
       ORDER BY c.updated_at DESC`,
      [req.user!.userId]
    );
    res.json({ chats: result.rows });
  } catch (err) {
    console.error('[chats] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chats — создать чат
router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = createChatSchema.parse(req.body);
    const memberIds = [...new Set([req.user!.userId, ...data.member_ids])];

    // For direct chats, check if one already exists
    if (data.type === 'direct') {
      const existing = await pool.query(
        `SELECT c.id FROM chats c
         WHERE c.type = 'direct' AND c.id IN (
           SELECT chat_id FROM chat_members WHERE user_id = $1
         ) AND c.id IN (
           SELECT chat_id FROM chat_members WHERE user_id = $2
         )`,
        [req.user!.userId, data.member_ids[0]]
      );
      if (existing.rows.length > 0) {
        res.json({ chat: existing.rows[0], existing: true });
        return;
      }
    }

    // Create chat
    const chatResult = await pool.query<Chat>(
      `INSERT INTO chats (name, type, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name || null, data.type, data.description || null, req.user!.userId]
    );
    const chat = chatResult.rows[0];

    // Add members
    const roles = memberIds.map((id) => (id === req.user!.userId ? 'owner' : 'member'));
    const params: unknown[] = [chat.id];
    const placeholders = memberIds.map((_, i) => {
      params.push(memberIds[i], roles[i]);
      return `($1, $${params.length - 1}, $${params.length})`;
    });
    await pool.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ${placeholders.join(', ')}`,
      params
    );

    res.status(201).json({ chat });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[chats] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/chats/:id — информация о чате
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const chatId = parseInt(req.params.id as string);
    const chat = await pool.query<Chat>(
      `SELECT c.* FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE c.id = $1 AND cm.user_id = $2`,
      [chatId, req.user!.userId]
    );
    if (chat.rows.length === 0) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const members = await pool.query<UserPublic>(
      `SELECT u.id, u.login, u.phone, u.full_name, u.email, u.avatar_url, u.role, u.department, u.position_title
       FROM users u JOIN chat_members cm ON cm.user_id = u.id
       WHERE cm.chat_id = $1`,
      [chatId]
    );

    res.json({ chat: chat.rows[0], members: members.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/chats/:id — обновить чат (только для admin/owner)
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const chatId = parseInt(req.params.id as string);
    const member = await pool.query(
      `SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chatId, req.user!.userId]
    );
    if (member.rows.length === 0 || !['owner', 'admin'].includes(member.rows[0].role)) {
      res.status(403).json({ error: 'Only chat admin can edit' });
      return;
    }

    const { name, description } = req.body;
    const result = await pool.query<Chat>(
      `UPDATE chats SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name || null, description || null, chatId]
    );
    res.json({ chat: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
