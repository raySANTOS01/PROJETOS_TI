// A régua: quanto mais a empresa se deixa encontrar, melhor o lead.
// Cada ponto fica registrado em `sinais` — discordar de uma nota é ler a conta, não adivinhar.

export const PESOS_PADRAO = {
  site_vivo: 25,
  instagram: 15,
  email: 15,
  telefone: 10,
  whatsapp: 10,
  reputacao: 10,   // nota >= 4,0 com >= 10 avaliações
  cnpj: 5,
  linkedin: 5,
  endereco: 5,
};

export const FAIXAS = [
  { classe: 'A', minimo: 75, rotulo: 'quente' },
  { classe: 'B', minimo: 50, rotulo: 'bom' },
  { classe: 'C', minimo: 25, rotulo: 'fraco' },
  { classe: 'D', minimo: 0,  rotulo: 'descartar' },
];

const ROTULOS = {
  site_vivo: 'site no ar', instagram: 'Instagram', email: 'e-mail', telefone: 'telefone', whatsapp: 'WhatsApp',
  reputacao: 'boa reputação no Google', cnpj: 'CNPJ', linkedin: 'LinkedIn', endereco: 'endereço',
};

/**
 * A nota por extenso, para quem discorda dela na planilha:
 * "A · 85 de 100 (quente, 75 ou mais). Somou: site no ar +25, Instagram +20. Faltou: e-mail (10), CNPJ (5)."
 * Sinal com peso zero no nicho não aparece em "faltou" — não faltou nada ali.
 */
export function justificarNota({ score, classificacao, sinais }, pesos = PESOS_PADRAO) {
  if (!sinais || score == null) return null;
  const p = { ...PESOS_PADRAO, ...pesos };
  const faixa = FAIXAS.find((f) => f.classe === classificacao) ?? FAIXAS.find((f) => score >= f.minimo);
  const somou = [], faltou = [];
  for (const [nome, rotulo] of Object.entries(ROTULOS)) {
    const s = sinais[nome];
    if (!s) continue;
    if (!(p[nome] > 0)) continue;   // peso zero no nicho: não soma nem falta, nem aparece
    const extra = s.nota && nome === 'reputacao' ? ` (${s.nota.replace(/(\d)\.(\d)/, '$1,$2')})` : '';
    if (s.tem) somou.push(`${rotulo} +${s.pontos}${extra}`);
    else faltou.push(`${rotulo} (${p[nome]})${extra}`);
  }
  const corte = faixa.minimo ? `${faixa.minimo} ou mais` : 'abaixo de 25';
  let texto = `${faixa.classe} · ${score} de 100 (${faixa.rotulo}, ${corte}).`;
  if (somou.length) texto += ` Somou: ${somou.join(', ')}.`;
  if (faltou.length) texto += ` Faltou: ${faltou.join(', ')}.`;
  if (sinais.site_morto?.tem) texto += ' Atenção: o site divulgado no Maps está fora do ar.';
  return texto;
}

export function classificar(lead, dados = {}, pesos = PESOS_PADRAO) {
  const p = { ...PESOS_PADRAO, ...pesos };
  const sinais = {};
  let score = 0;

  const marcar = (nome, tem, peso, nota) => {
    sinais[nome] = { tem, pontos: tem ? peso : 0, ...(nota ? { nota } : {}) };
    if (tem) score += peso;
  };

  const temSite = Boolean(lead.site || dados.site_url_final);
  const siteVivo = dados.site_vivo === true;

  marcar('site_vivo', siteVivo, p.site_vivo,
    temSite ? (siteVivo ? null : `site cadastrado não responde: ${dados.site_erro ?? 'sem detalhe'}`) : 'sem site no Maps');
  marcar('instagram', Boolean(dados.instagram), p.instagram);
  marcar('email', (dados.emails?.length ?? 0) > 0, p.email);
  marcar('telefone', Boolean(lead.telefone_google) || (dados.telefones_site?.length ?? 0) > 0, p.telefone);
  marcar('whatsapp', Boolean(dados.whatsapp), p.whatsapp);

  const reputacao = Number(lead.avaliacao) >= 4.0 && Number(lead.total_avaliacoes) >= 10;
  marcar('reputacao', reputacao, p.reputacao,
    lead.total_avaliacoes ? `${lead.avaliacao ?? '—'} com ${lead.total_avaliacoes} avaliações` : 'sem avaliações');
  marcar('cnpj', Boolean(dados.cnpj), p.cnpj);
  marcar('linkedin', Boolean(dados.linkedin), p.linkedin);
  marcar('endereco', Boolean(lead.endereco), p.endereco);

  // Bandeira à parte: parece estruturado (tem site divulgado) e o site está morto.
  // Não é só ausência de ponto — é um fato que muda a abordagem.
  const site_morto = temSite && !siteVivo;
  if (site_morto) sinais.site_morto = { tem: true, pontos: 0, nota: 'site divulgado no Maps está fora do ar' };

  const faixa = FAIXAS.find((f) => score >= f.minimo);
  return { score, classificacao: faixa.classe, rotulo: faixa.rotulo, sinais: { ...sinais, _total: score } };
}
