import 'server-only';
import { query, one } from './db';

/**
 * Os leads da prospecção, lidos direto do schema `prospeccao` no seu Supabase: o que o
 * prospectar.mjs enriquecer amanhã aparece aqui sozinho. Este painel só lê; quem grava é a CLI.
 */

export type LeadProspeccao = {
  id: string;
  nicho: string;
  praca: string | null;
  termo_busca: string | null;
  nome: string | null;
  nome_empresa: string | null;
  nome_pessoa: string | null;
  categoria: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
  google_maps_url: string | null;
  avaliacao: string | null;
  total_avaliacoes: number | null;
  telefone_google: string | null;
  site: string | null;
  site_url_final: string | null;
  site_titulo: string | null;
  situacao_site: 'com_site' | 'sem_site' | 'site_morto' | null;
  /** O que a CLI leu no HTML do site: e o diagnostico que vira argumento de venda. */
  marketing: Marketing | null;
  emails: string[] | null;
  telefones_site: string[] | null;
  celular: string | null;
  whatsapp: string | null;
  instagram: string | null;
  /** "pesquisa" quando o @ veio da busca no Google, e nao do site. */
  instagram_origem: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  cnpj: string | null;
  /** "site" quando a empresa publica; "busca" quando veio da pesquisa no Google, conferido pelo CEP. */
  cnpj_origem: string | null;
  cnpj_nota: string | null;
  razao_social: string | null;
  decisor: string | null;
  receita: Record<string, unknown> | null;
  resumo_site: string | null;
  porte_estimado: string | null;
  score: number;
  /** Cada sinal da regua com os pontos que deu: { site_vivo: { tem, pontos }, ..., _total }. */
  sinais: Record<string, { tem: boolean; pontos: number; nota?: string } | number> | null;
  classificacao: string | null;
  oportunidade: 'alta' | 'media' | 'baixa' | null;
  aderente_nicho: boolean | null;
  motivo_nicho: string | null;
  requisitos_ok: boolean | null;
  motivo_requisitos: string | null;
  justificativa_nota: string | null;
  justificativa_oportunidade: string | null;
  instagram_perfil: PerfilInstagram | null;
  seguidores: number | null;
  posts_instagram: number | null;
  ultimo_post_instagram: string | null;
  justificativa_instagram: string | null;
  abordagem_instagram: string | null;
  anuncios_ativos: number | null;
  justificativa_anuncios: string | null;
  created_at: string;
  enriquecido_em: string | null;
};

export type Marketing = {
  mobile?: boolean;
  analytics?: boolean;
  pixel_meta?: boolean;
  pixel_google?: boolean;
  botao_whatsapp?: boolean;
  ano_copyright?: number | null;
  desatualizado?: boolean;
};

/** O que a etapa `instagram` do prospectar.mjs grava (Apify). Vazio enquanto não houver APIFY_TOKEN. */
export type PerfilInstagram = {
  usuario?: string;
  seguidores?: number;
  posts?: number;
  bio?: string | null;
  categoria?: string | null;
  dias_sem_postar?: number | null;
  posts_30_dias?: number;
  media_curtidas?: number | null;
  media_comentarios?: number | null;
};

export type FiltroProspeccao = {
  nicho?: string;
  classe?: string;
  site?: string;
  oportunidade?: string;
  busca?: string;
  /** 'todos' traz quem e de outro ramo ou reprovou nos requisitos — o mesmo --todos da CLI. */
  lista?: string;
};

const COLUNAS = 'p.*';

export const listarProspeccao = (f: FiltroProspeccao = {}) =>
  query<LeadProspeccao>(
    `select ${COLUNAS}
       from prospeccao.leads p
      where ($1::text is null or p.nicho = $1)
        and ($2::text is null or p.classificacao = $2)
        and ($3::text is null or p.situacao_site = $3)
        and ($4::text is null or p.oportunidade = $4)
        and ($5::text is null or p.nome ilike '%'||$5||'%' or p.nome_empresa ilike '%'||$5||'%'
             or p.cidade ilike '%'||$5||'%' or p.decisor ilike '%'||$5||'%' or p.celular ilike '%'||$5||'%')
        and ($6::text = 'todos' or (p.aderente_nicho is not false and p.requisitos_ok is not false))
      order by p.score desc, p.total_avaliacoes desc nulls last
      limit 500`,
    [f.nicho || null, f.classe || null, f.site || null, f.oportunidade || null, f.busca || null, f.lista || null],
  );

export const buscarProspeccao = (id: string) =>
  one<LeadProspeccao>(
    `select ${COLUNAS} from prospeccao.leads p where p.id = $1`,
    [id],
  );

/** Os nichos que ja rodaram, do mais recente para o mais antigo: viram os chips do filtro. */
export const nichosProspeccao = () =>
  query<{ nicho: string; total: string }>(
    `select nicho, count(*)::text as total
       from prospeccao.leads
      group by nicho
      order by max(created_at) desc`,
  );

/**
 * O peso de cada sinal NO NICHO (a regua muda por nicho: Instagram vale 20 em clinica e 15 em solar).
 * A CLI so grava os pontos de quem tem o sinal; o peso de quem nao tem sai do maximo ja dado no nicho.
 */
export const pesosNicho = (nicho: string) =>
  query<{ sinal: string; peso: number }>(
    `select k as sinal, max((sinais->k->>'pontos')::int) as peso
       from prospeccao.leads, jsonb_object_keys(sinais) k
      where nicho = $1 and k <> '_total'
      group by k
      order by 2 desc`,
    [nicho],
  );

/** Os numeros do topo da aba, sempre sobre a lista que esta na tela (mesmos filtros). */
export function resumir(leads: LeadProspeccao[]) {
  return {
    total: leads.length,
    classeA: leads.filter((l) => l.classificacao === 'A').length,
    comCelular: leads.filter((l) => l.celular || l.whatsapp).length,
    comInstagram: leads.filter((l) => l.instagram).length,
  };
}

// ---------------------------------------------------------------------------
// Rotulos. Os valores sao os que a CLI grava; aqui so muda o que aparece na tela.
// ---------------------------------------------------------------------------

export const CLASSES = [
  { id: 'A', rotulo: 'A · quente', cor: '#2E9E5B' },
  { id: 'B', rotulo: 'B · bom', cor: '#E0A800' },
  { id: 'C', rotulo: 'C · fraco', cor: '#7C9CBF' },
  { id: 'D', rotulo: 'D · descarta', cor: '#8A8A8A' },
] as const;

export const classeInfo = (id: string | null) =>
  CLASSES.find((c) => c.id === id) ?? { id: id ?? '—', rotulo: id ?? '—', cor: '#8A8A8A' };

export const SITUACOES_SITE = [
  { id: 'com_site', rotulo: 'Com site' },
  { id: 'sem_site', rotulo: 'Sem site' },
  { id: 'site_morto', rotulo: 'Site fora do ar' },
] as const;

export const situacaoSite = (id: string | null) =>
  SITUACOES_SITE.find((s) => s.id === id)?.rotulo ?? 'não testado';

export const OPORTUNIDADES = [
  { id: 'alta', rotulo: 'Alta' },
  { id: 'media', rotulo: 'Média' },
  { id: 'baixa', rotulo: 'Baixa' },
] as const;

export const SINAIS: Record<string, string> = {
  site_vivo: 'Site no ar',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  telefone: 'Telefone',
  reputacao: 'Nota no Google',
  endereco: 'Endereço',
  cnpj: 'CNPJ',
  linkedin: 'LinkedIn',
  site_morto: 'Site fora do ar',
};

/** Logo da empresa: o icone do proprio site, servido pelo Google. Sem site, a tela usa as iniciais. */
export function logoDoSite(site: string | null) {
  if (!site) return null;
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(site).hostname}&sz=128`;
  } catch {
    return null;
  }
}

/** "https://www.instagram.com/clinicaexemplo/" -> "@clinicaexemplo" */
export function arroba(url: string | null) {
  const m = url?.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : null;
}

/** 2677 -> "2,7 mil" */
export function mil(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 10_000 ? 0 : 1 })} mil`;
  return String(n);
}

// O slug da CLI vem sem acento; as palavras que ja apareceram ganham o acento de volta na tela.
const ACENTOS: Record<string, string> = { clinica: 'clínica', odontologica: 'odontológica', estetica: 'estética', };

/** O nicho e o slug da CLI ("clinica-odontologica"); na tela vira "clínica odontológica". */
export const nomeNicho = (slug: string) =>
  slug.split('-').map((p) => ACENTOS[p] ?? p).join(' ');

export const nomeOportunidade = (id: string | null) => OPORTUNIDADES.find((o) => o.id === id)?.rotulo ?? '—';
