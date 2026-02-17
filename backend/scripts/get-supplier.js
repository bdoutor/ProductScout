require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const backupPath = path.resolve('backend/.env.backup');
  if (fs.existsSync(backupPath)) {
    const lines = fs.readFileSync(backupPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);
(async () => {
  const { data, error } = await client.from('suppliers').select('id,name,mode,enabled,login_url,selectors').eq('name','AUGER').single();
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
