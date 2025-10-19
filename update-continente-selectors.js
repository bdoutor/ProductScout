require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSelectors() {
  console.log('Updating Continente selectors...\n');

  const newSelectors = {
    result_selectors: {
      item: '.product',
      name: 'h2',
      price: '.price',
      link: 'a'
    }
  };

  const { data, error } = await supabase
    .from('suppliers')
    .update({ selectors: newSelectors })
    .eq('name', 'Continente')
    .select();

  if (error) {
    console.error('Error updating selectors:', error);
    return;
  }

  console.log('✓ Successfully updated Continente selectors!');
  console.log('\nNew configuration:');
  console.log(JSON.stringify(data[0].selectors, null, 2));
}

updateSelectors();
