const xmlrpc = require('xmlrpc');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables manually for reliability
const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const config = {
    url: envConfig.ODOO_URL,
    db: envConfig.ODOO_DB,
    username: envConfig.ODOO_USERNAME,
    apiKey: envConfig.ODOO_API_KEY
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

async function run() {
    console.log('--- DIAGNOSTICA DIRETTA ODOO ---');
    try {
        const common = getClient('/xmlrpc/2/common');
        const uid = await new Promise((resolve, reject) => {
            common.methodCall('authenticate', [config.db, config.username, config.apiKey, {}], (err, val) => {
                if (err) reject(err);
                resolve(val);
            });
        });

        if (!uid) throw new Error('Autenticazione Fallita');
        console.log('UID:', uid);

        const object = getClient('/xmlrpc/2/object');

        // 1. Total products count
        const totalCount = await new Promise((resolve, reject) => {
            object.methodCall('execute_kw', [config.db, uid, config.apiKey, 'product.product', 'search_count', [[['sale_ok', '=', true]]]], (err, val) => {
                if (err) reject(err);
                resolve(val);
            });
        });
        console.log('TOTALE PRODOTTI sale_ok=true:', totalCount);

        // 2. Sample products
        const products = await new Promise((resolve, reject) => {
            object.methodCall('execute_kw', [config.db, uid, config.apiKey, 'product.product', 'search_read', [[['sale_ok', '=', true]]], { fields: ['name', 'categ_id'], limit: 100 }], (err, val) => {
                if (err) reject(err);
                resolve(val);
            });
        });
        console.log('PRIMI 10 PRODOTTI:', products.slice(0, 10).map(p => `${p.name} (Cat: ${p.categ_id[1]})`));

        // 3. Categories list
        const categories = await new Promise((resolve, reject) => {
            object.methodCall('execute_kw', [config.db, uid, config.apiKey, 'product.category', 'search_read', [], { fields: ['name'] }], (err, val) => {
                if (err) reject(err);
                resolve(val);
            });
        });
        console.log('CATEGORIE DISPONIBILI:', categories.slice(0, 20).map(c => c.name));

        // 4. Test filtering
        const helmets = products.filter(p => p.name.toLowerCase().includes('casco') || p.categ_id[1].toLowerCase().includes('caschi'));
        console.log('TEST FILTRO LOCALE CASCHI (su primi 100):', helmets.length);

    } catch (err) {
        console.error('ERRORE CRITICO:', err.message);
    }
}

run();
