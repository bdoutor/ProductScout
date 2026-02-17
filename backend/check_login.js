const { NipocarProvider } = require('./dist/providers/nipocar');
(async () => {
  const prov = new NipocarProvider();
  const supplier = { name: 'Nipocar', base_url: 'https://nipocar.pt' };
  const credential = { login: '1232_0', password: 'eurocomponentes99' };
  try {
    const r = await prov.loginAndFetch(supplier, credential, 'https://nipocar.pt/pt-pt/catalogo');
    console.log('status', r.status, 'html length', r.html?.length);
    console.log((r.html||'').slice(0,200));
  } catch(e){ console.error('err', e); }
})();
