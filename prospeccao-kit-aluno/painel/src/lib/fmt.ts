export const brl = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === ''
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const num = (v: number | string | null | undefined, casas = 0) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });

export const dataHora = (v: string | Date | null | undefined) =>
  !v ? '—' : new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export const data = (v: string | Date | null | undefined) =>
  !v ? '—' : new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/** "5521998105076" -> "+55 21 99810-5076" */
export function telefone(t: string | null | undefined) {
  if (!t) return '—';
  const d = t.replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : t;
}

export function desde(v: string | Date | null | undefined) {
  if (!v) return '—';
  const ms = Date.now() - new Date(v).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}
