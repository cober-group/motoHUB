import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { locationCache } from '../cache';

const router = Router();
router.use(authMiddleware);

// GET /api/stores — admin: tutti; store: solo il proprio
router.get('/', async (req: any, res: any) => {
  try {
    if (req.user.role === 'admin') {
      const { rows } = await pool.query(
        `SELECT s.*, COUNT(u.id)::int as user_count
         FROM stores s LEFT JOIN users u ON u.store_id = s.id
         GROUP BY s.id ORDER BY s.created_at DESC`
      );
      return res.json(rows);
    }
    if (!req.user.storeId) return res.json(null);
    const { rows } = await pool.query(`SELECT * FROM stores WHERE id = $1`, [req.user.storeId]);
    res.json(rows[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores — admin only
router.post('/', adminOnly, async (req: any, res: any) => {
  const { name, sqm = 150, odoo_location_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome negozio obbligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO stores (name, sqm, odoo_location_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, sqm, odoo_location_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stores/:id — admin only (aggiorna nome/sqm/location)
router.patch('/:id', adminOnly, async (req: any, res: any) => {
  const { name, sqm, odoo_location_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE stores SET
         name = COALESCE($1, name),
         sqm  = COALESCE($2, sqm),
         odoo_location_id = COALESCE($3, odoo_location_id)
       WHERE id = $4 RETURNING *`,
      [name, sqm, odoo_location_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Negozio non trovato' });
    // Invalida la cache location_id se il magazzino Odoo è cambiato
    locationCache.delete(parseInt(req.params.id));
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stores/:id — admin only
router.delete('/:id', adminOnly, async (req: any, res: any) => {
  try {
    await pool.query(`DELETE FROM stores WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stores/:id/users — admin only
router.get('/:id/users', adminOnly, async (req: any, res: any) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, created_at FROM users WHERE store_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/users — admin crea utente negozio
router.post('/:id/users', adminOnly, async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password obbligatori' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, store_id) VALUES ($1, $2, 'store', $3) RETURNING id, email, role, store_id`,
      [email.toLowerCase().trim(), hash, req.params.id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email già in uso' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stores/:storeId/users/:userId — admin only
router.delete('/:storeId/users/:userId', adminOnly, async (req: any, res: any) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 AND store_id = $2`, [req.params.userId, req.params.storeId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
