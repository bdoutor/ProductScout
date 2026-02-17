// Seed suppliers + encrypted credentials into the connected Supabase project
// Uses backend/.env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// Passwords are encrypted with backend/src/utils/secrets.ts (AES-256-GCM)

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');

  const sb = createClient(url, key);

  // Minimal suppliers upsert (no login_url to avoid schema mismatch). Adjust selectors later if needed.
  const suppliers = [
    {
      name: 'AUGER',
      base_url: 'https://portal.iamauger.com',
      mode: 'render',
      search_url_template: 'https://portal.iamauger.com/search?q={query}', // TODO confirm
      enabled: true,
      selectors: {
        result_selectors: {
          item: '.product-item',
          name: '.product-title',
          price: '.price',
          link: '.product-title a'
        }
      }
    },
    {
      name: 'GSMART',
      base_url: 'https://eurocomp.gsmart.eu',
      mode: 'render',
      search_url_template: 'https://eurocomp.gsmart.eu/search?q={query}', // TODO confirm
      enabled: true,
      selectors: {
        result_selectors: {
          item: '.product-item',
          name: '.product-title',
          price: '.price',
          link: '.product-title a'
        }
      }
    },
    {
      name: 'Martex',
      base_url: 'https://martex.pt',
      mode: 'render',
      search_url_template: 'https://martex.pt/?s={query}', // TODO confirm
      enabled: true,
      selectors: {
        result_selectors: {
          item: '.product',
          name: '.woocommerce-loop-product__title',
          price: '.price',
          link: 'a.woocommerce-LoopProduct-link'
        }
      }
    }
  ];

  for (const s of suppliers) {
    const { error } = await sb.from('suppliers').upsert(s, { onConflict: 'name' });
    if (error) throw new Error(`Upsert supplier ${s.name} failed: ${error.message}`);
  }

  // Encrypted credentials
  const { encryptPassword } = require('./backend/dist/utils/secrets.js');
  const creds = [
    {
      name: 'AUGER',
      login: 'valdemar@eurocomponentes.pt',
      password: encryptPassword('Euro1999*'),
      url: 'https://portal.iamauger.com/login',
      notes: 'Portal AUGER - Automotive parts supplier',
      active: true,
    },
    {
      name: 'GSMART',
      login: 'valdemar craveiro',
      password: encryptPassword('Euro1999'),
      url: 'https://eurocomp.gsmart.eu/usuarios/log',
      notes: 'Portal GSMART - Automotive parts supplier',
      active: true,
    },
    {
      name: 'Martex',
      login: 'EC01',
      password: encryptPassword('martex1234'),
      url: 'https://martex.pt',
      notes: 'Portal Martex - Automotive parts supplier',
      active: true,
    }
  ];

  for (const c of creds) {
    const { error } = await sb.from('supplier_credentials').upsert(c, { onConflict: 'name' });
    if (error) throw new Error(`Upsert credential ${c.name} failed: ${error.message}`);
  }

  const { data: outSup } = await sb.from('suppliers').select('name,enabled');
  const { data: outCred } = await sb.from('supplier_credentials').select('name,active');
  console.log('Suppliers:', outSup?.map(x => x.name).join(', ') || 'none');
  console.log('Credentials:', outCred?.map(x => x.name).join(', ') || 'none');
}

main().catch((e) => { console.error(e.message); process.exit(1); });

