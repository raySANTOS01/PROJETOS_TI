(async () => {
  const { h, api } = OV;
  let info, cat;
  try { [info, cat] = await Promise.all([Loja.info(), api('/api/public/catalog')]); } catch { return; }

  const grid = document.getElementById('cat-grid');
  for (const c of cat.categories) {
    grid.append(h('a', { class: 'cat-card', href: `/catalogo?c=${c.slug}` },
      c.image && h('img', { src: c.image, alt: '', loading: 'lazy' }),
      h('h3', {}, c.name), c.description && h('p', {}, c.description), h('span', { class: 'go' }, 'Ver opções')));
  }

  const featured = cat.categories.flatMap(c => c.products).filter(p => p.featured).slice(0, 8);
  if (featured.length) {
    const box = document.getElementById('featured');
    for (const p of featured) box.append(Loja.productCard(p, { vocab: info.vocab, onAdd: q => { Loja.Cart.add(q.id); location.href = '/pedido'; } }));
    document.getElementById('destaques').hidden = false;
  }

  if (info.about) {
    document.getElementById('about-title').textContent = info.about.title || '';
    const box = document.getElementById('about-text');
    for (const t of info.about.text || []) box.append(h('p', {}, t));
    if (info.about.image) { const im = document.getElementById('about-img'); im.src = '/img/' + info.about.image; im.hidden = false; }
    document.getElementById('sobre').hidden = false;
  }
  if (info.clinic.address) {
    document.getElementById('address').textContent = info.clinic.address;
    document.getElementById('map-link').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(info.clinic.address);
    document.getElementById('onde').hidden = false;
  }
})();
