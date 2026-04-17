import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password obbligatori' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role, store_id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, storeId: user.store_id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, storeId: user.store_id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req: any, res: any) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.role, u.store_id, s.name as store_name, s.sqm
       FROM users u LEFT JOIN stores s ON s.id = u.store_id
       WHERE u.id = $1`,
      [req.user.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
