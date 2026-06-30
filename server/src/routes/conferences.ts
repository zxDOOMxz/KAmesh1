import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import type { Conference } from '../types';

const router = Router();

const createConferenceSchema = z.object({
  title: z.string().min(1).max(256),
  scheduled_at: z.string().datetime().optional(),
  max_participants: z.number().min(2).max(500).default(100),
});

// GET /api/conferences — список конференций пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query<Conference>(
      `SELECT c.* FROM conferences c
       JOIN conference_participants cp ON cp.conference_id = c.id
       WHERE cp.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user!.userId]
    );
    res.json({ conferences: result.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conferences — создать конференцию
router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = createConferenceSchema.parse(req.body);
    const inviteLink = uuid();

    const result = await pool.query<Conference>(
      `INSERT INTO conferences (title, invite_link, created_by, max_participants, scheduled_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.title, inviteLink, req.user!.userId, data.max_participants, data.scheduled_at || null]
    );
    const conference = result.rows[0];

    // Add creator as admin participant
    await pool.query(
      `INSERT INTO conference_participants (conference_id, user_id, role)
       VALUES ($1, $2, 'presenter')`,
      [conference.id, req.user!.userId]
    );

    res.status(201).json({ conference });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[conferences] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conferences/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const confId = parseInt(req.params.id as string);
    const result = await pool.query<Conference>(
      'SELECT * FROM conferences WHERE id = $1',
      [confId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Conference not found' });
      return;
    }

    const participants = await pool.query(
      `SELECT u.id, u.full_name, u.avatar_url, cp.role, cp.is_muted, cp.is_video_on, cp.is_screen_sharing, cp.joined_at
       FROM conference_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.conference_id = $1`,
      [confId]
    );

    res.json({ conference: result.rows[0], participants: participants.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conferences/join/:inviteLink — присоединиться по ссылке
router.post('/join/:inviteLink', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query<Conference>(
      'SELECT * FROM conferences WHERE invite_link = $1 AND status = $2',
      [req.params.inviteLink, 'active']
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Conference not found or not active' });
      return;
    }
    const conf = result.rows[0];

    const existing = await pool.query(
      'SELECT 1 FROM conference_participants WHERE conference_id = $1 AND user_id = $2',
      [conf.id, req.user!.userId]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO conference_participants (conference_id, user_id, role) VALUES ($1, $2, $3)',
        [conf.id, req.user!.userId, 'participant']
      );
    }

    res.json({ conference: conf });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
