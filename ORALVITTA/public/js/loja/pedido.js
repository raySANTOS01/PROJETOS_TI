(async () => {
  const { h, api, clear, fmtNumeric, maskPhone, whatsappUrl } = OV;
  const root = document.getElementById('order-root');
  let info, cat;
  try { [info, cat] = await Promise.all([Loja.info(), api('/api/public/catalog')]); }
  catch (e) { root.append(h('div', { class: 'alert error' }, e.message)); return; }
  const byId = Object.fromEntries(cat.categories.flatMap(c => c.products).map(p => [p.id, p]));
  const form = { name: '', phone: '', recipient: '', address: '', delivery_date: '', delivery_time: '', card_message: '', notes: '', consent: false };

  function view() {
    clear(root);
    // limpa itens que saíram do catálogo
    const cart = Loja.Cart.get().filter(x => byId[x.id] && !byId[x.id].service_id);
    if (cart.length !== Loja.Cart.get().length) Loja.Cart.save(cart);
    if (!cart.length) {
      return root.append(h('div', { class: 'panel', style: null }, h('div', { class: 'empty' }, 'Seu pedido está vazio.'),
        h('div', { class: 'row-actions' }, h('a', { class: 'btn btn-primary', href: '/catalogo' }, 'Ver catálogo'))));
    }
    const allFixed = cart.every(x => byId[x.id].price_mode === 'fixed');
    const total = allFixed ? cart.reduce((s, x) => s + x.qty * byId[x.id].price_cents, 0) : null;

    const list = h('ul', { class: 'cart-items' }, cart.map(x => {
      const p = byId[x.id];
      return h('li', {},
        h('div', { class: 'thumb' }, p.image ? h('img', { src: p.image, alt: '' }) : Loja.placeholder(p.name)),
        h('div', {}, h('b', {}, p.name), h('small', {}, Loja.priceLabel(p)),
          h('div', {}, h('button', { type: 'button', class: 'link-btn', onclick: () => { Loja.Cart.remove(p.id); view(); } }, 'Remover'))),
        h('div', { class: 'qty' },
          h('button', { type: 'button', 'aria-label': 'Menos', onclick: () => { Loja.Cart.set(p.id, x.qty - 1); view(); } }, '−'),
          h('span', {}, String(x.qty)),
          h('button', { type: 'button', 'aria-label': 'Mais', onclick: () => { Loja.Cart.set(p.id, x.qty + 1); view(); } }, '+')));
    }));

    const err = h('div', { class: 'alert error', hidden: true, role: 'alert' });
    const bind = (key, el) => { el.value = form[key]; el.addEventListener('input', () => { form[key] = el.value; }); return el; };
    const phone = bind('phone', h('input', { type: 'tel', autocomplete: 'tel', placeholder: '(85) 90000-0000', required: true })); maskPhone(phone);
    const consent = h('input', { type: 'checkbox' }); consent.checked = form.consent; consent.addEventListener('change', () => { form.consent = consent.checked; });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Enviar pedido');
    const today = info.today;
    const f = h('form', { class: 'panel', novalidate: true }, err,
      h('h2', {}, 'Dados da entrega'),
      h('div', { class: 'form-row' },
        h('label', { class: 'field' }, h('span', {}, 'Seu nome'), bind('name', h('input', { type: 'text', maxlength: 100, autocomplete: 'name', required: true }))),
        h('label', { class: 'field' }, h('span', {}, 'Seu WhatsApp'), phone)),
      h('label', { class: 'field' }, h('span', {}, 'Nome de quem vai receber ', h('em', {}, '(opcional)')), bind('recipient', h('input', { type: 'text', maxlength: 100 }))),
      h('label', { class: 'field' }, h('span', {}, 'Endereço de entrega'), bind('address', h('input', { type: 'text', maxlength: 250, placeholder: 'Rua, número, bairro e ponto de referência', required: true }))),
      h('div', { class: 'form-row' },
        h('label', { class: 'field' }, h('span', {}, 'Data desejada ', h('em', {}, '(opcional)')), bind('delivery_date', h('input', { type: 'date', min: today }))),
        h('label', { class: 'field' }, h('span', {}, 'Horário desejado ', h('em', {}, '(opcional)')), bind('delivery_time', h('input', { type: 'time' })))),
      h('label', { class: 'field' }, h('span', {}, 'Mensagem do cartão ', h('em', {}, '(opcional)')), bind('card_message', h('textarea', { maxlength: 300 }))),
      h('label', { class: 'field' }, h('span', {}, 'Observações ', h('em', {}, '(opcional)')), bind('notes', h('textarea', { maxlength: 500 }))),
      h('label', { class: 'check' }, consent, h('span', {}, 'Concordo que a loja use meus dados apenas para atender este pedido e entrar em contato sobre ele.')),
      submit);

    f.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true;
      if (!form.name.trim()) return show(err, 'Informe seu nome.');
      if (form.phone.replace(/\D/g, '').length < 10) return show(err, 'Informe um WhatsApp válido com DDD.');
      if (!form.address.trim()) return show(err, 'Informe o endereço de entrega.');
      if (!form.consent) return show(err, 'É necessário concordar para enviar o pedido.');
      submit.disabled = true; submit.textContent = 'Enviando…';
      try {
        const r = await api('/api/public/orders', { method: 'POST', body: { ...form, items: cart.map(x => ({ id: x.id, qty: x.qty })) } });
        Loja.Cart.clear(); done(r);
      } catch (e) { submit.disabled = false; submit.textContent = 'Enviar pedido'; show(err, e.message); }
    });

    root.append(h('div', { class: 'order-layout' }, f,
      h('aside', { class: 'panel summary' }, h('h2', {}, 'Itens'), list,
        total != null ? h('div', { class: 'sum-total' }, h('span', {}, 'Total estimado'), h('span', {}, Loja.money(total))) : null,
        h('p', { class: 'sum-note' }, 'Valores, taxa de entrega e disponibilidade são confirmados pela nossa equipe pelo WhatsApp.'),
        h('a', { class: 'btn btn-ghost btn-sm', href: '/catalogo' }, 'Adicionar mais itens'))));
  }
  const show = (box, msg) => { box.textContent = msg; box.hidden = false; box.scrollIntoView?.({ block: 'center' }); };

  function done(r) {
    clear(root);
    const lines = [`Olá! Acabei de fazer um pedido pelo site (código ${r.code}).`, '', 'Itens:', ...r.items.map(i => `- ${i.qty}x ${i.name}`), ''];
    if (form.recipient) lines.push(`Para: ${form.recipient}`);
    lines.push(`Endereço: ${form.address}`);
    if (form.delivery_date) lines.push(`Entrega: ${fmtNumeric(form.delivery_date)}${form.delivery_time ? ' às ' + form.delivery_time : ''}`);
    if (form.card_message) lines.push(`Cartão: ${form.card_message}`);
    lines.push(`Nome: ${form.name}`);
    root.append(h('div', { class: 'panel' }, h('div', { class: 'ticket' },
      h('div', { class: 'check-ico', 'aria-hidden': 'true' }, '✓'),
      h('h2', {}, 'Pedido enviado!'),
      h('p', { class: 'muted' }, 'Falta só um passo: envie os detalhes pelo WhatsApp para a nossa equipe confirmar valores e disponibilidade.'),
      h('div', { class: 'code' }, r.code),
      h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-primary', href: whatsappUrl(info.clinic.whatsapp, lines.join('\n')), target: '_blank', rel: 'noopener' }, 'Enviar pelo WhatsApp'),
        h('a', { class: 'btn btn-ghost', href: '/' }, 'Voltar ao início')))));
  }
  view();
})();
