// CNPJ na Receita: quem é a empresa no papel — razão social, abertura, porte, capital e os sócios.
// O sócio-administrador é o nome de quem decide: "falar com a Marta" abre porta que "olá, clínica" não abre.
//
// Duas APIs gratuitas, sem chave:
//   1. BrasilAPI  — sem limite rígido, mas devolve 403 para quem não manda User-Agent
//   2. cnpj.ws    — reserva: 3 consultas por minuto (x-ratelimit-limit: 3), testado em 15/set/2026
// Quando o site não publica o CNPJ, a pesquisa no Google (Serper) acha os candidatos; sem Serper, fica sem.
// A busca confunde empresas de nome parecido — em 18/set/2026 a visão geral do Google deu o CNPJ de
// outra clínica de nome quase igual — então o número só entra se o CEP da Receita bater com o do Maps.

const UA = { 'User-Agent': 'prospeccao-kit/1.0', Accept: 'application/json' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
export const formatar = (c) => soDigitos(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

// O telefone e o e-mail que a empresa declarou na Receita — muitas vezes o do dono ou o do contador,
// fora do que o site e o Maps mostram. Ideia do fluxo [SPB][BDR] 4 do n8n (campo telefone_socios).
const telefonesReceita = (...brutos) => [...new Set(brutos.map(soDigitos).filter((t) => t.length >= 10).map((t) => `55${t}`))];
const emailReceita = (e) => (e && /@/.test(e) ? String(e).trim().toLowerCase() : null);

/** 8599604 -> "8599-6/04": o CNAE como a Receita escreve. */
export const formatarCnae = (c) => soDigitos(c).padStart(7, '0').replace(/^(\d{4})(\d)(\d{2})$/, '$1-$2/$3');

/** Dígito verificador: descarta o número torto de um resultado de busca antes de gastar consulta. */
export function cnpjValido(v) {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
}

const doBrasilApi = (j) => ({
  cnpj: formatar(j.cnpj),
  razao_social: j.razao_social ?? null,
  nome_fantasia: j.nome_fantasia || null,
  situacao: j.descricao_situacao_cadastral ?? null,
  abertura: j.data_inicio_atividade ?? null,
  capital_social: j.capital_social != null ? Number(j.capital_social) : null,
  porte: j.porte ?? null,
  atividade: j.cnae_fiscal_descricao ?? null,
  cnae: j.cnae_fiscal ? formatarCnae(j.cnae_fiscal) : null,
  cnaes_secundarios: (j.cnaes_secundarios ?? []).filter((c) => c.codigo).slice(0, 8)
    .map((c) => ({ cnae: formatarCnae(c.codigo), descricao: c.descricao })),
  natureza_juridica: j.natureza_juridica ?? null,
  cep: soDigitos(j.cep) || null,
  municipio: j.municipio ?? null,
  uf: j.uf ?? null,
  telefones: telefonesReceita(j.ddd_telefone_1, j.ddd_telefone_2),
  email: emailReceita(j.email),
  socios: (j.qsa ?? []).map((s) => ({
    nome: s.nome_socio, cargo: s.qualificacao_socio,
    desde: s.data_entrada_sociedade ?? null, faixa_etaria: s.faixa_etaria || null,
  })),
});

const doCnpjWs = (j) => {
  const e = j.estabelecimento ?? {};
  return {
    cnpj: formatar(e.cnpj),
    razao_social: j.razao_social ?? null,
    nome_fantasia: e.nome_fantasia || null,
    situacao: e.situacao_cadastral ?? null,
    abertura: e.data_inicio_atividade ?? null,
    capital_social: j.capital_social != null ? Number(j.capital_social) : null,
    porte: j.porte?.descricao ?? null,
    atividade: e.atividade_principal?.descricao ?? null,
    cnae: e.atividade_principal?.id ? formatarCnae(e.atividade_principal.id) : null,
    cnaes_secundarios: (e.atividades_secundarias ?? []).slice(0, 8)
      .map((c) => ({ cnae: formatarCnae(c.id), descricao: c.descricao })),
    natureza_juridica: j.natureza_juridica?.descricao ?? null,
    cep: soDigitos(e.cep) || null,
    municipio: e.cidade?.nome ?? null,
    uf: e.estado?.sigla ?? null,
    telefones: telefonesReceita(`${e.ddd1 ?? ''}${e.telefone1 ?? ''}`, `${e.ddd2 ?? ''}${e.telefone2 ?? ''}`),
    email: emailReceita(e.email),
    socios: (j.socios ?? []).map((s) => ({
      nome: s.nome, cargo: s.qualificacao_socio?.descricao?.trim(),
      desde: s.data_entrada ?? null, faixa_etaria: s.faixa_etaria || null,
    })),
  };
};

/** Consulta a Receita. Devolve os dados normalizados ou null (CNPJ inexistente ou as duas APIs fora). */
export async function consultarCnpj(cnpj) {
  const c = soDigitos(cnpj);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, { headers: UA });
    if (r.ok) return doBrasilApi(await r.json());
    if (r.status === 404) return null;
  } catch { /* cai na reserva */ }

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${c}`, { headers: UA }).catch(() => null);
    if (r?.ok) return doCnpjWs(await r.json());
    if (r?.status === 429) { await espera(61_000); continue; }   // estourou os 3 por minuto
    return null;
  }
  return null;
}

/** O decisor: o sócio-administrador; sem ele, o primeiro sócio. */
export function decisor(dados) {
  const s = dados?.socios ?? [];
  return (s.find((x) => /administrador/i.test(x.cargo ?? '')) ?? s[0])?.nome ?? null;
}

/**
 * O CNPJ achado na pesquisa é mesmo desta empresa? O CEP do Maps manda (5 primeiros dígitos: o sufixo
 * varia entre prédio e rua). Sem CEP no endereço do Maps, vale o município com o número da rua.
 */
export function mesmoEndereco(lead, dados) {
  const cepMaps = soDigitos(lead.endereco?.match(/\d{5}-?\d{3}/)?.[0]);
  if (cepMaps && dados.cep) return cepMaps.slice(0, 5) === dados.cep.slice(0, 5);
  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return Boolean(dados.municipio) && semAcento(lead.endereco).includes(semAcento(dados.municipio));
}
