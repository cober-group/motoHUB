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
      fields: ['name', 'display_name', 'list_price', 'image_128', 'categ_id', 'qty_available'],
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

  async getProductByBarcode(barcode: string, locationId?: number) {
    const domain: any[] = [
      ['sale_ok', '=', true],
      ['barcode', '=', barcode],
    ];
    const kwargs: any = {
      fields: ['name', 'display_name', 'list_price', 'image_128', 'categ_id', 'qty_available', 'barcode'],
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
