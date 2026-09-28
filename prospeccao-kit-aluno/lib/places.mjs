// Achar as empresas no Maps. Dois caminhos, a mesma saída:
//   • Google Places API (New) — Text Search, até 60 por termo. 1.000 buscas grátis por mês, mas pede
//     cartão no Google Cloud. Tem GOOGLE_PLACES_API_KEY no .env.local → é ele.
//   • Apify · Google Maps Scraper (compass~crawler-google-places) — só o APIFY_TOKEN, sem cartão.
//     US$ 0,004 por empresa, dentro dos US$ 5 grátis do mês. É o caminho da aula (19/set/2026):
//     uma conta só faz o Maps, a pesquisa no Google e o Instagram.
// O Apify devolve o mesmo place id do Google ("ChIJ…"): a mesma empresa não entra duas vezes,
// venha de um caminho ou do outro. Forçar um deles: BUSCA_EMPRESAS=google|apify no .env.local.
import { env, exigir } from './env.mjs';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const CAMPOS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents',
  'places.primaryTypeDisplayName', 'places.location', 'places.nationalPhoneNumber',
  'places.rating', 'places.userRatingCount', 'places.websiteUri',
  'places.googleMapsUri', 'places.businessStatus',
].join(',');

/** Domínios que aparecem como "site" no Maps mas são rede social/agregador — não contam como site próprio. */
const NAO_E_SITE = [
  'wa.me', 'api.whatsapp.com', 'whatsapp.com', 'instagram.com', 'facebook.com', 'fb.me',
  'linktr.ee', 'linkr.bio', 'bio.link', 'beacons.ai', 'linkedin.com', 'youtube.com',
  't.me', 'twitter.com', 'x.com', 'tiktok.com', 'business.site', 'negocio.site',
];

export function classificarUrl(url) {
  if (!url) return { tipo: 'ausente' };
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return { tipo: 'invalido' }; }
  const social = NAO_E_SITE.find((d) => host === d || host.endsWith('.' + d));
  if (social) return { tipo: 'social', dominio: social };
  return { tipo: 'site', dominio: host };
}

/** Telefone brasileiro em E.164 (5521987654321). Devolve null se não der pra normalizar. */
export function normalizarTelefone(bruto) {
  if (!bruto) return null;
  let d = String(bruto).replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (!d.startsWith('55')) d = '55' + d;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

function extrairLocalidade(componentes = []) {
  const achar = (tipo) => componentes.find((c) => (c.types || []).includes(tipo));
  const cidade = achar('administrative_area_level_2') || achar('locality');
  const uf = achar('administrative_area_level_1');
  return { cidade: cidade?.longText ?? null, uf: uf?.shortText ?? null };
}

async function umaPagina(textQuery, pageToken) {
  const resposta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': CAMPOS + ',nextPageToken',
    },
    body: JSON.stringify({
      textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  const json = await resposta.json();
  if (!resposta.ok) {
    throw new Error(`Places HTTP ${resposta.status}: ${json?.error?.message ?? 'erro desconhecido'}`);
  }
  return json;
}

/** Qual caminho acha as empresas: o que o .env.local mandar, senão o Places se tiver a chave, senão o Apify. */
export function motorBusca() {
  const forcado = String(env.BUSCA_EMPRESAS ?? '').toLowerCase();
  if (forcado === 'google' || forcado === 'apify') return forcado;
  if (env.GOOGLE_PLACES_API_KEY) return 'google';
  if (env.APIFY_TOKEN) return 'apify';
  return null;
}

/** O lugar do Apify no formato do Places, para o normalizarLugar servir aos dois. */
function doApify(p) {
  const uf = String(p.address ?? '').match(/ - ([A-Z]{2}),/)?.[1] ?? null;
  const status = p.permanentlyClosed ? 'CLOSED_PERMANENTLY' : p.temporarilyClosed ? 'CLOSED_TEMPORARILY' : 'OPERATIONAL';
  return {
    id: p.placeId,
    displayName: { text: p.title },
    formattedAddress: p.address,
    addressComponents: [
      ...(p.city ? [{ types: ['administrative_area_level_2'], longText: p.city }] : []),
      ...(uf ? [{ types: ['administrative_area_level_1'], shortText: uf }] : []),
    ],
    primaryTypeDisplayName: { text: p.categoryName },
    location: p.location ? { latitude: p.location.lat, longitude: p.location.lng } : null,
    nationalPhoneNumber: p.phoneUnformatted ?? p.phone,
    rating: p.totalScore,
    userRatingCount: p.reviewsCount,
    websiteUri: p.website,
    googleMapsUri: p.url,
    businessStatus: status,
  };
}

async function buscarApify(textQuery, maximo) {
  const r = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // só a lista: sem foto, sem avaliação e sem página de detalhe, que cobram à parte
      body: JSON.stringify({ searchStringsArray: [textQuery], maxCrawledPlacesPerSearch: maximo, language: 'pt-BR',
        countryCode: 'br', maxImages: 0, maxReviews: 0, scrapeContacts: false }),
    },
  );
  if (!r.ok) {
    if (r.status === 401) throw new Error('APIFY_TOKEN inválido (401). Pegue de novo em console.apify.com/settings/integrations');
    if (r.status === 402) throw new Error('Crédito do Apify acabou (402). O plano gratuito renova todo mês.');
    throw new Error(`Apify Maps ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  return (await r.json()).filter((p) => p.placeId).map(doApify);
}

/**
 * Busca um termo e pagina até o teto do Google (60 por termo).
 * É por isso que o nicho tem vários termos: cada um rende sua própria fatia de 60.
 */
export async function buscar(textQuery, { maxPaginas = 3, maximo } = {}) {
  // A chave é exigida AQUI, e não no topo do módulo: no topo ela derruba até `listar` e a tela
  // de ajuda com stack trace, porque o import roda antes do try/catch da CLI.
  const motor = motorBusca();
  if (!motor) throw new Error('Falta a chave para achar as empresas: APIFY_TOKEN (o caminho mais simples) ou GOOGLE_PLACES_API_KEY no .env.local');
  if (motor === 'apify') { exigir('APIFY_TOKEN'); return buscarApify(textQuery, Math.min(maxPaginas * 20, maximo ?? 60)); }   // o Apify cobra por empresa: não traz mais que o pedido
  exigir('GOOGLE_PLACES_API_KEY');
  const lugares = [];
  let token;
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const json = await umaPagina(textQuery, token);
    lugares.push(...(json.places ?? []));
    token = json.nextPageToken;
    if (!token) break;
    await new Promise((r) => setTimeout(r, 1200)); // o token leva um instante pra valer
  }
  return lugares;
}

export function normalizarLugar(lugar, { nicho, praca, termo_busca }) {
  const { cidade, uf } = extrairLocalidade(lugar.addressComponents);
  const url = classificarUrl(lugar.websiteUri);
  return {
    google_id: lugar.id,
    nicho, praca, termo_busca,
    nome: lugar.displayName?.text ?? null,
    categoria: lugar.primaryTypeDisplayName?.text ?? null,
    endereco: lugar.formattedAddress ?? null,
    cidade, uf,
    lat: lugar.location?.latitude ?? null,
    lng: lugar.location?.longitude ?? null,
    google_maps_url: lugar.googleMapsUri ?? null,
    avaliacao: lugar.rating ?? null,
    total_avaliacoes: lugar.userRatingCount ?? null,
    telefone_google: normalizarTelefone(lugar.nationalPhoneNumber),
    // link social cadastrado como site não vira site: vira pista, e o campo fica vazio
    site: url.tipo === 'site' ? lugar.websiteUri : null,
    _url_social: url.tipo === 'social' ? lugar.websiteUri : null,
    _encerrado: lugar.businessStatus && lugar.businessStatus !== 'OPERATIONAL',
  };
}
