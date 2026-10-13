(async () => {
  const { h, api, hm, dur, WEEKDAYS } = OV;
  let info;
  try { info = await api('/api/public/info'); } catch { return; }

  // Horário de atendimento: agrupa dias consecutivos com o mesmo horário (ex.: Segunda à sexta)
  const label = x => x.open ? `${hm(x.start)} às ${hm(x.end)}` : null;
  const todayWd = new Date(info.today + 'T12:00:00Z').getUTCDay();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups = [];
  for (const wd of order) {
    const x = info.hours[wd];
    const lbl = label(x);
    const last = groups.at(-1);
    if (last && last.lbl === lbl && last.break === (x.break_start || '') + (x.break_end || '')) { last.days.push(wd); }
    else groups.push({ lbl, days: [wd], break: (x.break_start || '') + (x.break_end || '') , x });
  }
  const dayName = wd => WEEKDAYS[wd].replace('-feira', '');
  const body = document.getElementById('hours-body');
  for (const g of groups) {
    const name = g.days.length > 1 ? `${dayName(g.days[0])} à ${dayName(g.days.at(-1)).toLowerCase()}` : dayName(g.days[0]);
    const value = g.lbl ? (g.x.break_start ? `${g.lbl} (pausa ${hm(g.x.break_start)}–${hm(g.x.break_end)})` : g.lbl) : 'Fechado';
    body.append(h('tr', { class: g.days.includes(todayWd) ? 'today' : '' },
      h('td', {}, name), h('td', { class: g.lbl ? '' : 'closed' }, value)));
  }

  const list = document.getElementById('services');
  for (const s of info.services) {
    list.append(h('article', { class: 'service' },
      h('span', { class: 'meta' }, `Duração ~ ${dur(s.duration_min)}`),
      h('h3', {}, s.name),
      s.description && h('p', {}, s.description)));
  }

  const ins = document.getElementById('insurances');
  for (const n of info.insurances.filter(x => x !== 'Outro convênio')) ins.append(h('span', { class: 'chip' }, n));

  document.getElementById('phone-line').textContent = `WhatsApp ${info.clinic.phone}`;
})();
