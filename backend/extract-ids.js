const xmlrpc = require('xmlrpc');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  username: process.env.ODOO_USERNAME,
  apiKey: process.env.ODOO_API_KEY
};

const url = new URL(config.url);
const host = url.hostname;
const port = 443;

const getClient = (path) => xmlrpc.createSecureClient({ host, port, path, rejectUnauthorized: false });

const subdomain = host.split('.')[0];
const variants = [config.db, subdomain, subdomain.replace(/-/g, '_'), 'main'].filter(v => v);

console.log('Tentativo di connessione su:', host);

const run = async () => {
  let authenticatedUid = null;
  let activeDb = null;

  for (const dbVariant of variants) {
    try {
      const common = getClient('/xmlrpc/2/common');
      const uid = await new Promise((resolve, reject) => {
        common.methodCall('authenticate', [dbVariant, config.username, config.apiKey, {}], (err, val) => {
          if (err || val === false) resolve(null);
          else resolve(val);
        });
      });

      if (uid) {
        authenticatedUid = uid;
        activeDb = dbVariant;
        console.log('CONNESSO! DB:', dbVariant, '| UID:', uid);
        break;
      }
    } catch (e) {}
  }

  if (!authenticatedUid) {
    console.error('Autenticazione Fallita su tutte le varianti.');
    return;
  }

  const models = getClient('/xmlrpc/2/object');
  models.methodCall('execute_kw', [activeDb, authenticatedUid, config.apiKey, 'product.category', 'search_read', [[], ['id', 'display_name', 'name']]], (err, categories) => {
    if (err) { console.error('Errore Categorie:', err); return; }
    console.log('--- TUTTE LE CATEGORIE TROVATE ---');
    categories.forEach(c => console.log(`ID: ${c.id} | Nome: ${c.display_name}`));
  });
};

run();
