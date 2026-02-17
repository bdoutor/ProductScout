const { NipocarProvider } = require('./dist/providers/nipocar');
const scraper = require('./dist/services/scraper');
const parse = scraper.parseNipocar || (scraper.__get__ ? scraper.__get__('parseNipocar') : null);
(async () => {
  const prov = new NipocarProvider();
  const supplier = { name: 'Nipocar', base_url: 'https://nipocar.pt' };
  const credential = { login: process.env.NIPOCAR_LOGIN, password: process.env.NIPOCAR_PASSWORD };
  const r = await prov.loginAndFetch(supplier, credential, 'https://nipocar.pt/pt-pt/catalogo');
  console.log('status', r.status, 'html length', r.html?.length);
  if (!parse) { console.log('parseNipocar not available'); return; }
  const items = parse(r.html, supplier);
  console.log(items.slice(0, 10));
})();
