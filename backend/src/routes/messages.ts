import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/stores/:id/messages
router.get('/:id/messages', async (req: any, res: any) => {
  const storeId = parseInt(req.params.id);
  if (req.user.role === 'store' && req.user.storeId !== storeId)
    return res.status(403).json({ error: 'Accesso negato' });
  try {
    const { rows } = await pool.query(
      `SELECT id, sender_role, sender_email, content, read_at, created_at
       FROM messages WHERE store_id = $1 ORDER BY created_at ASC`,
      [storeId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/messages
router.post('/:id/messages', async (req: any, res: any) => {
  const storeId = parseInt(req.params.id);
  if (req.user.role === 'store' && req.user.storeId !== storeId)
    return res.status(403).json({ error: 'Accesso negato' });
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Messaggio vuoto' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (store_id, sender_role, sender_email, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [storeId, req.user.role, req.user.email, content.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stores/:id/messages/read — mark all store messages as read (called by store user)
router.patch('/:id/messages/read', async (req: any, res: any) => {
  const storeId = parseInt(req.params.id);
  if (req.user.role === 'store' && req.user.storeId !== storeId)
    return res.status(403).json({ error: 'Accesso negato' });
  // Store reads admin messages; admin reads store messages
  const senderToMark = req.user.role === 'store' ? 'admin' : 'store';
  try {
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE store_id = $1 AND sender_role = $2 AND read_at IS NULL`,
      [storeId, senderToMark]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
