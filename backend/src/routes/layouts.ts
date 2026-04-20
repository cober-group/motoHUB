import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/stores/:id/layout
router.get('/:id/layout', async (req: any, res: any) => {
  const storeId = parseInt(req.params.id);

  // store users can only access their own store
  if (req.user.role === 'store' && req.user.storeId !== storeId) {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT items, width_m, depth_m FROM layouts WHERE store_id = $1`, [storeId]
    );
    res.json({ items: rows[0]?.items ?? [], widthM: rows[0]?.width_m ?? 15, depthM: rows[0]?.depth_m ?? 10 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stores/:id/layout
router.put('/:id/layout', async (req: any, res: any) => {
  const storeId = parseInt(req.params.id);

  if (req.user.role === 'store' && req.user.storeId !== storeId) {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { items, widthM, depthM } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items deve essere un array' });

  try {
    await pool.query(
      `INSERT INTO layouts (store_id, items, width_m, depth_m, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (store_id) DO UPDATE SET items = $2, width_m = $3, depth_m = $4, updated_at = NOW()`,
      [storeId, JSON.stringify(items), widthM ?? 15, depthM ?? 10]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
