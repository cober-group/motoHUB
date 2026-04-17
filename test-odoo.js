const xmlrpc = require('xmlrpc');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.join(__dirname, 'backend', '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) { process.env[k] = envConfig[k]; }

const config = {
  url: process.env.ODOO_URL || '',
  db: process.env.ODOO_DB || '',
  username: process.env.ODOO_USERNAME || '',
  apiKey: process.env.ODOO_API_KEY || ''
};

function getClient(path) {
    const isHttps = config.url.startsWith('https://');
    const url = new URL(config.url);
    const options = {
      host: url.hostname,
      port: parseInt(url.port) || (isHttps ? 443 : 80),
      path: path,
      rejectUnauthorized: false,
    };
    return isHttps ? xmlrpc.createSecureClient(options) : xmlrpc.createClient(options);
}

async function diagnose() {
  console.log('--- DIAGNOSTICA ODOO (JS) ---');
  
  try {
    const common = getClient('/xmlrpc/2/common');
    console.log('Autenticazione...');
    
    const uid = await new Promise((resolve, reject) => {
        common.methodCall('authenticate', [config.db, config.username, config.apiKey, {}], (err, val) => {
            if (err) reject(err);
            resolve(val);
        });
    });

    if (!uid) {
        console.error('Autenticazione fallita (UID nullo)');
        return;
    }

    const object = getClient('/xmlrpc/2/object');
    console.log('UID:', uid, '| Recupero categorie...');

    const cats = await new Promise((resolve, reject) => {
        object.methodCall('execute_kw', [config.db, uid, config.apiKey, 'product.category', 'search_read', [], { fields: ['name'] }], (err, val) => {
            if (err) reject(err);
            resolve(val);
        });
    });
    console.log('CATEGORIE TROVATE:', cats.map(c => c.name).slice(0, 30));

    console.log('Recupero prodotti (500)...');
    const products = await new Promise((resolve, reject) => {
        object.methodCall('execute_kw', [config.db, uid, config.apiKey, 'product.product', 'search_read', [[['sale_ok', '=', true]]], { fields: ['name', 'categ_id'], limit: 500 }], (err, val) => {
            if (err) reject(err);
            resolve(val);
        });
    });

    console.log('NUMERO PRODOTTI TOTALI:', products.length);
    console.log('PRIMI 10 PRODOTTI:', products.map(p => p.name).slice(0, 10));
    
    const helmets = products.filter(p => {
        const n = p.name.toLowerCase();
        const c = (p.categ_id && p.categ_id[1] || '').toLowerCase();
        return n.includes('casco') || n.includes('helmet') || c.includes('casco') || c.includes('helmet');
    });
    console.log('CASCHI TROVATI:', helmets.length);
    if (helmets.length > 0) {
        console.log('Esempi caschi:', helmets.map(h => h.name).slice(0, 5));
    }

  } catch (err) {
    console.error('ERRORE:', err);
  }
}

diagnose();
