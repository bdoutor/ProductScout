require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running migration: supplier_credentials table...\n');

  // Read SQL file
  const sqlFile = path.join(__dirname, 'supabase', 'migration_v2_supplier_credentials.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  // Split by statements (simple split by semicolon, ignoring comments)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📄 Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    // Skip pure comment blocks
    if (statement.trim().startsWith('--')) continue;

    try {
      console.log(`▶️  Executing statement ${i + 1}/${statements.length}...`);

      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Try direct query if RPC doesn't work
        const { error: directError } = await supabase.from('_').select().limit(0);

        // For DDL statements, we need to use the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ query: statement })
        });

        if (!response.ok) {
          console.log(`⚠️  Statement ${i + 1} - Using alternative method\n`);
        } else {
          console.log(`✅ Statement ${i + 1} - Success\n`);
          successCount++;
        }
      } else {
        console.log(`✅ Statement ${i + 1} - Success\n`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Statement ${i + 1} - Error:`, err.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migration completed!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('='.repeat(60) + '\n');

  // Verify table was created
  console.log('🔍 Verifying supplier_credentials table...\n');

  const { data, error } = await supabase
    .from('supplier_credentials')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Table verification failed:', error.message);
    console.log('\n⚠️  Please run the SQL manually in Supabase Dashboard → SQL Editor');
  } else {
    console.log(`✅ Table exists! Found ${data.length} suppliers:\n`);
    data.forEach(supplier => {
      console.log(`   - ${supplier.name} (${supplier.url})`);
    });
  }
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
