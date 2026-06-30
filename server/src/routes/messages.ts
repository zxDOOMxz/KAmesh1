import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import type { Message } from '../types';

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().max(10000).optional(),
  content_type: z.enum(['text', 'image', 'file', 'voice']).default('text'),
  file_url: z.string().optional(),
  file_name: z.string().max(256).optional(),
  file_size: z.number().positive().optional(),
  mime_type: z.string().max(128).optional(),
  reply_to: z.number().positive().optional(),
});

// GET /api/chats/:chatId/messages
router.get('/:chatId/messages', authMiddleware, async (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId as string);
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200);
    const offset = parseInt(String(req.query.offset)) || 0;

    // Verify membership
    const member = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user!.userId]
    );
    if (member.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this chat' });
      return;
    }

    const result = await pool.query<Message>(
      `SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.chat_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [chatId, limit, offset]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    console.error('[messages] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chats/:chatId/messages
router.post('/:chatId/messages', authMiddleware, async (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId as string);
    const data = sendMessageSchema.parse(req.body);

    if (!data.content && !data.file_url) {
      res.status(400).json({ error: 'Message must have content or file' });
      return;
    }

    const member = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user!.userId]
    );
    if (member.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this chat' });
      return;
    }

    const result = await pool.query<Message>(
      `INSERT INTO messages (chat_id, sender_id, content, content_type, file_url, file_name, file_size, mime_type, reply_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [chatId, req.user!.userId, data.content || null, data.content_type, data.file_url || null, data.file_name || null, data.file_size || null, data.mime_type || null, data.reply_to || null]
    );

    // Update chat's updated_at
    await pool.query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[messages] send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
