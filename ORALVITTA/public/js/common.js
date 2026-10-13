// Utilidades compartilhadas (site público e painel). Nada de innerHTML com dados do usuário:
// todo texto entra via textContent, o que elimina XSS.
const OV = (() => {
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Algo deu errado. Tente novamente.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // h('button', { class: 'btn', onclick: fn }, 'texto', outroNo)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  const dateObj = d => new Date(d + 'T12:00:00Z');
  const fmtLong = d => dateObj(d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const fmtShort = d => dateObj(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');
  const fmtNumeric = d => d.split('-').reverse().join('/');
  const monthLabel = m => dateObj(m + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const addDays = (d, n) => { const x = dateObj(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

  const dur = min => min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
  const hm = t => { const [H, M] = t.split(':'); return M === '00' ? `${Number(H)}h` : `${Number(H)}h${M}`; };

  const STATUS = {
    scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída',
    cancelled: 'Cancelada', no_show: 'Não compareceu',
  };

  function maskPhone(input) {
    input.addEventListener('input', () => {
      let d = input.value.replace(/\D/g, '').slice(0, 11);
      if (d.length > 6) d = d.replace(/^(\d{2})(\d{4,5})(\d{0,4}).*/, (_, a, b, c) => `(${a}) ${b}${c ? '-' + c : ''}`);
      else if (d.length > 2) d = d.replace(/^(\d{2})(\d*)/, '($1) $2');
      input.value = d;
    });
  }

  const whatsappUrl = (number, text) => `https://wa.me/${number}${text ? '?text=' + encodeURIComponent(text) : ''}`;

  return { api, h, clear, fmtLong, fmtShort, fmtNumeric, monthLabel, WEEKDAYS, addDays, dur, hm, STATUS, maskPhone, whatsappUrl };
})();
