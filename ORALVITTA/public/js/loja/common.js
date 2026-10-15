// Peças compartilhadas das páginas da loja: carrinho, preço, cartão de produto, cabeçalho e rodapé.
const Loja = (() => {
  const { h, api, WEEKDAYS, hm } = OV;
  let infoPromise;
  const info = () => (infoPromise ??= api('/api/public/info'));

  // ---------- carrinho (localStorage; funciona mesmo se o navegador bloquear o armazenamento) ----------
  const KEY = 'ov_cart';
  let memory = [];
  const Cart = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return memory; } },
    save(list) { memory = list; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignora */ } updateBadge(); },
    add(id, qty = 1) {
      const list = Cart.get(); const it = list.find(x => x.id === id);
      if (it) it.qty = Math.min(20, it.qty + qty); else list.push({ id, qty });
      Cart.save(list);
    },
    set(id, qty) { Cart.save(Cart.get().map(x => x.id === id ? { id, qty: Math.max(1, Math.min(20, qty)) } : x)); },
    remove(id) { Cart.save(Cart.get().filter(x => x.id !== id)); },
    clear() { Cart.save([]); },
    count() { return Cart.get().reduce((s, x) => s + x.qty, 0); },
  };
  function updateBadge() {
    const el = document.getElementById('cart-count'); if (!el) return;
    const n = Cart.count(); el.textContent = String(n); el.hidden = n === 0;
  }

  const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const priceLabel = p => p.price_mode === 'fixed' ? money(p.price_cents)
    : p.price_mode === 'from' ? `A partir de ${money(p.price_cents)}` : 'Consulte o valor';

  function placeholder(name) { return h('div', { class: 'ph', 'aria-hidden': 'true' }, name.trim().charAt(0).toUpperCase()); }

  // opts.onAdd(p) é chamado ao clicar em "Adicionar ao pedido"
  function productCard(p, { onAdd, vocab }) {
    const live = !!p.service_id;
    return h('article', { class: 'pcard' },
      h('div', { class: 'pic' }, p.image ? h('img', { src: p.image, alt: p.name, loading: 'lazy' }) : placeholder(p.name), live && h('span', { class: 'tag-live' }, 'Ao vivo')),
      h('div', { class: 'body' },
        h('h3', {}, p.name), p.description && h('p', {}, p.description),
        !live && h('div', { class: `price ${p.price_mode === 'quote' ? 'quote' : ''}` }, priceLabel(p)),
        h('div', { class: 'acts' },
          live
            ? h('a', { class: 'btn btn-primary btn-sm', href: `/agendar?service=${p.service_id}` }, `Agendar ${vocab.appt}`)
            : h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => onAdd(p) }, 'Adicionar ao pedido'))));
  }

  // "Segunda à sábado: 6h às 22h" agrupando dias consecutivos iguais
  function hoursLines(i) {
    const order = [1, 2, 3, 4, 5, 6, 0], groups = [];
    for (const wd of order) {
      const x = i.hours[wd], lbl = x.open ? `${hm(x.start)} às ${hm(x.end)}` : 'Fechado', last = groups.at(-1);
      if (last && last.lbl === lbl) last.days.push(wd); else groups.push({ lbl, days: [wd] });
    }
    const nm = wd => WEEKDAYS[wd].replace('-feira', '');
    return groups.map(g => [g.days.length > 1 ? `${nm(g.days[0])} à ${nm(g.days.at(-1)).toLowerCase()}` : nm(g.days[0]), g.lbl]);
  }

  async function chrome() {
    updateBadge();
    let i; try { i = await info(); } catch { return null; }
    const lines = hoursLines(i).filter(l => l[1] !== 'Fechado');
    const text = lines.map(l => `${l[0]}: ${l[1]}`).join(' · ');
    const top = document.getElementById('topbar-hours'); if (top && text) top.textContent = `Delivery — ${text}`;
    const tel = '+55' + i.clinic.phone.replace(/\D/g, '');
    for (const id of ['topbar-phone', 'f-phone']) { const a = document.getElementById(id); if (a) { a.href = 'tel:' + tel; a.textContent = i.clinic.phone; } }
    const fh = document.getElementById('f-hours'); if (fh) fh.textContent = text;
    const fa = document.getElementById('f-address'); if (fa) fa.textContent = i.clinic.address || '';
    const w2 = document.getElementById('f-wa2');
    if (w2 && i.clinic.whatsapp2) { w2.href = OV.whatsappUrl(i.clinic.whatsapp2); w2.hidden = false; }
    const soc = document.getElementById('f-social');
    if (soc) {
      if (i.clinic.instagram) soc.append(h('a', { href: `https://www.instagram.com/${i.clinic.instagram}/`, target: '_blank', rel: 'noopener' }, 'Instagram'));
      if (i.clinic.facebook) soc.append(h('a', { href: `https://www.facebook.com/${i.clinic.facebook}/`, target: '_blank', rel: 'noopener' }, 'Facebook'));
    }
    leadForm();
    return i;
  }

  function leadForm() {
    const form = document.getElementById('lead-form'); if (!form) return;
    const err = document.getElementById('lead-error'), ok = document.getElementById('lead-ok');
    OV.maskPhone(document.getElementById('lead-phone'));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true; ok.hidden = true;
      try {
        await api('/api/public/leads', { method: 'POST', body: { name: document.getElementById('lead-name').value, phone: document.getElementById('lead-phone').value } });
        ok.hidden = false; form.reset();
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  }

  return { info, Cart, money, priceLabel, productCard, placeholder, chrome, hoursLines };
})();
document.addEventListener('DOMContentLoaded', () => { Loja.chrome(); });
