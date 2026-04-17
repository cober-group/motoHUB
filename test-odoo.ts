import { OdooService } from './backend/src/services/odoo';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const config = {
  url: process.env.ODOO_URL || '',
  db: process.env.ODOO_DB || '',
  username: process.env.ODOO_USERNAME || '',
  apiKey: process.env.ODOO_API_KEY || ''
};

async function diagnose() {
  console.log('--- DIAGNOSTICA ODOO ---');
  console.log('URL:', config.url);
  
  const odoo = new OdooService(config);
  
  try {
    console.log('Autenticazione in corso...');
    await odoo.authenticate();
    
    console.log('Recupero categorie...');
    const cats = await odoo.getCategories();
    console.log('CATEGORIE TROVATE:', cats.map((c: any) => c.name).slice(0, 20));

    console.log('Recupero prodotti (500)...');
    const products = await odoo.getProducts();
    console.log('NUMERO PRODOTTI TOTALI:', products.length);
    
    const helmetKeywords = ['helmet', 'casco', 'full face'];
    const helmets = products.filter((p: any) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.categ_id?.[1] || '').toLowerCase();
        return helmetKeywords.some(k => name.includes(k) || cat.includes(k));
    });

    console.log('CASCHI FILTRATI:', helmets.map((h: any) => h.name).slice(0, 5));
    console.log('PRIMI 10 PRODOTTI IN ASSOLUTO:', products.map((p: any) => p.name).slice(0, 10));

  } catch (err) {
    console.error('ERRORE DURANTE LA DIAGNOSTICA:', err);
  }
}

diagnose();
