(async () => {
  const { h, api, clear } = OV;
  let info, cat;
  const root = document.getElementById('catalog'), filters = document.getElementById('filters');
  try { [info, cat] = await Promise.all([Loja.info(), api('/api/public/catalog')]); }
  catch (e) { root.append(h('div', { class: 'alert error' }, e.message)); return; }

  let current = new URLSearchParams(location.search).get('c') || 'todas';
  if (current !== 'todas' && !cat.categories.some(c => c.slug === current)) current = 'todas';

  const added = h('div', { class: 'toast', role: 'status', hidden: true });
  document.body.append(added);
  let timer;
  const onAdd = p => {
    Loja.Cart.add(p.id);
    added.textContent = `${p.name} adicionado ao pedido`; added.hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { added.hidden = true; }, 2200);
  };

  function render() {
    clear(filters); clear(root);
    const opts = [{ slug: 'todas', name: 'Todas' }, ...cat.categories];
    for (const o of opts) {
      filters.append(h('button', { type: 'button', 'aria-pressed': String(current === o.slug),
        onclick: () => { current = o.slug; history.replaceState(null, '', o.slug === 'todas' ? '/catalogo' : `/catalogo?c=${o.slug}`); render(); } }, o.name));
    }
    for (const c of cat.categories.filter(c => current === 'todas' || c.slug === current)) {
      root.append(h('section', { class: 'cat-section', id: c.slug },
        h('h2', {}, c.name), c.description && h('p', { class: 'muted' }, c.description),
        h('div', { class: 'products' }, c.products.map(p => Loja.productCard(p, { onAdd, vocab: info.vocab })))));
    }
    if (!root.children.length) root.append(h('div', { class: 'empty' }, 'Nenhum item disponível no momento.'));
  }
  render();
})();
