require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Creating supplier_credentials table...\n');

  try {
    // Check if table exists first
    const { data: existingData, error: checkError } = await supabase
      .from('supplier_credentials')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Table already exists! Checking data...\n');

      const { data, error } = await supabase
        .from('supplier_credentials')
        .select('*');

      if (error) {
        console.error('❌ Error reading table:', error.message);
      } else {
        console.log(`📊 Found ${data.length} suppliers in database:\n`);
        data.forEach(s => console.log(`   - ${s.name} (${s.url})`));
      }
      return;
    }

    console.log('⚠️  Table does not exist. Please run the SQL manually:\n');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste: supabase/migration_v2_supplier_credentials.sql');
    console.log('5. Click RUN\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

runMigration();
