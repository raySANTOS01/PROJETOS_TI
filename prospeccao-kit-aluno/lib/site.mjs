// Enriquecimento pelo site da empresa. Substitui Serper + Firecrawl + parte da IA:
// buscar e-mail, telefone, redes e CNPJ é trabalho de regex, não de LLM.
import { normalizarTelefone } from './places.mjs';
import { sinaisMarketing } from './marketing.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TIMEOUT_MS = 12000;
const PAGINAS_INTERNAS = ['contato', 'fale-conosco', 'sobre', 'quem-somos', 'institucional'];
// Para o raio-x: quem atende e o que a empresa faz. Em clínica é onde mora "nossa equipe: 5 dentistas".
const PAGINAS_RAIO_X = ['equipe', 'corpo-clinico', 'profissionais', 'especialistas', 'especialidades', 'tratamentos', 'servicos', 'procedimentos'];
const TEXTO_POR_PAGINA = 3500;

/** E-mails que não são contato de gente: rastreadores, placeholders, arquivos. */
const EMAIL_LIXO = /(sentry|wixpress|example|seuemail|email@|@example|@sentry|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|@2x|@3x)/i;

async function baixar(url) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: controle.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    const tipo = r.headers.get('content-type') ?? '';
    const html = tipo.includes('text/') || tipo.includes('html') ? await r.text() : '';
    return { status: r.status, url_final: r.url, html };
  } finally {
    clearTimeout(timer);
  }
}

/** Tenta https e http; site que só responde num deles ainda é site vivo. */
async function alcancar(site) {
  const candidatos = /^https?:\/\//i.test(site)
    ? [site, site.replace(/^http:/i, 'https:'), site.replace(/^https:/i, 'http:')]
    : [`https://${site}`, `http://${site}`];
  let ultimoErro;
  for (const url of [...new Set(candidatos)]) {
    try {
      const r = await baixar(url);
      if (r.status < 400) return r;
      ultimoErro = `HTTP ${r.status}`;
    } catch (e) {
      ultimoErro = e.name === 'AbortError' ? 'timeout (12s)' : e.message;
    }
  }
  return { status: null, url_final: null, html: '', erro: ultimoErro };
}

export function paraTexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairDoHtml(html) {
  const texto = paraTexto(html);
  const achado = {
    emails: new Set(), telefones: new Set(), whatsapp: null,
    instagram: null, facebook: null, linkedin: null, youtube: null, cnpj: null,
  };

  // e-mails: mailto: primeiro (mais confiável), depois texto solto
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) achado.emails.add(m[1].toLowerCase());
  for (const m of texto.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) achado.emails.add(m[0].toLowerCase());

  // WhatsApp: o número no link vale mais que o do rodapé
  const wa = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|web\.whatsapp\.com\/send\?phone=)(\d{10,15})/i);
  if (wa) achado.whatsapp = normalizarTelefone(wa[1]);

  // telefones no texto: (21) 99999-9999 / 21 3333-4444 / +55 21 ...
  for (const m of texto.matchAll(/(?:\+?55\s*)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g)) {
    const t = normalizarTelefone(m[0]);
    if (t) achado.telefones.add(t);
  }

  const rede = (regex) => { const m = html.match(regex); return m ? m[0].replace(/^\/\//, 'https://') : null; };
  achado.instagram = rede(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]{2,30}/i);
  achado.facebook  = rede(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-]{2,60}/i);
  achado.linkedin  = rede(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.\-%]{2,60}/i);
  achado.youtube   = rede(/https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)[A-Za-z0-9_.\-]{2,60}/i);

  const cnpj = texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (cnpj) achado.cnpj = cnpj[0].replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

  const titulo = html.match(/<title[^>]*>([\s\S]{1,200}?)<\/title>/i);
  return { achado, texto, titulo: titulo ? paraTexto(titulo[1]).slice(0, 180) : null };
}

function juntarLinks(html, baseUrl, paginas, maximo) {
  const links = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const alvo = m[1];
    if (!paginas.some((p) => alvo.toLowerCase().includes(p))) continue;
    try {
      const u = new URL(alvo, baseUrl);
      if (u.hostname === new URL(baseUrl).hostname && u.href.replace(/\/$/, '') !== baseUrl.replace(/\/$/, '')) links.add(u.href);
    } catch { /* href quebrado, ignora */ }
  }
  return [...links].slice(0, maximo);
}

/** "https://x.com.br/nossa-equipe/" -> "nossa-equipe": o rótulo do trecho no texto que a IA lê. */
const rotuloPagina = (url) => { try { return new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'página'; } catch { return 'página'; } };

/**
 * Visita o site (e até 2 páginas internas) e devolve tudo que der pra provar.
 * Nunca joga exceção: site fora do ar é um resultado, não uma falha do lote.
 */
export async function enriquecerSite(site) {
  const principal = await alcancar(site);
  if (!principal.html) {
    return {
      site_status: principal.status, site_url_final: principal.url_final,
      site_vivo: false, site_erro: principal.erro ?? `sem conteúdo (HTTP ${principal.status})`,
      emails: [], telefones_site: [], whatsapp: null, instagram: null,
      facebook: null, linkedin: null, youtube: null, cnpj: null, site_titulo: null, texto: '',
      marketing: null,
    };
  }

  const base = extrairDoHtml(principal.html);
  const combinado = {
    emails: new Set(base.achado.emails), telefones: new Set(base.achado.telefones),
    whatsapp: base.achado.whatsapp, instagram: base.achado.instagram,
    facebook: base.achado.facebook, linkedin: base.achado.linkedin,
    youtube: base.achado.youtube, cnpj: base.achado.cnpj,
  };
  // cada página entra com o nome dela e com teto próprio: a home longa não empurra a página da equipe para fora
  let texto = `[início] ${base.texto.slice(0, TEXTO_POR_PAGINA)}`;

  // até 2 páginas de contato (o e-mail costuma estar em /contato) e até 2 do raio-x (equipe, serviços)
  const internas = [
    ...juntarLinks(principal.html, principal.url_final, PAGINAS_INTERNAS, 2),
    ...juntarLinks(principal.html, principal.url_final, PAGINAS_RAIO_X, 2),
  ];
  for (const link of [...new Set(internas)]) {
    try {
      const interna = await baixar(link);
      if (!interna.html) continue;
      const extra = extrairDoHtml(interna.html);
      extra.achado.emails.forEach((e) => combinado.emails.add(e));
      extra.achado.telefones.forEach((t) => combinado.telefones.add(t));
      for (const campo of ['whatsapp', 'instagram', 'facebook', 'linkedin', 'youtube', 'cnpj']) {
        combinado[campo] ??= extra.achado[campo];
      }
      texto += ` [${rotuloPagina(link)}] ${extra.texto.slice(0, TEXTO_POR_PAGINA)}`;
    } catch { /* página interna é bônus; falhar nela não invalida o lead */ }
  }

  const emails = [...combinado.emails].filter((e) => !EMAIL_LIXO.test(e)).slice(0, 5);
  return {
    site_status: principal.status, site_url_final: principal.url_final, site_vivo: true,
    site_titulo: base.titulo, site_erro: null,
    emails, telefones_site: [...combinado.telefones].slice(0, 5),
    whatsapp: combinado.whatsapp, instagram: combinado.instagram,
    facebook: combinado.facebook, linkedin: combinado.linkedin,
    youtube: combinado.youtube, cnpj: combinado.cnpj,
    marketing: sinaisMarketing(principal.html),   // só a página inicial: é onde o pixel e o rodapé moram
    texto: texto.slice(0, 15000),   // 4 páginas × 3.500 + os rótulos
  };
}
