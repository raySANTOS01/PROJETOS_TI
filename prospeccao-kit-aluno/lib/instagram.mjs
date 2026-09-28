// O Instagram da empresa, pelo Apify: seguidores, posts, se está ativo e o que ela anda postando.
// Empresa com um milhão de seguidores já tem quem cuide; perfil parado há três meses é argumento pronto.
//
// Ator: apify/instagram-profile-scraper — US$ 2,60 a cada mil perfis no plano gratuito, que dá US$ 5
// por mês (~1.900 perfis). Uma chamada leva o lote inteiro: 10 perfis custam uma execução só.
// O @ vem do link que o próprio site da empresa publica (lib/site.mjs); quem não tem site fica sem.
import { env, exigir } from './env.mjs';

const ATOR = 'apify~instagram-profile-scraper';
const DIA = 86_400_000;

/** "https://www.instagram.com/clinica.ospe/?hl=pt" → "clinica.ospe". Link de post, reel ou explorar não é perfil. */
export function usuarioDoLink(link) {
  const m = String(link ?? '').match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i);
  if (!m) return null;
  const u = m[1].toLowerCase();
  return ['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'direct'].includes(u) ? null : u;
}

/** Roda o ator com o lote e devolve os perfis crus, na ordem em que o Apify devolver. */
export async function consultarPerfis(usuarios) {
  exigir('APIFY_TOKEN');
  if (!usuarios.length) return [];
  // run-sync espera a execução terminar (até 5 min) e já devolve os itens do dataset
  const r = await fetch(
    `https://api.apify.com/v2/acts/${ATOR}/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: usuarios }) },
  );
  if (!r.ok) {
    const corpo = (await r.text()).slice(0, 200);
    if (r.status === 401) throw new Error('APIFY_TOKEN inválido (401). Pegue de novo em console.apify.com/settings/integrations');
    if (r.status === 402) throw new Error('Crédito do Apify acabou (402). O plano gratuito renova todo mês.');
    throw new Error(`Apify ${r.status}: ${corpo}`);
  }
  return r.json();
}

/** O perfil cru vira o que a prospecção usa. `null` se o perfil não existe ou é privado. */
export function resumirPerfil(p, agora = Date.now()) {
  if (!p || p.error || p.followersCount == null) return null;
  const posts = (p.latestPosts ?? []).filter((x) => x.timestamp).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const ultimo = posts[0]?.timestamp ?? null;
  // curtida escondida pelo dono vem como -1: fora da média
  const media = (campo) => { const v = posts.map((x) => x[campo]).filter((n) => n >= 0); return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : null; };
  return {
    usuario: p.username,
    nome: cortar(p.fullName, 200) || null,
    seguidores: p.followersCount,
    seguindo: p.followsCount ?? null,
    posts: p.postsCount ?? null,
    verificado: Boolean(p.verified),
    comercial: Boolean(p.isBusinessAccount),
    categoria: p.businessCategoryName || null,
    bio: cortar(p.biography, 500) || null,
    link_bio: p.externalUrl || null,
    ultimo_post: ultimo,
    dias_sem_postar: ultimo ? Math.floor((agora - Date.parse(ultimo)) / DIA) : null,
    posts_30_dias: posts.filter((x) => agora - Date.parse(x.timestamp) <= 30 * DIA).length,
    media_curtidas: media('likesCount'),
    media_comentarios: media('commentsCount'),
    legendas: posts.slice(0, 6).map((x) => ({ data: x.timestamp.slice(0, 10), tipo: x.type ?? null, texto: cortar(x.caption, 300) })),
  };
}

// Corta por caractere, não por unidade de código: slice(0, 300) no meio de um emoji deixa meio par
// (surrogate solto), e o Postgres recusa o jsonb inteiro — "invalid input syntax for type json" (18/set/2026).
const SOLTO = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]|\x00/g;
const cortar = (t, n) => Array.from(String(t ?? '').replace(SOLTO, '')).slice(0, n).join('');

const mil = (n) => {
  const virgula = (v, casas) => v.toFixed(casas).replace('.', ',').replace(/,0$/, '');
  if (n >= 1_000_000) return `${virgula(n / 1_000_000, 1)} ${n >= 2_000_000 ? 'milhões' : 'milhão'} de`;
  return n >= 1000 ? `${virgula(n / 1000, n >= 10_000 ? 0 : 1)} mil` : String(n);
};

/** Em português, sem IA: "2,3 mil seguidores, 412 posts. Último post há 94 dias: perfil parado." */
export function justificarInstagram(r) {
  if (!r) return null;
  let t = `${mil(r.seguidores)} seguidores, ${r.posts ?? '?'} posts.`;
  if (r.dias_sem_postar == null) t += ' Nenhum post visível.';
  else if (r.dias_sem_postar > 30) t += ` Último post há ${r.dias_sem_postar} dias: perfil parado.`;
  else t += ` ${r.posts_30_dias} post${r.posts_30_dias === 1 ? '' : 's'} nos últimos 30 dias.`;
  if (r.media_curtidas != null && r.seguidores > 0) {
    const engaj = ((r.media_curtidas + (r.media_comentarios ?? 0)) / r.seguidores) * 100;
    t += ` Média de ${r.media_curtidas} curtidas por post (${engaj.toFixed(1).replace('.', ',')}% de engajamento).`;
  }
  if (!r.link_bio) t += ' Sem link na bio.';
  return t;
}

// Os ganchos de abordagem são da IA da conversa, pelo comando `ia` (lib/ia.mjs): esta é a regra que ela recebe.
export const REGRA_ABORDAGEM = `Você prepara um vendedor para abordar uma empresa pequena. Cada item traz os números do Instagram dela e as últimas legendas.
Preencha resposta.leitura (o que o perfil mostra, em até 25 palavras) e resposta.ideias (3 ganchos).
Cada gancho é uma frase curta que o vendedor pode dizer na primeira conversa, baseada em algo CONCRETO do perfil
(um post, a frequência, a falta de link, o tipo de conteúdo). Não invente fato que não está nos dados. Não prometa resultado.`;
