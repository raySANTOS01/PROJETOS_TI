(() => {
  const { h, api, clear, fmtLong, STATUS, maskPhone, whatsappUrl } = OV;
  const form = document.getElementById('lookup-form');
  const errBox = document.getElementById('lookup-error');
  const result = document.getElementById('result');
  const code = document.getElementById('code');
  const phone = document.getElementById('phone');
  maskPhone(phone);

  const q = new URLSearchParams(location.search).get('code');
  if (q) code.value = q.toUpperCase().slice(0, 6);

  let clinic = null, V = { appt: 'consulta' }, askIns = true;
  api('/api/public/info').then(i => { clinic = i.clinic; V = i.vocab; askIns = i.ask_insurance; }).catch(() => {});

  const creds = () => ({ code: code.value.trim().toUpperCase(), phone: phone.value });

  function show(a) {
    clear(result); result.hidden = false;
    const active = ['scheduled', 'confirmed'].includes(a.status);
    const actions = h('div', { class: 'row-actions' });
    if (active) {
      const cancel = h('button', { type: 'button', class: 'btn btn-danger' }, `Cancelar ${V.appt}`);
      cancel.addEventListener('click', async () => {
        if (!confirm(`Tem certeza que deseja cancelar esta ${V.appt}?`)) return;
        cancel.disabled = true;
        try { show(await api('/api/public/cancel', { method: 'POST', body: creds() })); }
        catch (e) { cancel.disabled = false; alert(e.message); }
      });
      actions.append(cancel);
    }
    if (clinic) {
      actions.append(h('a', {
        class: 'btn btn-ghost', target: '_blank', rel: 'noopener',
        href: whatsappUrl(clinic.whatsapp, `Olá! Sobre minha ${V.appt} (código ${a.code}) em ${a.date.split('-').reverse().join('/')} às ${a.time}.`),
      }, 'Falar com a clínica'));
    }
    actions.append(h('a', { class: 'btn btn-primary', href: '/agendar' }, active ? 'Novo agendamento' : 'Agendar novamente'));
    result.append(h('div', { class: 'ticket' },
      h('span', { class: `badge ${a.status}` }, STATUS[a.status]),
      h('h2', {}, a.service),
      h('dl', { class: 'details' },
        h('div', {}, h('dt', {}, 'Data'), h('dd', {}, fmtLong(a.date))),
        h('div', {}, h('dt', {}, 'Horário'), h('dd', {}, `${a.time} – ${a.end_time}`)),
        h('div', {}, h('dt', {}, 'Paciente'), h('dd', {}, a.name)),
        askIns && h('div', {}, h('dt', {}, 'Convênio'), h('dd', {}, a.insurance)),
        h('div', {}, h('dt', {}, 'Código'), h('dd', {}, a.code))),
      actions));
    result.scrollIntoView?.({ block: 'nearest' });
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    errBox.hidden = true; result.hidden = true;
    try { show(await api('/api/public/lookup', { method: 'POST', body: creds() })); }
    catch (e) { errBox.textContent = e.message; errBox.hidden = false; }
  });
})();
