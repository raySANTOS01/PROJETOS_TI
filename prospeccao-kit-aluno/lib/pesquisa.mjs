// Pesquisa no Google do que o Maps e o site não trouxeram: o site de quem não divulgou, o Instagram,
// o LinkedIn e o CNPJ. Dois caminhos, o mesmo resultado (a primeira página do Google):
//   • Serper (google.serper.dev) — 2.500 buscas grátis ao criar a conta, e responde em menos de 1 s.
//     Tem SERPER_API_KEY no .env.local → é ele.
//   • Apify · Google Search Scraper (apify~google-search-scraper) — só o APIFY_TOKEN, US$ 0,0045 por
//     busca. Cada execução leva uns 20 s para subir, então as buscas vão em LOTE (preBuscar) e os
//     leads rodam em paralelo. É o caminho da aula (19/set/2026). Forçar: PESQUISA_GOOGLE=serper|apify.
//
// As sequências de busca vieram de agentes de IA que faziam este trabalho num fluxo do n8n. Aqui elas
// rodam sem agente: termos fixos, na ordem, e uma regra lendo os resultados. Sai mais barato (a mesma busca
// é reaproveitada entre site, Instagram e CNPJ) e não inventa link, porque só aceita URL que veio do Google.
// Achado da pesquisa é pista até ser conferido: site pelo telefone, Instagram pelo Apify, CNPJ pelo CEP.
import { env, exigir } from './env.mjs';

const ENDPOINT = 'https://google.serper.dev/search';

/** Qual caminho pesquisa no Google: o que o .env.local mandar, senão o Serper se tiver a chave, senão o Apify. */
export function motorPesquisa() {
  const forcado = String(env.PESQUISA_GOOGLE ?? '').toLowerCase();
  if (forcado === 'serper' || forcado === 'apify') return forcado;
  if (env.SERPER_API_KEY) return 'serper';
  if (env.APIFY_TOKEN) return 'apify';
  return null;
}

// Resultado de busca já feita nesta execução, entre leads e entre comandos (o rodar chama pesquisar e cnpj).
const cacheGlobal = new Map();

/** Várias buscas numa execução só do Apify. Devolve nada: guarda no cache, que a sessão lê. */
async function googleApify(termos) {
  const r = await fetch(
    `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: termos.join('\n'), countryCode: 'br', languageCode: 'pt-BR', maxPagesPerQuery: 1 }),
    },
  );
  if (!r.ok) {
    if (r.status === 401) throw new Error('APIFY_TOKEN inválido (401). Pegue de novo em console.apify.com/settings/integrations');
    if (r.status === 402) throw new Error('Crédito do Apify acabou (402). O plano gratuito renova todo mês.');
    throw new Error(`Apify pesquisa ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const paginas = await r.json();
  for (const p of paginas) {
    const termo = String(p.searchQuery?.term ?? '').replace(/\s+/g, ' ').trim();
    const itens = (p.organicResults ?? []).map((o) => ({ titulo: o.title ?? '', link: o.url ?? '', trecho: o.description ?? '' }));
    cacheGlobal.set(termo, itens);
  }
  // termo que o Apify não devolveu (sem resultado) vira lista vazia: não repete a busca
  for (const t of termos) if (!cacheGlobal.has(t)) cacheGlobal.set(t, []);
}

/** Adianta num lote só as buscas que quase todo lead vai precisar. No Serper não faz nada (ele é rápido). */
export async function preBuscar(termos) {
  if (motorPesquisa() !== 'apify') return;
  const faltam = [...new Set(termos.map((q) => q.replace(/\s+/g, ' ').trim()))].filter((q) => q && !cacheGlobal.has(q));
  for (let i = 0; i < faltam.length; i += 50) await googleApify(faltam.slice(i, i + 50));
}

// Teto por lead: três buscas com formatos diferentes para cada coisa
// procurada; não achou na terceira, é "não encontrado". Cada busca é um crédito do Serper (ou uma página do Apify).
export const TENTATIVAS = 3;

export const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

const GENERICAS = new Set(['clinica', 'clinicas', 'odontologia', 'odontologica', 'odonto', 'consultorio', 'dentista',
  'dr', 'dra', 'centro', 'energia', 'solar', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'ltda', 'me', 'the']);

/** As palavras que identificam a marca: "Clínica OSPE" → ["ospe"]. Sem palavra própria, fica o nome inteiro. */
export function marca(nome) {
  const partes = normal(nome).split(' ').filter((p) => p.length > 2 && !GENERICAS.has(p));
  return partes.length ? partes : normal(nome).split(' ').filter((p) => p.length > 2);
}

/** Onde o Google mostra a empresa mas não é dela: rede social, diretório, marketplace, cadastro de CNPJ. */
const NAO_E_SITE = [
  'instagram.com', 'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com', 'linkedin.com',
  'wa.me', 'whatsapp.com', 'google.com', 'goo.gl', 'g.page', 'waze.com', 'tripadvisor', 'ifood.com.br', 'rappi',
  'ubereats', 'apontador.com.br', 'yelp', 'guiamais.com.br', 'telelistas', 'solutudo', 'doctoralia', 'boaconsulta',
  'reclameaqui', 'cnpj.biz', 'casadosdados', 'econodata', 'empresaqui', 'cnpja', 'cnpj.ws', 'consultasocio',
  'jusbrasil', 'escavador', 'wikipedia', 'mercadolivre', 'olx.com.br', 'gov.br', 'infobel', 'cylex', 'hotfrog',
  'encontra', 'listamais', 'kekanto', 'foursquare', 'glassdoor', 'indeed', 'catho', 'infojobs',
];
const AGREGADOR = ['linktr.ee', 'linkin.bio', 'bio.site', 'beacons.ai', 'taplink', 'campsite.bio', 'linkr.bio', 'bio.link'];
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/**
 * Uma sessão de pesquisa por lead: guarda cada termo já buscado, porque "[nome] [endereço]" serve ao
 * site, ao Instagram e ao CNPJ. Conta as buscas (cada uma é um crédito do Serper) e registra o caminho.
 */
export function sessao(lead) {
  const cache = new Map();
  const log = { buscas: 0, termos: [], achados: {}, descartes: [] };
  return {
    log,
    async buscar(q) {
      q = q.replace(/\s+/g, ' ').trim();
      if (cache.has(q)) return cache.get(q);
      const motor = motorPesquisa();
      if (!motor) throw new Error('Falta a chave da pesquisa no Google: APIFY_TOKEN ou SERPER_API_KEY no .env.local');
      if (motor === 'apify') {
        exigir('APIFY_TOKEN');
        if (!cacheGlobal.has(q)) await googleApify([q]);
        const itens = cacheGlobal.get(q);
        log.buscas++; log.termos.push(q);
        cache.set(q, itens);
        return itens;
      }
      exigir('SERPER_API_KEY');
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'X-API-KEY': env.SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', location: 'Brazil' }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) throw new Error('SERPER_API_KEY inválida (401/403): copie de novo em serper.dev/api-key');
      if (!r.ok) throw new Error(`Serper ${r.status}: ${corpo.message ?? 'sem detalhe'}${/credit/i.test(corpo.message ?? '') ? ' (créditos acabaram)' : ''}`);
      const itens = (corpo.organic ?? []).map((o) => ({ titulo: o.title ?? '', link: o.link ?? '', trecho: o.snippet ?? '' }));
      log.buscas++; log.termos.push(q);
      cache.set(q, itens);
      return itens;
    },
  };
}

const nomeDe = (lead) => lead.nome_empresa ?? lead.nome;

/** A primeira tentativa de cada coisa procurada: é o que o preBuscar adianta em lote. */
export const primeiraBusca = {
  site: (lead) => `${nomeDe(lead)} ${lead.endereco ?? lead.cidade ?? ''}`,     // serve também ao Instagram
  linkedin: (lead) => `LinkedIn ${nomeDe(lead)} ${lead.cidade ?? ''}`,
};

/**
 * O site próprio de quem não divulgou no Maps. Três tentativas, da mais precisa à mais ampla.
 * Devolve { site } (candidato a conferir pelo telefone) e/ou { agregador } (linktree: não é site, mas traz o @).
 */
export async function procurarSite(lead, s) {
  const nome = nomeDe(lead), cidade = lead.cidade ?? '';
  const tentativas = [
    `${nome} ${lead.endereco ?? cidade}`,
    `${nome} ${cidade} site oficial`,
    `${nome} linktree OR linktr.ee OR beacons.ai OR taplink`,
  ].slice(0, TENTATIVAS);
  const tokens = marca(nome);
  let agregador = null;
  for (const q of tentativas) {
    for (const it of await s.buscar(q)) {
      const h = host(it.link);
      if (!h) continue;
      if (AGREGADOR.some((a) => h.includes(a))) { agregador ??= it.link; continue; }
      if (NAO_E_SITE.some((d) => h.includes(d))) continue;
      // o domínio ou o título tem que carregar a marca: "Clínica OSPE" num blog de saúde não é o site dela
      const alvo = normal(`${h.replace(/\./g, ' ')} ${it.titulo}`);
      const hostColado = h.replace(/[^a-z0-9]/g, '');
      if (tokens.some((t) => hostColado.includes(t)) || tokens.every((t) => alvo.includes(t))) {
        return { site: `https://${h}`, agregador };
      }
    }
  }
  return { site: null, agregador };
}

/** "…(@clinbelo) · Belo Horizonte" ou instagram.com/clinbelo/ → "clinbelo". Post e reel viram o @ do dono. */
function usuariosDoResultado(it) {
  const fora = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'direct', 'popular']);
  const achados = [];
  const doLink = it.link.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})\/?(?:$|\?)/i)?.[1];
  if (doLink && !fora.has(doLink.toLowerCase())) achados.push(doLink.toLowerCase());
  for (const m of `${it.titulo} ${it.trecho}`.matchAll(/\(@([A-Za-z0-9_.]{2,30})\)|@([A-Za-z0-9_.]{3,30})/g)) {
    const u = (m[1] ?? m[2]).replace(/\.$/, '').toLowerCase();
    if (!fora.has(u) && !achados.includes(u)) achados.push(u);
  }
  return achados;
}

/**
 * O Instagram oficial. 3 tentativas, com o fallback do reel: quando só
 * aparece post ou reel, o @ vem do título do resultado. Escolhe o @ que carrega a marca; o Apify confere depois.
 */
export async function procurarInstagram(lead, s) {
  const nome = nomeDe(lead), cidade = normal(lead.cidade);
  const tentativas = [
    `${nome} ${lead.endereco ?? lead.cidade ?? ''}`,
    `site:instagram.com ${nome} ${lead.cidade ?? ''}`,
    `instagram ${nome} ${lead.endereco ?? lead.cidade ?? ''}`,
  ].slice(0, TENTATIVAS);
  const tokens = marca(nome);
  const pontos = new Map();
  for (const q of tentativas) {
    for (const it of await s.buscar(q)) {
      const ehInsta = /instagram\.com/i.test(it.link);
      for (const u of usuariosDoResultado(it)) {
        if (!ehInsta && !it.titulo.includes(`@${u}`)) continue;   // @ solto em site qualquer não serve
        const texto = normal(`${it.titulo} ${it.trecho}`);
        let p = 0;
        if (tokens.some((t) => u.replace(/[._]/g, '').includes(t))) p += 2;
        if (tokens.every((t) => texto.includes(t))) p += 2;
        if (cidade && texto.includes(cidade)) p += 1;
        pontos.set(u, Math.max(pontos.get(u) ?? 0, p));
      }
    }
    const melhor = [...pontos].sort((a, b) => b[1] - a[1])[0];
    if (melhor && melhor[1] >= 4) return `https://www.instagram.com/${melhor[0]}/`;   // marca no @ e no título: para de buscar
  }
  const melhor = [...pontos].sort((a, b) => b[1] - a[1])[0];
  return melhor && melhor[1] >= 2 ? `https://www.instagram.com/${melhor[0]}/` : null;
}

/** A página de empresa no LinkedIn (/company/, nunca perfil pessoal ou vaga). 2 tentativas. */
export async function procurarLinkedin(lead, s) {
  const nome = nomeDe(lead);
  const tentativas = [`LinkedIn ${nome} ${lead.cidade ?? ''}`, `site:linkedin.com/company "${nome}"`].slice(0, TENTATIVAS);
  const tokens = marca(nome);
  for (const q of tentativas) {
    for (const it of await s.buscar(q)) {
      const m = it.link.match(/^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/([^/?#]+)/i);
      if (!m) continue;
      const alvo = normal(`${decodeURIComponent(m[1]).replace(/-/g, ' ')} ${it.titulo}`);
      if (tokens.every((t) => alvo.includes(t))) return `https://www.linkedin.com/company/${m[1]}/`;
    }
  }
  return null;
}

/**
 * O CNPJ pelos números que aparecem nos resultados. 3 tentativas.
 * `confere(cnpj)` consulta a Receita e devolve os dados só se o CEP bater com o do Maps.
 * Só passa para a próxima tentativa se nenhum número desta bateu: em 18/set/2026, parar na primeira
 * busca que trazia qualquer número deixou 20 clínicas sem CNPJ (os 3 números eram de homônimas).
 * Devolve { dados, testados }: dados da Receita ou null, e quantos números foram conferidos.
 */
/** As buscas de CNPJ de um lead, na ordem. O comando `cnpj` adianta as três em lote no Apify: a fila é em
 * série (a reserva da Receita aceita 3 por minuto) e cada busca avulsa custaria ~20 s de espera. */
export function tentativasCnpj(lead) {
  const nome = nomeDe(lead), cidade = lead.cidade ?? '';
  return [`CNPJ ${nome} ${cidade}`, `CNPJ ${nome} ${cidade} Receita Federal`, `${nome} ${lead.endereco ?? cidade}`].slice(0, TENTATIVAS);
}

export async function acharCnpj(lead, s, valido, confere) {
  const tentativas = tentativasCnpj(lead);
  const vistos = new Set();
  for (const q of tentativas) {
    const novos = [];
    for (const it of await s.buscar(q)) {
      for (const m of `${it.titulo} ${it.trecho} ${it.link}`.matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)) {
        const c = m[0].replace(/\D/g, '');
        if (valido(c) && !vistos.has(c)) { vistos.add(c); novos.push(c); }
      }
    }
    for (const c of novos.slice(0, 4)) {
      const dados = await confere(c);
      if (dados) return { dados, testados: vistos.size };
    }
  }
  return { dados: null, testados: vistos.size };
}

/** Telefone do site bate com o do Maps? Os 8 últimos dígitos bastam (DDD e o 9 variam na escrita). */
export function mesmoTelefone(lead, dados) {
  const fim = (t) => String(t ?? '').replace(/\D/g, '').slice(-8);
  const doMaps = fim(lead.telefone_google);
  if (!doMaps) return false;
  return [...(dados.telefones_site ?? []), dados.whatsapp].some((t) => t && fim(t) === doMaps);
}

/** O perfil que o Apify leu é mesmo da empresa? Para o @ que veio da pesquisa, não do site. */
export function perfilBate(perfil, lead) {
  if (!perfil) return false;
  const tokens = marca(nomeDe(lead));
  const texto = normal(`${perfil.usuario} ${perfil.nome} ${perfil.bio} ${perfil.link_bio}`);
  const usuario = String(perfil.usuario ?? '').toLowerCase().replace(/[._]/g, '');
  const dominio = host(lead.site_url_final ?? lead.site ?? '');
  if (tokens.some((t) => usuario.includes(t)) || tokens.every((t) => texto.includes(t))) return true;
  if (dominio && String(perfil.link_bio ?? '').includes(dominio)) return true;
  const fim = String(lead.telefone_google ?? '').replace(/\D/g, '').slice(-8);
  return Boolean(fim && String(perfil.bio ?? '').replace(/\D/g, '').includes(fim));
}
