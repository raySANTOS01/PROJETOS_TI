// Painel do vertical "loja": pedidos, catálogo (com envio de fotos) e contatos.
(() => {
  const K = window.AdminKit;
  if (!K) return;
  const { h, api, clear, ctx, content, modal, toast, openModal, loadCtx, field, errBox, showErr, fail, route, fmtShort, fmtNumeric, fmtPhone, STATUS, patientMsg } = K;

  const ORDER_STATUS = { new: 'Novo', contacted: 'Em contato', confirmed: 'Confirmado', delivered: 'Entregue', cancelled: 'Cancelado' };
  const BADGE = { new: 'scheduled', contacted: 'confirmed', confirmed: 'confirmed', delivered: 'completed', cancelled: 'cancelled' };
  const money = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const priceText = p => p.price_mode === 'fixed' ? money(p.price_cents) : p.price_mode === 'from' ? `A partir de ${money(p.price_cents)}` : 'Sob consulta';
  const when = s => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const V = () => K.vocab();

  // =====================================================================
  // Visão geral
  // =====================================================================
  async function visao() {
    const [s, d] = await Promise.all([api('/api/admin/loja/summary'), api('/api/admin/dashboard')]);
    const stat = (n, t, href) => h('a', { class: 'stat stat-link', href }, h('b', {}, String(n)), h('span', {}, t));
    content.append(
      h('h1', {}, 'Visão geral'), h('p', { class: 'sub' }, K.fmtLong(d.today)),
      h('div', { class: 'stats stats-4' },
        stat(s.orders_new, 'pedidos novos', '#pedidos'),
        stat(s.orders_open, 'pedidos em andamento', '#pedidos'),
        stat(d.count_today, `${V().appts} hoje`, '#agenda'),
        stat(s.leads_new, 'contatos para ligar', '#contatos')),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' }, h('h2', {}, 'Últimos pedidos'),
          s.recent_orders.length ? h('ul', { class: 'list' }, s.recent_orders.map(o => h('li', {},
            h('span', { class: 'when' }, when(o.created_at)),
            h('span', { class: 'who' }, o.name, h('small', {}, o.items.map(i => `${i.qty}x ${i.name}`).join(', '))),
            h('span', { class: `badge ${BADGE[o.status]}` }, ORDER_STATUS[o.status]))))
            : h('p', { class: 'empty-note' }, 'Nenhum pedido ainda.')),
        h('div', { class: 'card' }, h('h2', {}, `Próximas ${V().appts}`),
          d.upcoming.length ? h('ul', { class: 'list' }, d.upcoming.map(a => h('li', {},
            h('span', { class: 'when' }, `${fmtShort(a.date)} ${a.time}`),
            h('span', { class: 'who' }, a.name, h('small', {}, a.service)),
            h('span', { class: `badge ${a.status}` }, STATUS[a.status]))))
            : h('p', { class: 'empty-note' }, `Nenhuma ${V().appt} marcada para os próximos dias.`))));
  }

  // =====================================================================
  // Pedidos
  // =====================================================================
  let orderFilter = 'open';
  async function pedidos() {
    await loadCtx();
    const all = await api('/api/admin/orders');
    const shown = orderFilter === 'all' ? all : orderFilter === 'open' ? all.filter(o => ['new', 'contacted', 'confirmed'].includes(o.status)) : all.filter(o => o.status === orderFilter);
    const tabs = [['open', 'Em andamento'], ['new', 'Novos'], ['delivered', 'Entregues'], ['cancelled', 'Cancelados'], ['all', 'Todos']];
    const set = (o, status) => async () => {
      try { await api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status } }); toast(`Pedido ${ORDER_STATUS[status].toLowerCase()}`); route(); } catch (e) { fail(e); }
    };
    const NEXT = { new: [['contacted', 'Marcar em contato']], contacted: [['confirmed', 'Confirmar']], confirmed: [['delivered', 'Marcar entregue']], delivered: [], cancelled: [['new', 'Reabrir']] };
    content.append(h('h1', {}, 'Pedidos'), h('p', { class: 'sub' }, 'Pedidos feitos pelo site. Confirme valores e entrega com o cliente pelo WhatsApp.'),
      h('div', { class: 'filter-tabs' }, tabs.map(([id, label]) => h('button', { type: 'button', 'aria-pressed': String(orderFilter === id), onclick: () => { orderFilter = id; clear(content); pedidos().catch(fail); } }, label))),
      ...(shown.length ? shown.map(o => {
        const total = o.items.every(i => i.price_mode === 'fixed') ? o.items.reduce((s, i) => s + i.qty * i.price_cents, 0) : null;
        const msg = patientMsg({ phone: o.phone }, `Olá, ${o.name.split(' ')[0]}! Aqui é da ${ctx.clinic.clinic_name}. Recebemos seu pedido ${o.code}: ${o.items.map(i => `${i.qty}x ${i.name}`).join(', ')}. Vamos confirmar os detalhes?`);
        return h('div', { class: 'card order-card' },
          h('div', { class: 'order-head' }, h('b', {}, `Pedido ${o.code}`), h('span', { class: `badge ${BADGE[o.status]}` }, ORDER_STATUS[o.status]), h('small', {}, when(o.created_at))),
          h('ul', { class: 'order-items' }, o.items.map(i => h('li', {}, `${i.qty}x ${i.name}`, h('small', {}, i.price_mode === 'quote' ? ' · sob consulta' : ` · ${i.price_mode === 'from' ? 'a partir de ' : ''}${money(i.price_cents)}`)))),
          total != null && h('p', { class: 'muted' }, `Total estimado: ${money(total)}`),
          h('dl', { class: 'details wide' },
            h('div', {}, h('dt', {}, 'Cliente'), h('dd', {}, `${o.name} · ${fmtPhone(o.phone)}`)),
            ...(ctx.fields || []).filter(x => o.details?.[x.key]).map(x => h('div', {}, h('dt', {}, x.label), h('dd', {}, o.details[x.key]))),
            (o.delivery_date || o.delivery_time) && h('div', {}, h('dt', {}, 'Entrega desejada'), h('dd', {}, `${o.delivery_date ? fmtNumeric(o.delivery_date) : ''} ${o.delivery_time || ''}`.trim())),
            o.card_message && h('div', {}, h('dt', {}, 'Cartão'), h('dd', {}, o.card_message)),
            o.notes && h('div', {}, h('dt', {}, 'Observações'), h('dd', {}, o.notes))),
          h('div', { class: 'modal-actions' },
            h('a', { class: 'btn btn-sm btn-primary', href: msg, target: '_blank', rel: 'noopener' }, 'WhatsApp do cliente'),
            (NEXT[o.status] || []).map(([st, label]) => h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: set(o, st) }, label)),
            !['cancelled', 'delivered'].includes(o.status) && h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: () => { if (confirm(`Cancelar o pedido ${o.code}?`)) set(o, 'cancelled')(); } }, 'Cancelar')));
      }) : [h('div', { class: 'card' }, h('p', { class: 'empty-note' }, 'Nenhum pedido nesta lista.'))]));
  }

  // =====================================================================
  // Catálogo
  // =====================================================================
  async function catalogo() {
    const [cats, prods] = await Promise.all([api('/api/admin/categories'), api('/api/admin/products')]);
    ctx.services = await api('/api/admin/services');
    content.append(
      h('div', { class: 'head-row' }, h('div', {}, h('h1', {}, 'Catálogo'), h('p', { class: 'sub' }, 'Produtos e serviços que aparecem no site. Você edita preços, fotos e textos aqui.')),
        h('div', { class: 'acts' },
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => categoryModal() }, '+ Categoria'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => productModal(null, cats) }, '+ Produto'))),
      ...cats.map(c => {
        const list = prods.filter(p => p.category_id === c.id);
        return h('div', { class: `card ${c.active ? '' : 'inactive'}` },
          h('div', { class: 'cat-head' }, h('div', {}, h('h2', {}, c.name), h('p', { class: 'muted' }, c.description || 'Sem descrição', !c.active && ' · oculta no site')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => categoryModal(c) }, 'Editar categoria')),
          list.length ? list.map(p => h('div', { class: `svc-row prod-row ${p.active ? '' : 'inactive'}` },
            h('div', { class: 'prod-main' },
              p.image ? h('img', { class: 'prod-thumb', src: p.image, alt: '' }) : h('span', { class: 'prod-thumb ph-sm', 'aria-hidden': 'true' }, p.name.charAt(0)),
              h('div', {}, h('b', {}, p.name), h('small', {}, p.service_id ? 'Agendamento ao vivo' : priceText(p)),
                !p.active && h('small', {}, 'Oculto no site'), p.featured && h('small', {}, 'Em destaque'))),
            h('span', {}),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => productModal(p, cats) }, 'Editar')))
            : h('p', { class: 'empty-note' }, 'Nenhum produto nesta categoria.'));
      }));
  }

  function categoryModal(c) {
    const err = errBox();
    const name = h('input', { type: 'text', maxlength: 60, value: c?.name || '' });
    const desc = h('input', { type: 'text', maxlength: 200, value: c?.description || '' });
    const active = h('input', { type: 'checkbox' }); active.checked = c ? c.active : true;
    const picker = imagePicker(c?.image || '');
    const form = h('form', { novalidate: true }, err, field('Nome', name), field('Descrição', desc, '(aparece no site)'),
      field('Foto de capa', picker.el, '(opcional)'),
      h('label', { class: 'toggle' }, active, 'Visível no site'),
      h('div', { class: 'modal-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar'),
        c && h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
          if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
          try { await api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }); modal.close(); toast('Categoria excluída'); route(); } catch (e) { showErr(err, e); }
        } }, 'Excluir')));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true;
      try {
        await api(c ? `/api/admin/categories/${c.id}` : '/api/admin/categories', { method: c ? 'PUT' : 'POST', body: { name: name.value, description: desc.value, image: picker.value(), active: active.checked, sort: c?.sort } });
        modal.close(); toast('Categoria salva'); route();
      } catch (e) { showErr(err, e); }
    });
    openModal(h('h2', {}, c ? 'Editar categoria' : 'Nova categoria'), form);
  }

  function productModal(p, cats) {
    const err = errBox();
    const cat = h('select', {}, cats.map(c => h('option', { value: c.id }, c.name))); if (p) cat.value = p.category_id;
    const name = h('input', { type: 'text', maxlength: 80, value: p?.name || '' });
    const desc = h('textarea', { maxlength: 400 }); desc.value = p?.description || '';
    const mode = h('select', {}, [['quote', 'Sob consulta (sem preço no site)'], ['fixed', 'Preço fixo'], ['from', 'A partir de']].map(([v, l]) => h('option', { value: v }, l))); mode.value = p?.price_mode || 'quote';
    const price = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: p?.price_cents ? (p.price_cents / 100).toFixed(2).replace('.', ',') : '' });
    const priceRow = field('Preço (R$)', price);
    const syncPrice = () => { priceRow.hidden = mode.value === 'quote' || !!service.value; };
    const service = h('select', {}, h('option', { value: '' }, 'Não — é um produto para pedir'), ...ctx.services.filter(s => s.active).map(s => h('option', { value: s.id }, `Sim — agendar: ${s.name}`)));
    service.value = p?.service_id || '';
    mode.addEventListener('change', syncPrice); service.addEventListener('change', syncPrice);
    const featured = h('input', { type: 'checkbox' }); featured.checked = !!p?.featured;
    const active = h('input', { type: 'checkbox' }); active.checked = p ? p.active : true;
    const picker = imagePicker(p?.image || '');
    const form = h('form', { novalidate: true }, err, field('Categoria', cat), field('Nome', name), field('Descrição', desc, '(opcional)'),
      field('Foto', picker.el),
      field('Agendamento com data e hora?', service, '(para homenagens ao vivo)'),
      field('Como mostrar o preço', mode), priceRow,
      h('label', { class: 'toggle' }, featured, 'Mostrar em destaque na página inicial'), h('div', { class: 'spacer' }),
      h('label', { class: 'toggle' }, active, 'Visível no site'),
      h('div', { class: 'modal-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar'),
        p && h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
          if (!confirm(`Excluir "${p.name}"? Pedidos antigos continuam guardados.`)) return;
          try { await api(`/api/admin/products/${p.id}`, { method: 'DELETE' }); modal.close(); toast('Produto excluído'); route(); } catch (e) { showErr(err, e); }
        } }, 'Excluir')));
    syncPrice();
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true;
      try {
        await api(p ? `/api/admin/products/${p.id}` : '/api/admin/products', { method: p ? 'PUT' : 'POST', body: {
          category_id: Number(cat.value), name: name.value, description: desc.value, image: picker.value(),
          service_id: service.value || null, price_mode: service.value ? 'quote' : mode.value, price: price.value,
          featured: featured.checked, active: active.checked, sort: p?.sort } });
        modal.close(); toast('Produto salvo'); route();
      } catch (e) { showErr(err, e); }
    });
    openModal(h('h2', {}, p ? 'Editar produto' : 'Novo produto'), form);
  }

  // Envio de foto: o navegador reduz a imagem (máx. 1200 px) antes de enviar.
  function imagePicker(initial) {
    let url = initial;
    const preview = h('div', { class: 'img-preview' });
    const msg = h('small', { class: 'muted' }, '');
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only', id: 'img-' + Math.random().toString(36).slice(2) });
    const pick = h('label', { class: 'btn btn-ghost btn-sm', for: file.id }, 'Escolher foto');
    const remove = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { url = ''; draw(); } }, 'Remover');
    function draw() { clear(preview); if (url) preview.append(h('img', { src: url, alt: 'Pré-visualização' })); else preview.append(h('span', { class: 'muted' }, 'Sem foto')); remove.hidden = !url; }
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      msg.textContent = 'Enviando…';
      try {
        const bmp = await createImageBitmap(f);
        const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
        const r = await api('/api/admin/upload', { method: 'POST', body: { image: cv.toDataURL('image/jpeg', 0.86) } });
        url = r.url; msg.textContent = ''; draw();
      } catch (e) { msg.textContent = e.message || 'Não foi possível enviar a foto.'; }
      file.value = '';
    });
    draw();
    return { el: h('div', {}, preview, h('div', { class: 'acts' }, pick, remove, file), msg), value: () => url };
  }

  // =====================================================================
  // Contatos ("Ligamos para você")
  // =====================================================================
  async function contatos() {
    const leads = await api('/api/admin/leads');
    const set = (l, status) => async () => { try { await api(`/api/admin/leads/${l.id}`, { method: 'PATCH', body: { status } }); route(); } catch (e) { fail(e); } };
    content.append(h('h1', {}, 'Contatos'), h('p', { class: 'sub' }, 'Pessoas que pediram para receber uma ligação pelo site.'),
      h('div', { class: 'card' }, leads.length ? h('ul', { class: 'list' }, leads.map(l => h('li', {},
        h('span', { class: 'when' }, when(l.created_at)),
        h('span', { class: 'who' }, l.name || 'Sem nome', h('small', {}, fmtPhone(l.phone))),
        h('span', { class: 'acts' },
          h('span', { class: `badge ${l.status === 'new' ? 'scheduled' : 'completed'}` }, l.status === 'new' ? 'Para ligar' : 'Já liguei'),
          h('a', { class: 'btn btn-ghost btn-sm', href: K.whatsappUrl('55' + l.phone), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: set(l, l.status === 'new' ? 'called' : 'new') }, l.status === 'new' ? 'Marcar como ligado' : 'Reabrir'),
          h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { if (!confirm('Excluir este contato?')) return; try { await api(`/api/admin/leads/${l.id}`, { method: 'DELETE' }); route(); } catch (e) { fail(e); } } }, 'Excluir')))))
        : h('p', { class: 'empty-note' }, 'Nenhum contato ainda.')));
  }

  K.extend('loja', {
    views: { visao, pedidos, catalogo, contatos },
    configExtra: true,
    nav: () => [['visao', 'Visão geral'], ['pedidos', 'Pedidos'], ['catalogo', 'Catálogo'], ['agenda', `Agenda de ${V().appts}`],
      ['disponibilidade', 'Disponibilidade'], ['servicos', `Tipos de ${V().appt}`], ['contatos', 'Contatos'], ['config', 'Configurações']],
  });
})();
