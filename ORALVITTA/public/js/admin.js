(() => {
  const { h, api, clear, fmtLong, fmtShort, fmtNumeric, addDays, dur, hm, STATUS, WEEKDAYS, maskPhone, whatsappUrl } = OV;
  const $ = id => document.getElementById(id);
  const content = $('content');
  const modal = $('modal');
  let V = { appt: 'consulta', appts: 'consultas' };
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  let ME = { vertical: 'clinica', ask_insurance: true };
  const ctx = { hours: null, services: null, insurances: null, clinic: null, today: null };

  // ---------- utilidades de interface ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  const fail = e => { if (e.status === 401) return boot(); toast(e.message); };
  const fmtPhone = d => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  const toMin = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const wd = date => new Date(date + 'T12:00:00Z').getUTCDay();
  const patientMsg = (a, text) => whatsappUrl('55' + a.phone, text);
  const confirmMsg = a => patientMsg(a, `Olá, ${a.name.split(' ')[0]}! Aqui é da ${ctx.clinic?.clinic_name || 'nossa clínica'}. Sua ${V.appt} de ${a.service} está marcada para ${fmtNumeric(a.date)} às ${a.time}. Pode confirmar sua presença?`);

  function openModal(...nodes) {
    clear(modal);
    modal.append(h('div', { class: 'modal-body' },
      h('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', onclick: () => modal.close(), 'aria-label': 'Fechar' }, 'Fechar'), ...nodes));
    if (!modal.open) modal.showModal();
  }
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  async function loadCtx(force = false) {
    if (!ctx.hours || force) ctx.hours = await api('/api/admin/hours');
    if (!ctx.services || force) ctx.services = await api('/api/admin/services');
    if (!ctx.clinic || force) ctx.clinic = await api('/api/admin/settings');
    if (!ctx.insurances) ctx.insurances = (await api('/api/public/info')).insurances;
  }

  const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label, hint && h('em', {}, ' ' + hint)), input);
  const errBox = () => h('div', { class: 'alert error', role: 'alert', hidden: true });
  const showErr = (box, e) => { box.textContent = e.message; box.hidden = false; };

  // ---------- login ----------
  async function boot() {
    try {
      ME = await api('/api/admin/me'); V = ME.vocab || V;
      $('login-screen').hidden = true; $('app').hidden = false;
      await loadCtx(true);
      buildNav();
      route();
    } catch (e) {
      $('app').hidden = true; $('login-screen').hidden = false; modal.open && modal.close();
    }
  }
  $('login-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const box = $('login-error'); box.hidden = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: { username: $('l-user').value, password: $('l-pass').value } });
      $('l-pass').value = ''; boot();
    } catch (e) { box.textContent = e.message; box.hidden = false; }
  });
  $('logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); boot(); });

  // ---------- roteamento ----------
  const views = { visao, agenda, disponibilidade, servicos, config };
  const EXT = {};   // extensões por vertical (ex.: admin-loja.js): { views, nav }
  const NAV_CLINICA = () => [['visao', 'Visão geral'], ['agenda', 'Agenda'], ['disponibilidade', 'Disponibilidade'], ['servicos', 'Serviços'], ['config', 'Configurações']];
  const baseViews = { ...views };
  function buildNav() {
    const ext = EXT[ME.vertical];
    for (const k of Object.keys(views)) delete views[k];
    Object.assign(views, baseViews, ext ? ext.views : {});
    const nav = $('side-nav'); clear(nav);
    for (const [id, label] of (ext ? ext.nav() : NAV_CLINICA())) nav.append(h('a', { href: '#' + id, 'data-view': id }, label));
  }
  function route() {
    const name = (location.hash || '#visao').slice(1);
    const view = views[name] ? name : 'visao';
    document.querySelectorAll('#side-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    clear(content);
    Promise.resolve(views[view]()).catch(fail);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // =====================================================================
  // Visão geral
  // =====================================================================
  async function visao() {
    const d = await api('/api/admin/dashboard');
    ctx.today = d.today;
    const stat = (n, t) => h('div', { class: 'stat' }, h('b', {}, String(n)), h('span', {}, t));
    content.append(
      h('h1', {}, 'Visão geral'), h('p', { class: 'sub' }, fmtLong(d.today)),
      h('div', { class: 'stats' }, stat(d.count_today, `${V.appts} hoje`), stat(d.count_week, `${V.appts} nos próximos 7 dias`), stat(d.to_confirm, 'aguardando confirmação')),
      h('div', { class: 'card' }, h('h2', {}, `Próximas ${V.appts}`),
        d.upcoming.length ? h('ul', { class: 'list' }, d.upcoming.map(a => h('li', {},
          h('span', { class: 'when' }, a.date === d.today ? `Hoje ${a.time}` : `${fmtShort(a.date)} ${a.time}`),
          h('span', { class: 'who' }, a.name, h('small', {}, `${a.service} · ${fmtPhone(a.phone)} · ${a.insurance}`)),
          h('span', { class: 'acts' },
            h('span', { class: `badge ${a.status}` }, STATUS[a.status]),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { agendaDate = a.date; location.hash = '#agenda'; } }, 'Ver na agenda'))
        ))) : h('p', { class: 'empty-note' }, `Nenhuma ${V.appt} marcada para os próximos dias.`)));
  }

  // =====================================================================
  // Agenda
  // =====================================================================
  let agendaDate = null;
  let showCancelled = false;
  const PPM = 1.5; // pixels por minuto na linha do tempo

  async function agenda() {
    await loadCtx();
    if (!ctx.today) ctx.today = (await api('/api/admin/dashboard')).today;
    if (!agendaDate) agendaDate = ctx.today;
    const date = agendaDate;
    const weekStart = addDays(date, -wd(date));
    const weekEnd = addDays(weekStart, 6);
    const { appointments, blocks } = await api(`/api/admin/appointments?from=${weekStart}&to=${weekEnd}`);

    const go = d => { agendaDate = d; clear(content); agenda().catch(fail); };
    const dateInput = h('input', { type: 'date', value: date, 'aria-label': 'Escolher data' });
    dateInput.addEventListener('change', () => dateInput.value && go(dateInput.value));
    const cb = h('input', { type: 'checkbox' }); cb.checked = showCancelled;
    cb.addEventListener('change', () => { showCancelled = cb.checked; go(date); });

    const strip = h('div', { class: 'weekstrip' }, Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const n = appointments.filter(a => a.date === d && ['scheduled', 'confirmed'].includes(a.status)).length;
      const closed = !ctx.hours[wd(d)].open;
      return h('button', { type: 'button', class: `${d === date ? 'sel' : ''} ${closed ? 'closed' : ''}`, onclick: () => go(d), 'aria-label': fmtLong(d) },
        h('small', {}, WEEKDAYS[wd(d)].slice(0, 3)), h('b', {}, String(Number(d.slice(8)))), h('i', {}, n ? `${n} ${n > 1 ? V.appts : V.appt}` : closed ? 'fechado' : ''));
    }));

    content.append(
      h('div', { class: 'head-row' },
        h('div', {}, h('h1', {}, 'Agenda'), h('p', { class: 'sub' }, fmtLong(date))),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => newAppointment(date) }, `+ Nova ${V.appt}`)),
      h('div', { class: 'daybar' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Dia anterior', onclick: () => go(addDays(date, -1)) }, '‹'),
        dateInput,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Próximo dia', onclick: () => go(addDays(date, 1)) }, '›'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => go(ctx.today) }, 'Hoje'),
        h('label', { class: 'toggle' }, cb, 'Mostrar canceladas')),
      strip,
      timeline(date, appointments.filter(a => a.date === date), blocks.filter(b => b.date === date)));
  }

  function timeline(date, appts, blocks) {
    const hrs = ctx.hours[wd(date)];
    const shown = appts.filter(a => showCancelled || a.status !== 'cancelled');
    let from = hrs.open ? toMin(hrs.start) : 480, to = hrs.open ? toMin(hrs.end) : 1080;
    for (const a of shown) { from = Math.min(from, toMin(a.time)); to = Math.max(to, toMin(a.end_time)); }
    from = Math.floor(from / 60) * 60; to = Math.ceil(to / 60) * 60;
    const box = h('div', { class: 'timeline' });
    box.style.height = (to - from) * PPM + 'px';
    const place = (el, s, e) => { el.style.top = (Math.max(s, from) - from) * PPM + 'px'; el.style.height = (Math.min(e, to) - Math.max(s, from)) * PPM - 2 + 'px'; return el; };

    // áreas fora do expediente / pausa
    if (!hrs.open) box.append(place(h('div', { class: 'tl-off' }), from, to));
    else {
      if (toMin(hrs.start) > from) box.append(place(h('div', { class: 'tl-off' }), from, toMin(hrs.start)));
      if (toMin(hrs.end) < to) box.append(place(h('div', { class: 'tl-off' }), toMin(hrs.end), to));
      if (hrs.break_start) box.append(place(h('div', { class: 'tl-off' }), toMin(hrs.break_start), toMin(hrs.break_end)));
    }
    for (let t = from; t < to; t += 30) {
      const line = h('div', { class: `tl-hour ${t % 60 ? 'half' : ''}` }, t % 60 === 0 ? `${String(t / 60).padStart(2, '0')}:00` : '');
      line.style.top = (t - from) * PPM + 'px';
      box.append(line);
    }
    if (hrs.open) {
      const step = Number(ctx.clinic.slot_step_min) || 30;
      for (let t = toMin(hrs.start); t < toMin(hrs.end); t += step) {
        const hhmm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        const b = h('button', { type: 'button', class: 'tl-click', 'aria-label': `Nova ${V.appt} às ${hhmm}`, onclick: () => newAppointment(date, hhmm) });
        box.append(place(b, t, t + step));
      }
    }
    for (const b of blocks) {
      const s = b.full_day ? from : toMin(b.start), e = b.full_day ? to : toMin(b.end);
      const item = h('div', { class: 'tl-item block' }, h('b', {}, b.full_day ? 'Dia inteiro indisponível' : `${b.start} – ${b.end} indisponível`), b.reason);
      box.append(place(item, s, e));
    }
    for (const a of shown) {
      const s = toMin(a.time), e = toMin(a.end_time);
      const conflict = ['scheduled', 'confirmed'].includes(a.status) && blocks.some(b => (b.full_day || (toMin(b.start) < e && s < toMin(b.end))));
      const item = h('button', { type: 'button', class: `tl-item ${a.status}${conflict ? ' conflict' : ''}`, onclick: () => appointmentModal(a) },
        h('b', {}, `${a.time} · ${a.name}`), `${a.service}${conflict ? ' — ⚠ em horário bloqueado' : ''}`);
      box.append(place(item, s, e));
    }
    if (!shown.length && hrs.open) box.append(h('p', { class: 'empty-note tl-empty' }, ''));
    return box;
  }

  // ---------- modal: detalhes da consulta ----------
  function appointmentModal(a) {
    const err = errBox();
    const act = async (patch, okMsg) => {
      try { await api(`/api/admin/appointments/${a.id}`, { method: 'PATCH', body: patch }); modal.close(); toast(okMsg); route(); }
      catch (e) { showErr(err, e); }
    };
    const btn = (label, cls, fn) => h('button', { type: 'button', class: `btn btn-sm ${cls}`, onclick: fn }, label);
    const actions = h('div', { class: 'modal-actions' });
    if (a.status === 'scheduled') actions.append(btn('Confirmar', 'btn-primary', () => act({ status: 'confirmed' }, `${cap(V.appt)} confirmada`)));
    if (a.status === 'confirmed') actions.append(
      btn('Marcar como concluída', 'btn-primary', () => act({ status: 'completed' }, `${cap(V.appt)} concluída`)),
      btn('Não compareceu', 'btn-ghost', () => act({ status: 'no_show' }, 'Registrado: não compareceu')));
    if (['completed', 'no_show', 'cancelled'].includes(a.status)) actions.append(btn(a.status === 'cancelled' ? 'Reativar' : 'Reabrir', 'btn-ghost', () => act({ status: 'confirmed' }, `${cap(V.appt)} reativada`)));
    if (['scheduled', 'confirmed'].includes(a.status)) {
      actions.append(btn('Remarcar', 'btn-ghost', () => rescheduleModal(a)),
        btn(`Cancelar ${V.appt}`, 'btn-danger', () => { if (confirm(`Cancelar a ${V.appt} de ${a.name}?`)) act({ status: 'cancelled' }, `${cap(V.appt)} cancelada`); }));
    }
    actions.append(h('a', { class: 'btn btn-sm btn-ghost', href: confirmMsg(a), target: '_blank', rel: 'noopener' }, 'WhatsApp do paciente'));

    openModal(h('h2', {}, a.name),
      h('p', {}, h('span', { class: `badge ${a.status}` }, STATUS[a.status])),
      err,
      h('dl', { class: 'details' },
        h('div', {}, h('dt', {}, 'Serviço'), h('dd', {}, a.service)),
        h('div', {}, h('dt', {}, 'Data'), h('dd', {}, fmtLong(a.date))),
        h('div', {}, h('dt', {}, 'Horário'), h('dd', {}, `${a.time} – ${a.end_time}`)),
        h('div', {}, h('dt', {}, 'Telefone'), h('dd', {}, fmtPhone(a.phone))),
        a.email && h('div', {}, h('dt', {}, 'E-mail'), h('dd', {}, a.email)),
        ME.ask_insurance && h('div', {}, h('dt', {}, 'Convênio'), h('dd', {}, a.insurance)),
        a.notes && h('div', {}, h('dt', {}, 'Observações'), h('dd', {}, a.notes)),
        h('div', {}, h('dt', {}, 'Código'), h('dd', {}, `${a.code} · ${a.source === 'admin' ? 'marcada no painel' : 'marcada pelo site'}`))),
      actions);
  }

  // seletor de horário reutilizado (remarcar e nova consulta)
  function slotPicker(onPick) {
    const wrap = h('div', { class: 'pick-slots' });
    let current = null;
    async function load(date, serviceId, preselect) {
      clear(wrap);
      if (!date || !serviceId) return;
      wrap.append(h('p', { class: 'muted' }, 'Carregando horários…'));
      try {
        const r = await api(`/api/admin/slots?date=${date}&service=${serviceId}`);
        clear(wrap);
        const list = r.slots;
        if (!r.open) return wrap.append(h('div', { class: 'empty' }, 'A clínica não atende neste dia.'));
        if (!list.length) return wrap.append(h('div', { class: 'empty' }, 'Sem horários neste dia.'));
        const grid = h('div', { class: 'slots' });
        for (const s of list) {
          const free = s.status === 'free';
          const b = h('button', { type: 'button', class: `slot ${s.status}`, disabled: !free, 'aria-pressed': 'false' },
            h('time', {}, s.time), !free && h('small', {}, s.status === 'busy' ? 'Ocupado' : s.status === 'past' ? 'Passou' : 'Bloqueado'));
          b.addEventListener('click', () => {
            grid.querySelectorAll('.slot').forEach(x => x.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', 'true'); current = s.time; onPick(s.time);
          });
          if (free && s.time === preselect) { b.setAttribute('aria-pressed', 'true'); current = s.time; onPick(s.time); }
          grid.append(b);
        }
        wrap.append(grid);
      } catch (e) { clear(wrap); wrap.append(h('div', { class: 'alert error' }, e.message)); }
    }
    return { el: wrap, load, get time() { return current; } };
  }

  function rescheduleModal(a) {
    const err = errBox();
    const svc = ctx.services.find(s => s.id === a.service_id);
    const date = h('input', { type: 'date', value: a.date, min: ctx.today });
    let chosen = null;
    const save = h('button', { type: 'button', class: 'btn btn-primary', disabled: true }, 'Remarcar para este horário');
    const picker = slotPicker(t => { chosen = t; save.disabled = false; });
    date.addEventListener('change', () => { chosen = null; save.disabled = true; picker.load(date.value, a.service_id); });
    save.addEventListener('click', async () => {
      try {
        await api(`/api/admin/appointments/${a.id}`, { method: 'PATCH', body: { date: date.value, time: chosen } });
        modal.close(); toast(`${cap(V.appt)} remarcada`); route();
      } catch (e) { showErr(err, e); picker.load(date.value, a.service_id); }
    });
    openModal(h('h2', {}, `Remarcar ${V.appt}`), h('p', { class: 'muted' }, `${a.name} · ${a.service} (${svc ? dur(svc.duration_min) : ''})`),
      err, field('Nova data', date), picker.el, h('div', { class: 'modal-actions' }, save));
    picker.load(date.value, a.service_id);
  }

  function newAppointment(date, time) {
    const err = errBox();
    const active = ctx.services.filter(s => s.active);
    const svc = h('select', {}, active.map(s => h('option', { value: s.id }, `${s.name} (${dur(s.duration_min)})`)));
    const dt = h('input', { type: 'date', value: date });
    const name = h('input', { type: 'text', maxlength: 100, autocomplete: 'off' });
    const phone = h('input', { type: 'tel', placeholder: '(85) 90000-0000' }); maskPhone(phone);
    const email = h('input', { type: 'email' });
    const ins = h('select', {}, ctx.insurances.map(i => h('option', { value: i }, i)));
    const notes = h('textarea', { maxlength: 500 });
    const save = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Agendar');
    let chosen = null;
    const picker = slotPicker(t => { chosen = t; save.disabled = false; });
    const reload = (keep) => { chosen = null; save.disabled = true; picker.load(dt.value, svc.value, keep); };
    svc.addEventListener('change', () => reload()); dt.addEventListener('change', () => reload());

    const form = h('form', { novalidate: true }, err,
      field('Serviço', svc), field('Data', dt), picker.el,
      h('div', { class: 'form-row' }, field('Nome do paciente', name), field('Telefone', phone)),
      h('div', { class: 'form-row' }, field('E-mail', email, '(opcional)'), ME.ask_insurance ? field('Convênio', ins) : null),
      field('Observações', notes, '(opcional)'), h('div', { class: 'modal-actions' }, save));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true;
      try {
        await api('/api/admin/appointments', { method: 'POST', body: { service_id: svc.value, date: dt.value, time: chosen, name: name.value, phone: phone.value, email: email.value, insurance: ins.value, notes: notes.value } });
        modal.close(); toast(`${cap(V.appt)} agendada`); agendaDate = dt.value; location.hash === '#agenda' ? route() : (location.hash = '#agenda');
      } catch (e) { showErr(err, e); reload(chosen); }
    });
    openModal(h('h2', {}, `Nova ${V.appt}`), form);
    reload(time);
  }

  // =====================================================================
  // Disponibilidade
  // =====================================================================
  async function disponibilidade() {
    await loadCtx(true);
    const blocks = await api(`/api/admin/blocks?from=${ctx.today || ''}`);

    // --- bloquear ---
    const err = errBox(), result = h('div');
    const date = h('input', { type: 'date', required: true, min: ctx.today || undefined });
    const until = h('input', { type: 'date' });
    const full = h('input', { type: 'checkbox' }); full.checked = true;
    const start = h('input', { type: 'time', value: '08:30' }), end = h('input', { type: 'time', value: '12:00' });
    const reason = h('input', { type: 'text', maxlength: 120, placeholder: 'Ex.: estou doente, consulta médica, curso…' });
    const timesRow = h('div', { class: 'form-row', hidden: true }, field('Das', start), field('Até', end));
    full.addEventListener('change', () => { timesRow.hidden = full.checked; });
    const form = h('form', { novalidate: true }, err,
      h('div', { class: 'form-row' }, field('Data', date), field('Até a data', until, '(opcional, para vários dias)')),
      h('label', { class: 'toggle' }, full, 'Dia inteiro'), h('div', { class: 'spacer' }), timesRow,
      field('Motivo', reason, '(só você vê)'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Bloquear'));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true; clear(result);
      if (!date.value) return showErr(err, { message: 'Escolha a data.' });
      try {
        const r = await api('/api/admin/blocks', { method: 'POST', body: { date: date.value, end_date: until.value || undefined, full_day: full.checked, start: start.value, end: end.value, reason: reason.value } });
        toast(r.created ? 'Indisponibilidade registrada' : 'Nenhum dia útil no período — nada a bloquear');
        if (r.affected.length) {
          result.append(h('div', { class: 'alert warn' }, h('b', {}, `Atenção: ${r.affected.length} ${V.appt}(s) já marcada(s) nesse período.`), ' Avise os clientes e cancele ou remarque:'),
            h('ul', { class: 'list' }, r.affected.map(a => h('li', {},
              h('span', { class: 'when' }, `${fmtShort(a.date)} ${a.time}`), h('span', { class: 'who' }, a.name, h('small', {}, `${a.service} · ${fmtPhone(a.phone)}`)),
              h('span', { class: 'acts' },
                h('a', { class: 'btn btn-ghost btn-sm', target: '_blank', rel: 'noopener', href: patientMsg(a, `Olá, ${a.name.split(' ')[0]}! Precisamos remarcar sua ${V.appt} de ${fmtNumeric(a.date)} às ${a.time} na ${ctx.clinic.clinic_name}. Podemos combinar um novo horário?`) }, 'Avisar'),
                h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async e => { e.target.disabled = true; try { await api(`/api/admin/appointments/${a.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); e.target.textContent = 'Cancelada'; } catch (x) { e.target.disabled = false; fail(x); } } }, 'Cancelar'))))));
          result.scrollIntoView({ block: 'nearest' });
        } else { setTimeout(route, 600); }
      } catch (e) { showErr(err, e); }
    });

    const blocksList = blocks.length
      ? h('ul', { class: 'list' }, blocks.map(b => h('li', {},
        h('span', { class: 'when' }, fmtShort(b.date)),
        h('span', { class: 'who' }, b.full_day ? 'Dia inteiro' : `${b.start} – ${b.end}`, b.reason && h('small', {}, b.reason)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { try { await api(`/api/admin/blocks/${b.id}`, { method: 'DELETE' }); toast('Bloqueio removido'); route(); } catch (e) { fail(e); } } }, 'Remover'))))
      : h('p', { class: 'empty-note' }, 'Nenhum bloqueio futuro.');

    // --- horário semanal ---
    const rows = ctx.hours.map(x => {
      const open = h('input', { type: 'checkbox' }); open.checked = x.open;
      const s = h('input', { type: 'time', value: x.start }), e = h('input', { type: 'time', value: x.end });
      const bs = h('input', { type: 'time', value: x.break_start }), be = h('input', { type: 'time', value: x.break_end });
      const row = h('div', { class: `hours-row ${x.open ? '' : 'off'}` },
        h('label', { class: 'toggle' }, open, h('b', {}, WEEKDAYS[x.weekday])),
        h('div', { class: 'times' }, 'das', s, 'às', e, h('span', {}, '· pausa'), bs, 'às', be));
      open.addEventListener('change', () => row.classList.toggle('off', !open.checked));
      return { x, open, s, e, bs, be, row };
    });
    const hoursErr = errBox();
    const saveHours = h('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar horário de funcionamento');
    saveHours.addEventListener('click', async () => {
      hoursErr.hidden = true;
      try {
        await api('/api/admin/hours', { method: 'PUT', body: rows.map(r => ({ weekday: r.x.weekday, open: r.open.checked, start: r.s.value, end: r.e.value, break_start: r.bs.value, break_end: r.be.value })) });
        ctx.hours = null; await loadCtx(); toast('Horário de funcionamento salvo');
      } catch (e) { showErr(hoursErr, e); }
    });

    content.append(h('h1', {}, 'Disponibilidade'), h('p', { class: 'sub' }, 'Bloqueie dias ou horários em que você não vai atender e defina seu expediente.'),
      h('div', { class: 'grid-2' },
        h('div', {}, h('div', { class: 'card' }, h('h2', {}, 'Bloquear data ou horário'), h('p', { class: 'muted' }, 'Esses horários deixam de aparecer para os pacientes.'), form, result)),
        h('div', { class: 'card' }, h('h2', {}, 'Bloqueios futuros'), blocksList)),
      h('div', { class: 'card' }, h('h2', {}, 'Horário de funcionamento'), h('p', { class: 'muted' }, 'Deixe o dia desmarcado para não atender. A pausa é opcional (ex.: almoço).'),
        hoursErr, h('div', { class: 'hours-grid' }, rows.map(r => r.row)), h('div', { class: 'modal-actions' }, saveHours)));
  }

  // =====================================================================
  // Serviços
  // =====================================================================
  async function servicos() {
    await loadCtx(true);
    const list = h('div', {}, ctx.services.map(s => h('div', { class: `svc-row ${s.active ? '' : 'inactive'}` },
      h('div', {}, h('b', {}, s.name), h('small', {}, s.description || 'Sem descrição'), !s.active && h('small', {}, 'Oculto no site')),
      h('span', {}, dur(s.duration_min)),
      h('span', { class: 'acts' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => serviceModal(s) }, 'Editar')))));
    content.append(
      h('div', { class: 'head-row' }, h('div', {}, h('h1', {}, 'Serviços'), h('p', { class: 'sub' }, 'A duração define quanto tempo da agenda cada serviço ocupa.')),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => serviceModal() }, '+ Novo serviço')),
      h('div', { class: 'card' }, list));
  }

  function serviceModal(s) {
    const err = errBox();
    const name = h('input', { type: 'text', maxlength: 80, value: s?.name || '' });
    const desc = h('input', { type: 'text', maxlength: 200, value: s?.description || '' });
    const mins = h('input', { type: 'number', min: 5, max: 480, step: 5, value: s?.duration_min || 30 });
    const active = h('input', { type: 'checkbox' }); active.checked = s ? s.active : true;
    const form = h('form', { novalidate: true }, err,
      field('Nome', name), field('Descrição', desc, '(aparece no site)'), field('Duração em minutos', mins),
      h('label', { class: 'toggle' }, active, 'Visível no site e disponível para agendar'),
      h('div', { class: 'modal-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar'),
        s && h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
          if (!confirm(`Excluir "${s.name}"? Se já houver ${V.appts} com ele, será apenas ocultado.`)) return;
          try { const r = await api(`/api/admin/services/${s.id}`, { method: 'DELETE' }); modal.close(); toast(r.deactivated ? `Serviço ocultado (há ${V.appts} vinculadas)` : 'Serviço excluído'); route(); } catch (e) { showErr(err, e); }
        } }, 'Excluir')));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true;
      try {
        await api(s ? `/api/admin/services/${s.id}` : '/api/admin/services', { method: s ? 'PUT' : 'POST', body: { name: name.value, description: desc.value, duration_min: Number(mins.value), active: active.checked } });
        modal.close(); toast('Serviço salvo'); route();
      } catch (e) { showErr(err, e); }
    });
    openModal(h('h2', {}, s ? 'Editar serviço' : 'Novo serviço'), form);
  }

  // =====================================================================
  // Configurações
  // =====================================================================
  async function config() {
    await loadCtx(true);
    const c = ctx.clinic, err = errBox();
    const inputs = {
      clinic_name: h('input', { type: 'text', value: c.clinic_name }),
      clinic_phone: h('input', { type: 'text', value: c.clinic_phone }),
      clinic_whatsapp: h('input', { type: 'text', value: c.clinic_whatsapp }),
      clinic_address: h('input', { type: 'text', value: c.clinic_address || '', maxlength: 160 }),
      clinic_instagram: h('input', { type: 'text', value: c.clinic_instagram }),
      slot_step_min: h('input', { type: 'number', min: 10, max: 120, step: 5, value: c.slot_step_min }),
      min_advance_min: h('input', { type: 'number', min: 0, step: 30, value: c.min_advance_min }),
      max_days_ahead: h('input', { type: 'number', min: 1, max: 365, value: c.max_days_ahead }),
    };
    const form = h('form', { novalidate: true }, err,
      field('Nome da clínica', inputs.clinic_name),
      h('div', { class: 'form-row' }, field('Telefone exibido', inputs.clinic_phone), field('WhatsApp (com DDD)', inputs.clinic_whatsapp)),
      field('Endereço', inputs.clinic_address, '(aparece no site com link para o mapa)'),
      field('Instagram', inputs.clinic_instagram),
      h('div', { class: 'form-row' }, field('Intervalo entre horários (min)', inputs.slot_step_min), field('Antecedência mínima (min)', inputs.min_advance_min)),
      field('Quantos dias à frente o site aceita agendamentos', inputs.max_days_ahead),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar configurações'));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.hidden = true;
      try {
        ctx.clinic = await api('/api/admin/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])) });
        toast('Configurações salvas');
      } catch (e) { showErr(err, e); }
    });

    const perr = errBox();
    const cur = h('input', { type: 'password', autocomplete: 'current-password' }), nxt = h('input', { type: 'password', autocomplete: 'new-password' });
    const pform = h('form', { novalidate: true }, perr, field('Senha atual', cur), field('Nova senha', nxt, '(mínimo 10 caracteres)'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Trocar senha'));
    pform.addEventListener('submit', async ev => {
      ev.preventDefault(); perr.hidden = true;
      try { await api('/api/admin/password', { method: 'POST', body: { current: cur.value, next: nxt.value } }); cur.value = nxt.value = ''; toast('Senha alterada'); }
      catch (e) { showErr(perr, e); }
    });
    content.append(h('h1', {}, 'Configurações'), h('p', { class: 'sub' }, 'Dados exibidos no site e regras do agendamento.'),
      h('div', { class: 'grid-2' }, h('div', { class: 'card' }, h('h2', {}, 'Clínica e agendamento'), form), h('div', { class: 'card' }, h('h2', {}, 'Segurança'), pform)));
  }

  window.AdminKit = {
    h, api, clear, ctx, content, modal, toast, openModal, loadCtx, field, errBox, showErr, fail, route, fmtLong, fmtShort, fmtNumeric, fmtPhone,
    addDays, dur, STATUS, WEEKDAYS, patientMsg, whatsappUrl, maskPhone, vocab: () => V, cap, me: () => ME,
    extend: (vertical, ext) => { EXT[vertical] = ext; },
    setAgendaDate: d => { agendaDate = d; },
  };
  document.addEventListener('DOMContentLoaded', boot);
})();
