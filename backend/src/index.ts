import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { OdooService } from './services/odoo';
import { initDb, pool } from './db';
import authRouter from './routes/auth';
import storesRouter from './routes/stores';
import layoutsRouter from './routes/layouts';
import messagesRouter from './routes/messages';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
app.use(compression());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());

import { locationCache } from './cache';

const odoo = new OdooService({
  url: process.env.ODOO_URL || '',
  db: process.env.ODOO_DB || '',
  username: process.env.ODOO_USERNAME || '',
  apiKey: process.env.ODOO_API_KEY || '',
});

// ── Auth ──────────────────────────────────────────────────────────
app.use('/auth', authRouter);

// ── Stores (CRUD + users) ─────────────────────────────────────────
app.use('/api/stores', storesRouter);

// ── Layouts (per store, in DB) ────────────────────────────────────
app.use('/api/stores', layoutsRouter);

// ── Messages (chat admin ↔ store) ─────────────────────────────────────
app.use('/api/stores', messagesRouter);

// ── Odoo: init ───────────────────────────────────────────────────
app.get('/api/odoo/init', authMiddleware, async (req: any, res: any) => {
  try {
    const categories = await odoo.getCategories();
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Odoo: products (with per-store location support) ─────────────
app.get('/api/odoo/products', authMiddleware, async (req: any, res: any) => {
  const { category, search, fixture_type, offset, limit } = req.query;

  let locationId: number | undefined;
  if (req.user.storeId) {
    if (!locationCache.has(req.user.storeId)) {
      try {
        const { rows } = await pool.query(
          `SELECT odoo_location_id FROM stores WHERE id = $1`, [req.user.storeId]
        );
        locationCache.set(req.user.storeId, rows[0]?.odoo_location_id ?? null);
      } catch { locationCache.set(req.user.storeId, null); }
    }
    locationId = locationCache.get(req.user.storeId) ?? undefined;
  }

  try {
    const parsedCategory = parseInt(category as string);
    const products = await odoo.getProducts(
      search as string,
      !isNaN(parsedCategory) ? parsedCategory : undefined,
      fixture_type as string | undefined,
      Math.max(0, parseInt(offset as string) || 0),
      Math.min(100, parseInt(limit as string) || 20),
      locationId
    );
    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Odoo: product stats ───────────────────────────────────────────────
app.get('/api/odoo/product/:id/stats', authMiddleware, async (req: any, res: any) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: 'ID non valido' });

  let locationId: number | undefined;
  if (req.user.storeId) {
    if (!locationCache.has(req.user.storeId)) {
      try {
        const { rows } = await pool.query(`SELECT odoo_location_id FROM stores WHERE id = $1`, [req.user.storeId]);
        locationCache.set(req.user.storeId, rows[0]?.odoo_location_id ?? null);
      } catch { locationCache.set(req.user.storeId, null); }
    }
    locationId = locationCache.get(req.user.storeId) ?? undefined;
  }

  try {
    const stats = await odoo.getProductStats(productId, locationId);
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Odoo: product by barcode ─────────────────────────────────────────
app.get('/api/odoo/barcode', authMiddleware, async (req: any, res: any) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: 'Barcode mancante' });

  let locationId: number | undefined;
  if (req.user.storeId) {
    if (!locationCache.has(req.user.storeId)) {
      try {
        const { rows } = await pool.query(`SELECT odoo_location_id FROM stores WHERE id = $1`, [req.user.storeId]);
        locationCache.set(req.user.storeId, rows[0]?.odoo_location_id ?? null);
      } catch { locationCache.set(req.user.storeId, null); }
    }
    locationId = locationCache.get(req.user.storeId) ?? undefined;
  }

  try {
    const product = await odoo.getProductByBarcode(barcode as string, locationId);
    if (!product) return res.status(404).json({ error: 'Prodotto non trovato' });
    res.json({ product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Odoo: locations (per admin — mostra le location Odoo disponibili) ──
app.get('/api/odoo/locations', authMiddleware, async (req: any, res: any) => {
  try {
    const locations = await odoo.execute('stock.location', 'search_read',
      [[['usage', '=', 'internal'], ['active', '=', true]]],
      { fields: ['id', 'name', 'complete_name'], limit: 100 }
    );
    res.json({ locations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(port, () => {
    console.log(`[Server] Backend attivo su http://localhost:${port}`);
  });
}).catch(err => {
  console.error('[DB] Impossibile inizializzare il database:', err.message);
  process.exit(1);
});
