// Requisito é o que ELIMINA; o score só ordena quem sobrou.
// Um lead sem Instagram perde pontos e continua na lista. Um lead com telefone fixo, num nicho
// que exige celular, sai da lista — com o motivo escrito, pra quem quiser discordar.

/** Celular brasileiro em E.164: 55 + DDD + 9 + 8 dígitos. Fixo, 0800, 0300, 3003 e 4004 não passam. */
export const ehCelular = (tel) => /^55[1-9][1-9]9\d{8}$/.test(String(tel ?? ''));

/** O melhor celular do lead: o do link de WhatsApp vale mais, depois o do Maps, depois o do site. */
export function melhorCelular(lead) {
  return [lead.whatsapp, lead.telefone_google, ...(lead.telefones_site ?? [])].find(ehCelular) ?? null;
}

/**
 * @param lead      a linha do banco
 * @param regras    `requisitos` do JSON do nicho (ausente = nenhum requisito)
 * @param repetidos Set de celulares que aparecem em mais de uma empresa (número de central)
 */
export function checarRequisitos(lead, regras, repetidos = new Set()) {
  const celular = melhorCelular(lead);
  if (!regras) return { ok: true, motivos: [], celular };

  const motivos = [];
  const n = lead.total_avaliacoes ?? 0;
  if (regras.avaliacoes_min != null && n < regras.avaliacoes_min) motivos.push(`${n} avaliações (mínimo ${regras.avaliacoes_min})`);
  if (regras.avaliacoes_max != null && n > regras.avaliacoes_max) motivos.push(`${n} avaliações (máximo ${regras.avaliacoes_max})`);
  if (regras.exige_celular) {
    if (!celular) motivos.push('sem celular nem no Maps nem no site');
    else if (repetidos.has(celular)) motivos.push('celular repetido em outras empresas (central)');
  }
  if (regras.exige_site && !lead.site_vivo) motivos.push('sem site próprio no ar');
  // Seguidores só julgam quem teve o perfil consultado: sem Instagram ou sem consulta, não reprova por isso.
  if (lead.seguidores != null) {
    if (regras.seguidores_min != null && lead.seguidores < regras.seguidores_min) motivos.push(`${lead.seguidores} seguidores (mínimo ${regras.seguidores_min})`);
    if (regras.seguidores_max != null && lead.seguidores > regras.seguidores_max) motivos.push(`${lead.seguidores} seguidores (máximo ${regras.seguidores_max})`);
  }

  return { ok: motivos.length === 0, motivos, celular };
}
