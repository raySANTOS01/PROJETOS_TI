// Anúncio ativo na Biblioteca de Anúncios da Meta, pelo Apify. É o sinal mais forte de que alguém já
// paga por marketing — mais que o pixel no site, que pode estar instalado e parado há dois anos.
//
// Ator: apify/facebook-ads-scraper — US$ 5,80 a cada mil anúncios no plano gratuito. Cobra por anúncio
// devolvido, então a busca pede no máximo POR_EMPRESA de cada uma: para dizer "anuncia", 5 bastam.
//
// 🔴 Por que a busca é pelo NOME, e não pela página do Facebook que o site divulga: a empresa muitas
// vezes anuncia com outra página (a do dono, a da agência, uma antiga) que não é a ligada ao Instagram.
// Buscar pela página vinculada diria "não anuncia" para quem anuncia. Buscar pelo nome acha essas, e o
// preço disso é achar também quem só CITA o nome — por isso cada anúncio passa pela conferência de
// `ehDaEmpresa` antes de contar.
import { env, exigir } from './env.mjs';

const ATOR = 'apify~facebook-ads-scraper';
export const POR_EMPRESA = 5;

export const urlBiblioteca = (nome) =>
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&media_type=all' +
  `&search_type=keyword_exact_phrase&q=${encodeURIComponent(`"${nome}"`)}`;

const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const GENERICAS = new Set(['clinica', 'odontologia', 'odontologica', 'consultorio', 'dr', 'dra', 'energia', 'solar', 'de', 'da', 'do', 'e', 'the']);

/** O anúncio é mesmo desta empresa? Página com a marca no nome, ou anúncio que leva ao site ou ao @ dela. */
export function ehDaEmpresa(anuncio, { empresa, dominio, usuarioInstagram }) {
  const s = anuncio.snapshot ?? {};
  const pagina = normal(s.pageName ?? anuncio.pageName);
  const marca = normal(empresa).split(' ').filter((p) => p.length > 2 && !GENERICAS.has(p));
  if (marca.length && marca.every((p) => pagina.includes(p))) return true;
  const links = [s.linkUrl, s.caption, ...(s.cards ?? []).flatMap((c) => [c.linkUrl, c.caption])].map((x) => String(x ?? '').toLowerCase()).join(' ');
  if (dominio && links.includes(dominio)) return true;
  return Boolean(usuarioInstagram && normal(pagina).replace(/ /g, '') === usuarioInstagram.replace(/[._]/g, ''));
}

/** Uma execução para o lote inteiro. Devolve os anúncios crus, cada um com `inputUrl` = a busca que o trouxe. */
export async function buscarAnuncios(nomes) {
  exigir('APIFY_TOKEN');
  if (!nomes.length) return [];
  const r = await fetch(
    `https://api.apify.com/v2/acts/${ATOR}/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls: nomes.map((n) => ({ url: urlBiblioteca(n) })), resultsLimit: POR_EMPRESA, activeStatus: 'active' }) },
  );
  if (!r.ok) {
    if (r.status === 401) throw new Error('APIFY_TOKEN inválido (401). Pegue de novo em console.apify.com/settings/integrations');
    if (r.status === 402) throw new Error('Crédito do Apify acabou (402). O plano gratuito renova todo mês.');
    throw new Error(`Apify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  return r.json();
}

/** Os anúncios de uma busca viram o que a prospecção guarda. */
export function resumirAnuncios(anuncios, alvo) {
  const validos = anuncios.filter((a) => a.adArchiveID || a.adArchiveId);
  const dela = validos.filter((a) => ehDaEmpresa(a, alvo));
  const outros = validos.filter((a) => !dela.includes(a));
  const inicio = dela.map((a) => a.startDateFormatted).filter(Boolean).sort()[0] ?? null;
  const texto = (a) => (a.snapshot?.cards?.[0]?.body ?? a.snapshot?.body?.text ?? '').slice(0, 240);
  return {
    ativos: dela.length,
    no_limite: dela.length >= POR_EMPRESA,
    paginas: [...new Set(dela.map((a) => a.snapshot?.pageName ?? a.pageName).filter(Boolean))],
    desde: inicio,
    plataformas: [...new Set(dela.flatMap((a) => a.publisherPlatform ?? []))],
    exemplos: dela.slice(0, 2).map((a) => ({ id: a.adArchiveID ?? a.adArchiveId, texto: texto(a) })),
    citada_por: [...new Set(outros.map((a) => a.snapshot?.pageName ?? a.pageName).filter(Boolean))].slice(0, 5),
  };
}

/** Em português, sem IA. */
export function justificarAnuncios(r, empresa) {
  if (!r) return null;
  if (!r.ativos) {
    return `Nenhum anúncio ativo com o nome "${empresa}" na Biblioteca da Meta.` +
      (r.citada_por.length ? ` O nome aparece em anúncio de outra página (${r.citada_por.join(', ')}), que não conta.` : '') +
      ' Pode anunciar com um nome bem diferente: confira antes de afirmar na abordagem.';
  }
  const qtd = r.no_limite ? `${POR_EMPRESA} ou mais anúncios ativos` : `${r.ativos} anúncio${r.ativos === 1 ? '' : 's'} ativo${r.ativos === 1 ? '' : 's'}`;
  const desde = r.desde ? `, rodando desde ${r.desde.slice(8, 10)}/${r.desde.slice(5, 7)}/${r.desde.slice(0, 4)}` : '';
  return `Anuncia agora: ${qtd} na Meta${desde}, pela página ${r.paginas.join(', ')}. Alguém já cuida do tráfego.`;
}
