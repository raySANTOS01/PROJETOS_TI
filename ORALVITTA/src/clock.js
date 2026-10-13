// Relógio no fuso de Fortaleza (UTC-3, sem horário de verão).
// FAKE_NOW="2026-10-13T09:00" permite simular a data/hora (útil em testes e demonstrações).
const TZ = 'America/Fortaleza';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function now() {
  const fake = process.env.FAKE_NOW;
  const d = fake ? new Date(fake + (fake.endsWith('Z') ? '' : '-03:00')) : new Date();
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    min: Number(p.hour) * 60 + Number(p.minute),
  };
}

module.exports = { now, TZ };
