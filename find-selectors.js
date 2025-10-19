const axios = require('axios');
const cheerio = require('cheerio');

async function findSelectors() {
  try {
    console.log('Fetching page with Firecrawl...');

    const response = await axios.post(
      'https://api.firecrawl.dev/v0/scrape',
      {
        url: 'https://www.continente.pt/pesquisa/?q=arroz',
        pageOptions: {
          onlyMainContent: false,
          includeHtml: true,
          waitFor: 5000
        }
      },
      {
        headers: {
          'Authorization': 'Bearer fc-73b52a6b8bb34ab1af1c81426c3ae421',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (!response.data.success) {
      console.error('Firecrawl failed:', response.data.error);
      return;
    }

    const html = response.data.data.html;
    const $ = cheerio.load(html);

    console.log('\n=== Analyzing HTML Structure ===\n');

    // Look for common product containers
    const potentialSelectors = [
      '.product-item',
      '.product',
      '[data-product]',
      '.ct-product',
      '.product-card',
      '.item',
      'article',
      '[class*="product"]',
      '[class*="item"]'
    ];

    for (const selector of potentialSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`\n✓ Found ${elements.length} elements with selector: "${selector}"`);

        // Analyze first element
        const firstEl = elements.first();
        console.log('\nFirst element HTML (first 500 chars):');
        console.log(firstEl.html().substring(0, 500));

        // Try to find product details
        console.log('\nLooking for product details:');

        // Name
        let nameSelector = null;
        const nameSelectors = ['h2', 'h3', '.product-name', '.title', '[class*="name"]', '[class*="title"]'];
        for (const ns of nameSelectors) {
          const name = firstEl.find(ns).first().text().trim();
          if (name && name.length > 3) {
            console.log(`  Name (${ns}): ${name.substring(0, 50)}`);
            nameSelector = ns;
            break;
          }
        }

        // Price
        let priceSelector = null;
        const priceSelectors = ['.price', '.ct-price-value', '[class*="price"]', '[class*="valor"]', '[data-price]'];
        for (const ps of priceSelectors) {
          const priceEl = firstEl.find(ps).first();
          const price = priceEl.text().trim();
          if (price && price.includes('€')) {
            console.log(`  Price (${ps}): ${price}`);
            priceSelector = ps;
            break;
          }
        }

        // Link
        let linkSelector = 'a';
        const link = firstEl.find('a').first().attr('href');
        if (link) {
          console.log(`  Link (a): ${link.substring(0, 60)}`);
        }

        // Availability
        const availSelectors = ['.stock', '.availability', '[class*="stock"]', '[class*="disponib"]'];
        for (const as of availSelectors) {
          const avail = firstEl.find(as).first().text().trim();
          if (avail) {
            console.log(`  Availability (${as}): ${avail.substring(0, 40)}`);
            break;
          }
        }

        // Generate selector config
        console.log('\n=== SUGGESTED SELECTOR CONFIG ===');
        console.log(JSON.stringify({
          item: selector,
          name: nameSelector || 'h2',
          price: priceSelector || '.price',
          link: linkSelector,
          availability: '.stock'
        }, null, 2));

        console.log('\n---');

        // Only show details for first match
        break;
      }
    }

    // Also check for specific patterns in class names
    console.log('\n=== All unique classes containing "product" ===');
    const productClasses = new Set();
    $('[class*="product"]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        classes.split(' ').forEach(c => {
          if (c.includes('product')) productClasses.add(c);
        });
      }
    });
    console.log([...productClasses].slice(0, 20).join(', '));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findSelectors();
