(async () => {
  const { h, api, clear, fmtLong, fmtNumeric, monthLabel, dur, hm, STATUS, maskPhone, whatsappUrl } = OV;
  const stage = document.getElementById('stage');
  const summary = document.getElementById('summary');
  const stepsEl = document.getElementById('steps');

  let info;
  try { info = await api('/api/public/info'); }
  catch (e) { stage.append(h('div', { class: 'alert error' }, e.message)); return; }

  const V = info.vocab, cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const state = {
    step: 1, service: null, month: info.today.slice(0, 7), days: [], date: null, slots: null, time: null,
    form: { name: '', phone: '', email: '', insurance: 'Particular', notes: '', consent: false, ...Object.fromEntries(info.purchase_fields.map(x => [x.key, ''])) },
    result: null,
  };
  const lastDate = OV.addDays(info.today, info.max_days_ahead);

  function renderSteps() {
    [...stepsEl.children].forEach((li, i) => {
      li.className = i + 1 === state.step ? 'current' : i + 1 < state.step ? 'done' : '';
      if (i + 1 === state.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  function renderSummary() {
    clear(summary);
    const row = (t, v) => [h('dt', {}, t), h('dd', { class: v ? '' : 'empty-v' }, v || '—')];
    summary.append(h('h3', {}, 'Resumo'), h('dl', {},
      ...row('Serviço', state.service && state.service.name),
      ...row('Duração', state.service && dur(state.service.duration_min)),
      ...row('Data', state.date && fmtLong(state.date)),
      ...row('Horário', state.time && hm(state.time))));
  }

  function render() {
    renderSteps(); renderSummary(); clear(stage);
    ({ 1: stepService, 2: stepDateTime, 3: stepForm, 4: stepDone })[state.step]();
    stage.scrollIntoView?.({ block: 'nearest' });
  }

  const errorBox = () => h('div', { class: 'alert error', hidden: true, role: 'alert' });
  const showError = (box, msg) => { box.textContent = msg; box.hidden = false; box.scrollIntoView?.({ block: 'nearest' }); };

  // ---------- 1. serviço ----------
  function stepService() {
    stage.append(h('h2', {}, info.vertical === 'loja' ? `Qual ${V.appt} você deseja?` : 'Qual serviço você procura?'),
      h('p', { class: 'muted' }, `A duração da ${V.appt} define quais horários aparecem como livres.`),
      h('div', { class: 'choice-list' }, info.services.map(s =>
        h('button', {
          type: 'button', class: 'choice', 'aria-pressed': String(state.service?.id === s.id),
          onclick: () => { state.service = s; state.date = null; state.time = null; state.slots = null; state.step = 2; loadMonth(); },
        }, h('span', {}, h('strong', {}, s.name), s.description && h('small', {}, s.description)),
        h('span', { class: 'dur' }, dur(s.duration_min))))));
  }

  // ---------- 2. data e horário ----------
  async function loadMonth() {
    render();
    try {
      const r = await api(`/api/public/month?month=${state.month}&service=${state.service.id}`);
      state.days = r.days;
    } catch (e) { state.days = []; }
    render();
  }

  async function pickDate(date) {
    state.date = date; state.time = null; state.slots = null;
    render();
    try { state.slots = await api(`/api/public/slots?date=${date}&service=${state.service.id}`); }
    catch (e) { state.slots = { slots: [], error: e.message }; }
    render();
  }

  function calendar() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const cur = info.today.slice(0, 7);
    const lastMonth = lastDate.slice(0, 7);
    const shift = n => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); state.month = d.toISOString().slice(0, 7); state.date = null; state.slots = null; state.time = null; loadMonth(); };
    const byDate = Object.fromEntries(state.days.map(d => [d.date, d]));
    const cells = [];
    for (const d of ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']) cells.push(h('div', { class: 'dow', 'aria-hidden': 'true' }, d));
    for (let i = 0; i < first; i++) cells.push(h('div'));
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= total; d++) {
      const date = `${state.month}-${String(d).padStart(2, '0')}`;
      const info_ = byDate[date];
      const status = !info_ ? 'past' : date > lastDate ? 'past' : info_.status;
      const ok = status === 'available';
      cells.push(h('button', {
        type: 'button', disabled: !ok,
        class: `day ${status}${date === state.date ? ' selected' : ''}${date === info.today ? ' today' : ''}`,
        'aria-label': `${fmtLong(date)} — ${ok ? 'horários disponíveis' : status === 'full' ? 'sem horários livres' : 'indisponível'}`,
        'aria-pressed': ok ? String(date === state.date) : null,
        onclick: () => pickDate(date),
      }, String(d)));
    }
    return h('div', {},
      h('div', { class: 'cal-head' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mês anterior', disabled: state.month <= cur, onclick: () => shift(-1) }, '‹'),
        h('h3', {}, monthLabel(state.month)),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Próximo mês', disabled: state.month >= lastMonth, onclick: () => shift(1) }, '›')),
      h('div', { class: 'cal' }, cells),
      h('div', { class: 'legend' },
        h('span', {}, h('i'), 'Com horários'),
        h('span', {}, h('i', { class: 'full' }), 'Sem horários / fechado')));
  }

  function slotsView() {
    if (!state.date) return h('div', { class: 'empty' }, 'Escolha um dia no calendário para ver os horários.');
    if (!state.slots) return h('div', { class: 'empty' }, 'Carregando horários…');
    if (state.slots.error) return h('div', { class: 'alert error' }, state.slots.error);
    const visible = state.slots.slots.filter(s => s.status !== 'past');
    if (!visible.length) return h('div', { class: 'empty' }, 'Não há horários neste dia.');
    return h('div', {},
      h('p', { class: 'muted', style: null }, fmtLong(state.date)),
      h('div', { class: 'slots', role: 'group', 'aria-label': 'Horários' }, visible.map(s => {
        const free = s.status === 'free';
        return h('button', {
          type: 'button', class: `slot ${s.status}`, disabled: !free, 'aria-pressed': free ? String(state.time === s.time) : null,
          onclick: () => { state.time = s.time; render(); },
        }, h('time', {}, s.time), !free && h('small', {}, s.status === 'busy' ? 'Ocupado' : 'Indisponível'));
      })));
  }

  function stepDateTime() {
    stage.append(h('h2', {}, 'Escolha a data e o horário'),
      h('p', { class: 'muted' }, `${state.service.name} · ${dur(state.service.duration_min)}. Horários ocupados aparecem riscados.`),
      h('div', { class: 'datetime' }, calendar(), h('div', {}, h('h3', { class: 'sr-only' }, 'Horários'), slotsView())),
      h('div', { class: 'nav-buttons' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { state.step = 1; render(); } }, 'Voltar'),
        h('button', { type: 'button', class: 'btn btn-primary', disabled: !state.time, onclick: () => { state.step = 3; render(); } }, 'Continuar')));
  }

  // ---------- 3. dados ----------
  function stepForm() {
    const f = state.form;
    const err = errorBox();
    const bind = (id, key) => el => { el.id = id; el.value = f[key]; el.addEventListener('input', () => { f[key] = el.value; }); return el; };
    const phoneInput = bind('f-phone', 'phone')(h('input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '(85) 90000-0000', required: true }));
    maskPhone(phoneInput);
    const insurance = bind('f-ins', 'insurance')(h('select', {}, info.insurances.map(i => h('option', { value: i }, i))));
    insurance.value = f.insurance;
    const consent = h('input', { type: 'checkbox', id: 'f-consent' });
    consent.checked = f.consent;
    consent.addEventListener('change', () => { f.consent = consent.checked; });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Confirmar agendamento');

    const form = h('form', { novalidate: true },
      err,
      h('label', { class: 'field' }, h('span', {}, 'Nome completo'), bind('f-name', 'name')(h('input', { type: 'text', autocomplete: 'name', maxlength: 100, required: true }))),
      ...info.purchase_fields.map(x => Loja.purchaseField(x, f)),
      h('div', { class: 'form-row' },
        h('label', { class: 'field' }, h('span', {}, 'Telefone / WhatsApp'), phoneInput),
        h('label', { class: 'field' }, h('span', {}, 'E-mail ', h('em', {}, '(opcional)')), bind('f-email', 'email')(h('input', { type: 'email', autocomplete: 'email', maxlength: 254 })))),
      info.ask_insurance && h('label', { class: 'field' }, h('span', {}, 'Convênio'), insurance),
      h('label', { class: 'field' }, h('span', {}, info.booking.notes_label + ' ', h('em', {}, '(opcional)')), bind('f-notes', 'notes')(h('textarea', { maxlength: 500, placeholder: info.booking.notes_hint || 'Ex.: paciente é criança, está com dor, alergias…' }))),
      h('label', { class: 'check' }, consent, h('span', {}, 'Concordo que meus dados sejam usados apenas para gerenciar este agendamento e entrar em contato sobre ele.')),
      h('div', { class: 'nav-buttons' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { state.step = 2; render(); } }, 'Voltar'), submit));

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      err.hidden = true;
      if (!f.name.trim()) return showError(err, 'Informe seu nome.');
      for (const x of info.purchase_fields) if (x.required && !String(f[x.key]).trim()) return showError(err, `${x.label}: preenchimento obrigatório.`);
      if (f.phone.replace(/\D/g, '').length < 10) return showError(err, 'Informe um telefone válido com DDD.');
      if (!f.consent) return showError(err, 'É necessário concordar para continuar.');
      submit.disabled = true; submit.textContent = 'Confirmando…';
      try {
        state.result = await api('/api/public/appointments', {
          method: 'POST',
          body: { service_id: state.service.id, date: state.date, time: state.time, ...f },
        });
        state.step = 4; render();
      } catch (e) {
        submit.disabled = false; submit.textContent = 'Confirmar agendamento';
        if (e.status === 409) {
          // Alguém pegou o horário: volta para a escolha com horários atualizados
          const msg = e.message; state.time = null; state.step = 2;
          await loadMonth(); await pickDate(state.date);
          stage.prepend(h('div', { class: 'alert warn', role: 'alert' }, msg));
        } else showError(err, e.message);
      }
    });
    stage.append(h('h2', {}, 'Seus dados'), h('p', { class: 'muted' }, `Usamos o telefone para localizar e confirmar sua ${V.appt}.`), form);
  }

  // ---------- 4. confirmação ----------
  function stepDone() {
    const r = state.result;
    const wa = whatsappUrl(info.clinic.whatsapp,
      `Olá! Acabei de agendar pelo site: ${r.service}, ${fmtNumeric(r.date)} às ${r.time}. Código ${r.code}. Nome: ${r.name}.`);
    stage.append(h('div', { class: 'ticket' },
      h('div', { class: 'check-ico', 'aria-hidden': 'true' }, '✓'),
      h('h2', {}, `${cap(V.appt)} agendada!`),
      h('p', { class: 'muted' }, `Guarde o código abaixo: com ele e seu telefone você acompanha ou cancela a ${V.appt}.`),
      h('div', { class: 'code', 'aria-label': 'Código ' + r.code.split('').join(' ') }, r.code),
      h('dl', { class: 'details' },
        h('div', {}, h('dt', {}, 'Serviço'), h('dd', {}, r.service)),
        h('div', {}, h('dt', {}, 'Data'), h('dd', {}, fmtLong(r.date))),
        h('div', {}, h('dt', {}, 'Horário'), h('dd', {}, `${r.time} – ${r.end_time}`)),
        h('div', {}, h('dt', {}, 'Paciente'), h('dd', {}, r.name)),
        h('div', {}, h('dt', {}, 'Status'), h('dd', {}, h('span', { class: `badge ${r.status}` }, STATUS[r.status])))),
      h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-primary', href: wa, target: '_blank', rel: 'noopener' }, 'Avisar a clínica no WhatsApp'),
        h('a', { class: 'btn btn-ghost', href: `/consulta?code=${r.code}` }, `Acompanhar ${V.appt}`),
        h('a', { class: 'btn btn-ghost', href: '/' }, 'Voltar ao início'))));
  }

  const wanted = Number(new URLSearchParams(location.search).get('service'));
  const preset = info.services.find(x => x.id === wanted);
  if (preset) { state.service = preset; state.step = 2; loadMonth(); } else render();
})();
