require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeOldSuppliers() {
  console.log('🗑️  Removing old retail suppliers...\n');

  const oldSuppliers = ['FNAC', 'Rádio Popular', 'Continente', 'Lidl'];

  for (const name of oldSuppliers) {
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('name', name);

      if (error) {
        console.log(`⚠️  ${name}: ${error.message}`);
      } else {
        console.log(`✅ Removed: ${name}`);
      }
    } catch (err) {
      console.error(`❌ Error removing ${name}:`, err.message);
    }
  }

  console.log('\n✅ Old suppliers cleanup completed!\n');

  // Verify remaining suppliers
  const { data, error } = await supabase
    .from('suppliers')
    .select('name');

  if (!error && data) {
    console.log('📊 Remaining suppliers in database:');
    if (data.length === 0) {
      console.log('   (none)\n');
    } else {
      data.forEach(s => console.log(`   - ${s.name}`));
      console.log();
    }
  }
}

removeOldSuppliers();
