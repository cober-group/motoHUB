import xmlrpc from 'xmlrpc';

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

export class OdooService {
  private config: OdooConfig;
  private uid: number | null = null;

  constructor(config: OdooConfig) {
    this.config = config;
  }

  private getClient(path: string) {
    const isHttps = this.config.url.startsWith('https://');
    const url = new URL(this.config.url);
    const options = {
      host: url.hostname,
      port: parseInt(url.port) || (isHttps ? 443 : 80),
      path: path,
      rejectUnauthorized: false, // Useful for dev/sh subdomains
    };
    return isHttps ? xmlrpc.createSecureClient(options) : xmlrpc.createClient(options);
  }

  private authPromise: Promise<number> | null = null;

  async authenticate(): Promise<number> {
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      if (!this.config.url) throw new Error('ODOO_URL non configurato');
      const url = new URL(this.config.url);
      const subdomain = url.hostname.split('.')[0];
      const variants = [
        this.config.db,
        subdomain,
        subdomain.replace(/-/g, '_'),
        subdomain.split('-').slice(-1)[0],
        'main',
        subdomain.split('-').slice(0, 2).join('-'),
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      console.log(`[Odoo] Avvio autenticazione su varianti: ${variants.join(', ')}`);

      for (const dbVariant of variants) {
        try {
          const successUid = await new Promise<number | null>((resolve) => {
            const common = this.getClient('/xmlrpc/2/common');
            common.methodCall(
              'authenticate',
              [dbVariant, this.config.username, this.config.apiKey, {}],
              (error: any, value: any) => {
                if (error || value === false) resolve(null);
                else {
                  this.config.db = dbVariant;
                  resolve(value);
                }
              }
            );
          });

          if (successUid) {
            this.uid = successUid;
            this.authPromise = Promise.resolve(this.uid);
            console.log(`[Odoo] CONNESSO! DB: ${dbVariant} | UID: ${this.uid}`);
            return this.uid;
          }
        } catch (e) {
          continue;
        }
      }
      this.authPromise = null;
      throw new Error('Authentication failed');
    })();

    return this.authPromise;
  }

  async execute(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    if (!this.uid) await this.authenticate();
    const object = this.getClient('/xmlrpc/2/object');
    return new Promise((resolve, reject) => {
      object.methodCall(
        'execute_kw',
        [this.config.db, this.uid, this.config.apiKey, model, method, args, kwargs],
        (error: any, value: any) => {
          if (error) return reject(error);
          resolve(value);
        }
      );
    });
  }

  private static FIXTURE_PARENT: Record<string, string> = {
    helmet: 'caschi',
    jacket: 'abbigliamento',
  };

  // Cached once after first lookup
  private categoryCache: { id: number; name: string; complete_name: string }[] | null = null;

  private async getFixtureCategoryId(fixtureType: string): Promise<number | null> {
    if (!this.categoryCache) {
      this.categoryCache = await this.execute('product.category', 'search_read', [], {
        fields: ['id', 'name', 'complete_name'],
      });
      console.log('[Odoo] Categorie caricate (cache):', this.categoryCache!.map(c => `${c.id}: ${c.complete_name}`).join('\n'));
    }
    const keyword = OdooService.FIXTURE_PARENT[fixtureType];
    if (!keyword) return null;
    const match = this.categoryCache!.find(c =>
      c.name.toLowerCase().includes(keyword) ||
      c.complete_name?.toLowerCase().includes(keyword)
    );
    console.log(`[Odoo] fixture_type="${fixtureType}" → ${match ? `ID ${match.id}: ${match.complete_name}` : 'NESSUNA'}`);
    return match?.id ?? null;
  }

  async getProducts(
    search?: string,
    categoryId?: number,
    fixtureType?: string,
    offset = 0,
    limit = 20,
    locationId?: number   // Odoo stock.location ID for per-store inventory
  ) {
    const domain: any[] = [['sale_ok', '=', true]];

    if (fixtureType && fixtureType !== 'central') {
      const catId = await this.getFixtureCategoryId(fixtureType);
      if (catId) domain.push(['categ_id', 'child_of', catId]);
    } else if (categoryId) {
      domain.push(['categ_id', 'child_of', categoryId]);
    }

    if (search) {
      domain.push('|');
      domain.push(['name', 'ilike', search]);
      domain.push(['default_code', 'ilike', search]);
    }

    // Pass location context so qty_available reflects per-store stock
    const kwargs: any = {
      fields: ['name', 'display_name', 'list_price', 'image_128', 'categ_id', 'qty_available', 'sales_count', 'default_code'],
      limit,
      offset,
    };
    if (locationId) {
      kwargs.context = { location: locationId };
      // Filter only items with stock in this location
      domain.push(['qty_available', '>', 0]);
    } else {
      domain.push(['qty_available', '>', 0]);
    }

    return this.execute('product.product', 'search_read', [domain], kwargs);
  }

  async getTrendingProducts(fixtureType?: string, locationId?: number, limit = 8) {
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

    // Get all sold lines in last 30 days
    const lines = await this.execute('sale.order.line', 'search_read',
      [[['order_id.state', 'in', ['sale', 'done']], ['order_id.date_order', '>=', fmt(d30)]]],
      { fields: ['product_id', 'product_uom_qty'], limit: 1000 }
    );

    // Aggregate quantity sold per product
    const sums: Record<number, number> = {};
    for (const l of lines) {
      const pid = Array.isArray(l.product_id) ? l.product_id[0] : l.product_id;
      sums[pid] = (sums[pid] || 0) + (l.product_uom_qty || 0);
    }

    const topIds = Object.entries(sums)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit * 4)
      .map(([id]) => parseInt(id));

    if (!topIds.length) return [];

    const domain: any[] = [['id', 'in', topIds], ['sale_ok', '=', true], ['qty_available', '>', 0]];
    if (fixtureType && fixtureType !== 'central') {
      const catId = await this.getFixtureCategoryId(fixtureType);
      if (catId) domain.push(['categ_id', 'child_of', catId]);
    }

    const kwargs: any = {
      fields: ['name', 'display_name', 'list_price', 'image_128', 'categ_id', 'qty_available'],
      limit: limit * 2,
    };
    if (locationId) kwargs.context = { location: locationId };

    const products = await this.execute('product.product', 'search_read', [domain], kwargs);
    return products
      .map((p: any) => ({ ...p, sold_30d: sums[p.id] || 0 }))
      .sort((a: any, b: any) => b.sold_30d - a.sold_30d)
      .slice(0, limit);
  }

  async getProductStats(productId: number, locationId?: number) {
    // Fetch cost price and base data
    const [detail] = await this.execute('product.product', 'read', [[productId]], {
      fields: ['name', 'display_name', 'list_price', 'standard_price', 'qty_available', 'sales_count', 'default_code', 'barcode'],
      context: locationId ? { location: locationId } : {},
    });

    // Sales in last 30 and 90 days
    const now = new Date();
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
    const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

    const [lines30, lines90] = await Promise.all([
      this.execute('sale.order.line', 'search_read',
        [[['product_id', '=', productId], ['order_id.state', 'in', ['sale', 'done']], ['order_id.date_order', '>=', fmt(d30)]]],
        { fields: ['product_uom_qty'], limit: 500 }
      ),
      this.execute('sale.order.line', 'search_read',
        [[['product_id', '=', productId], ['order_id.state', 'in', ['sale', 'done']], ['order_id.date_order', '>=', fmt(d90)]]],
        { fields: ['product_uom_qty'], limit: 500 }
      ),
    ]);

    const sold30 = lines30.reduce((s: number, l: any) => s + (l.product_uom_qty || 0), 0);
    const sold90 = lines90.reduce((s: number, l: any) => s + (l.product_uom_qty || 0), 0);

    return { ...detail, sold30, sold90 };
  }

  async getProductByBarcode(barcode: string, locationId?: number) {
    const domain: any[] = [
      ['sale_ok', '=', true],
      ['barcode', '=', barcode],
    ];
    const kwargs: any = {
      fields: ['name', 'display_name', 'list_price', 'image_128', 'categ_id', 'qty_available', 'barcode', 'sales_count', 'default_code'],
      limit: 1,
    };
    if (locationId) kwargs.context = { location: locationId };
    const results = await this.execute('product.product', 'search_read', [domain], kwargs);
    return results[0] || null;
  }

  async getCategories() {
    return this.execute('product.category', 'search_read', [], {
      fields: ['name', 'parent_id'],
    });
  }

  async getInitialData() {
    console.log('[Odoo] Caricamento Lazy attivo...');
    
    try {
      // Step 1: Auth (guaranteed once)
      await this.authenticate();
      
      // Step 2: Fetch categories ONLY
      const categories = await this.getCategories();
      console.log(`[Odoo] ${categories.length} Categorie caricate (Modalità Lazy).`);

      return { categories, products: [], helmets: [], apparel: [] };
    } catch (error: any) {
      console.error('[Odoo] Errore critico:', error.message);
      throw error;
    }
  }
}
