const fs = require('fs');
const path = require('path');
const { MartexProvider } = require('../dist/providers/martex');
const { closeBrowser } = require('../dist/providers/playwright');
const { parseHtml } = require('../dist/utils/parser');

(async () => {
  const provider = new MartexProvider();
  const supplier = {
    id: 'martex-test',
    enabled: true,
    name: 'Martex',
    base_url: 'https://sklep.martextruck.pl',
    mode: 'render',
    search_url_template: 'https://sklep.martextruck.pl/partscatalogue/searchresult.aspx?search=364624',
    selectors: { result_selectors: { item: '.partscontrol-box' } }
  };
  const credential = {
    id: 'martex',
    name: 'Martex',
    login: 'EC01',
    password: 'martex1234',
    url: 'https://sklep.martextruck.pl/pages/login.aspx',
    active: true
  };
  const searchUrl = supplier.search_url_template;
  try {
    const result = await provider.loginAndFetch(supplier, credential, searchUrl, 30000);
    console.log('status', result.status);
    const outPath = path.resolve(__dirname, '../martex-live.html');
    fs.writeFileSync(outPath, result.html, 'utf8');
    const items = parseHtml(result.html, supplier);
    console.log('parsed', items.slice(0, 5));
  } catch (err) {
    console.error(err);
  } finally {
    await closeBrowser();
  }
})();
