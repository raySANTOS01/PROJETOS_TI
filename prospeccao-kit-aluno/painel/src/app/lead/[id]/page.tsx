import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ArrowUpRight, Building2, Camera, Check, Globe, Lightbulb, Mail, MapPin, MessageCircle,
  Phone, Star, Target, Users, X,
} from 'lucide-react';
import {
  buscarProspeccao, pesosNicho, nomeNicho, situacaoSite, classeInfo, logoDoSite, arroba, mil, SINAIS,
} from '@/lib/prospeccao';
import { dataHora, data, num, brl, telefone as fmtTel } from '@/lib/fmt';
import { Pagina } from '@/components/ui';
import { LogoEmpresa } from '@/components/LogoEmpresa';

export const dynamic = 'force-dynamic';

// Uma cor por assunto, a mesma em chip, numero e cartao: o olho acha o Google, o Instagram e a Receita
// pela cor antes de ler o titulo.
const COR = {
  google: '#F5B82E',
  instagram: '#E1306C',
  site: '#4DA3FF',
  receita: '#9B7BFF',
  contato: '#3DDC84',
  venda: '#FA4200',
  falta: '#6b6257',
};

const OPORTUNIDADE = { alta: 'Oportunidade alta', media: 'Oportunidade média', baixa: 'Oportunidade baixa' };

/** Os seis testes que a CLI faz no HTML do site. Cada "nao" e uma coisa que da para vender. */
const DIAGNOSTICO = [
  { chave: 'mobile', rotulo: 'Versão para celular', brecha: 'site quebra no celular' },
  { chave: 'botao_whatsapp', rotulo: 'Botão de WhatsApp', brecha: 'cliente não acha como chamar' },
  { chave: 'pixel_meta', rotulo: 'Pixel da Meta', brecha: 'não anuncia no Instagram' },
  { chave: 'pixel_google', rotulo: 'Tag do Google Ads', brecha: 'não anuncia no Google' },
  { chave: 'analytics', rotulo: 'Google Analytics', brecha: 'não mede visita' },
] as const;

function Estrelas({ nota, tamanho = 16 }: { nota: number; tamanho?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={tamanho}
          fill={nota >= i - 0.25 ? COR.google : 'transparent'}
          stroke={nota >= i - 0.25 ? COR.google : '#5a5046'}
        />
      ))}
    </span>
  );
}

/** Cartao tingido na cor do assunto, com a barra colorida na esquerda. */
function Bloco({
  cor, icone: Icone, titulo, sub, children, className = '',
}: {
  cor: string; icone: React.ElementType; titulo: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-l-[3px] p-6 ${className}`}
      style={{ background: `${cor}0A`, borderColor: `${cor}30`, borderLeftColor: cor }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${cor}1F`, color: cor }}>
          <Icone size={17} />
        </span>
        <div>
          <h2 className="text-[13px] tracking-[0.12em]" style={{ color: cor }}>{titulo}</h2>
          {sub && <p className="text-xs text-apagado font-light">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** O numero grande do topo: Google, Instagram, site e empresa lado a lado. */
function Destaque({
  cor, icone: Icone, rotulo, valor, nota, children, pequeno,
}: {
  cor: string; icone: React.ElementType; rotulo: string; valor: React.ReactNode; nota?: React.ReactNode; children?: React.ReactNode;
  /** Texto no lugar do numero (um @, por exemplo): fonte menor para caber no cartao. */
  pequeno?: boolean;
}) {
  return (
    <div className="rounded-xl border p-5 relative overflow-hidden" style={{ background: `${cor}0D`, borderColor: `${cor}40` }}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl" style={{ background: `${cor}33` }} />
      <p className="rotulo flex items-center gap-2 relative" style={{ color: cor }}>
        <Icone size={13} /> {rotulo}
      </p>
      <p className={`titulo leading-none mt-3 relative break-all ${pequeno ? 'text-xl' : 'text-4xl'}`} style={{ color: cor }}>{valor}</p>
      {children && <div className="mt-2 relative">{children}</div>}
      {nota && <p className="text-xs text-apagado mt-2 font-light relative">{nota}</p>}
    </div>
  );
}

function Chip({ cor, children, href }: { cor: string; children: React.ReactNode; href?: string }) {
  const classe = 'inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full border whitespace-nowrap';
  const estilo = { color: cor, borderColor: `${cor}55`, background: `${cor}14` };
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${classe} hover:brightness-125`} style={estilo}>{children}</a>
  ) : (
    <span className={classe} style={estilo}>{children}</span>
  );
}

function Botao({ href, cor, children, cheio }: { href: string; cor: string; children: React.ReactNode; cheio?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg border transition hover:brightness-110"
      style={cheio ? { background: cor, borderColor: cor, color: '#0D0900' } : { color: cor, borderColor: `${cor}66`, background: `${cor}10` }}
    >
      {children}
    </a>
  );
}

function Linha({ icone: Icone, cor, children }: { icone: React.ElementType; cor: string; children: React.ReactNode }) {
  return (
    <p className="text-sm flex items-start gap-2.5 break-all">
      <Icone size={15} className="mt-0.5 shrink-0" style={{ color: cor }} /> <span>{children}</span>
    </p>
  );
}

/** A nota do Google sempre com uma casa: "5,0", nao "5". */
const notaGoogle = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const anosDesde = (iso: string) => Math.floor((Date.now() - Date.parse(`${iso}T12:00:00`)) / (365.25 * 864e5));

export default async function DetalheProspeccao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await buscarProspeccao(id);
  if (!l) notFound();
  const pesos = (await pesosNicho(l.nicho)).filter((p) => p.peso > 0);

  const nome = l.nome_empresa ?? l.nome ?? '(sem nome)';
  const classe = classeInfo(l.classificacao);
  const celular = l.celular ?? l.whatsapp;
  const site = l.site_url_final ?? l.site;
  const ig = arroba(l.instagram);
  const perfil = l.instagram_perfil;
  const seguidores = l.seguidores ?? perfil?.seguidores ?? null;
  const nota = l.avaliacao ? Number(l.avaliacao) : null;
  const receita = (l.receita ?? {}) as {
    porte?: string; abertura?: string; situacao?: string; atividade?: string; capital_social?: number;
    socios?: { nome: string; cargo?: string }[]; telefones?: string[]; email?: string | null;
  };
  const anos = receita.abertura ? anosDesde(receita.abertura) : null;
  // Os fixos, sem repetir o celular que ja esta no botao do WhatsApp. Compara pelos 8 ultimos digitos:
  // o Maps escreve com DDD, a Receita com 55 na frente.
  const fim = (t?: string | null) => (t ?? '').replace(/\D/g, '').slice(-8);
  const telefones = [...new Set([l.telefone_google, ...(l.telefones_site ?? [])].filter(Boolean))].filter(
    (t) => fim(t) !== fim(celular),
  ) as string[];
  // O que a empresa declarou na Receita e nao aparece no site nem no Maps: costuma ser o dono ou o contador.
  const vistos = new Set([celular, ...telefones].map(fim));
  const telReceita = (receita.telefones ?? []).filter((t) => !vistos.has(fim(t)));
  const emailReceita = receita.email && !(l.emails ?? []).includes(receita.email) ? receita.email : null;
  const mapa =
    l.lat && l.lng
      ? `https://maps.google.com/maps?q=${l.lat},${l.lng}&z=16&hl=pt-BR&output=embed`
      : l.endereco
        ? `https://maps.google.com/maps?q=${encodeURIComponent(l.endereco)}&z=16&hl=pt-BR&output=embed`
        : null;

  const mk = l.marketing;
  const testes = mk
    ? [
        ...DIAGNOSTICO.map((d) => ({ ...d, ok: Boolean(mk[d.chave]) })),
        {
          chave: 'rodape',
          rotulo: mk.ano_copyright ? `Rodapé de ${mk.ano_copyright}` : 'Rodapé com o ano',
          brecha: 'site parado no tempo',
          ok: !mk.desatualizado,
        },
      ]
    : [];
  const brechas = testes.filter((t) => !t.ok).length;

  const sinal = (k: string) => {
    const s = l.sinais?.[k];
    return typeof s === 'object' && s ? s : null;
  };
  const totalPesos = pesos.reduce((s, p) => s + p.peso, 0) || 100;

  return (
    <Pagina>
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-apagado hover:text-destaque mb-5 transition-colors">
        <ArrowLeft size={14} /> voltar aos leads de prospecção
      </Link>

      {/* ------------------------------------------------ o cabecalho: quem e, a nota e os atalhos */}
      <header
        className="cartao p-6 lg:p-7 mb-5 relative overflow-hidden"
        style={{ background: `radial-gradient(120% 140% at 100% 0%, ${classe.cor}1A 0%, transparent 55%), var(--color-card)` }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <LogoEmpresa src={logoDoSite(site)} nome={nome} cor={classe.cor} tamanho={72} />
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-3xl leading-tight">{nome}</h1>
              {l.nome_empresa && l.nome && l.nome !== l.nome_empresa && (
                <p className="text-apagado text-xs font-light mt-1 truncate">no Google: {l.nome}</p>
              )}
              <p className="text-sm text-apagado mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5"><MapPin size={13} className="text-destaque" /> {[l.cidade, l.uf].filter(Boolean).join(' / ') || '—'}</span>
                {l.categoria && <span>· {l.categoria}</span>}
                {l.cnpj && <span>· CNPJ {l.cnpj}</span>}
                <span className="text-[11px] uppercase tracking-wider border border-borda-forte rounded-full px-2 py-0.5">{nomeNicho(l.nicho)}</span>
              </p>
            </div>
          </div>

          <div className="shrink-0 lg:text-right">
            <p className="rotulo mb-1">Nota da prospecção</p>
            <p className="titulo leading-none" style={{ color: classe.cor }}>
              <span className="text-6xl">{l.score}</span>
              <span className="text-xl text-apagado">/100</span>
            </p>
            <div className="h-2 w-48 rounded-full bg-white/10 mt-3 lg:ml-auto overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(l.score, 100)}%`, background: classe.cor }} />
            </div>
            <p className="text-sm font-bold mt-2" style={{ color: classe.cor }}>Classe {classe.rotulo}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-borda">
          {nota !== null && (
            <Chip cor={COR.google} href={l.google_maps_url ?? undefined}>
              <Star size={13} fill={COR.google} /> {notaGoogle(nota)} no Google
              <span className="opacity-70 font-normal">· {num(l.total_avaliacoes)} avaliações</span>
            </Chip>
          )}
          {ig && (
            <Chip cor={COR.instagram} href={l.instagram ?? undefined}>
              <Camera size={13} /> {seguidores !== null ? `${mil(seguidores)} seguidores` : ig}
            </Chip>
          )}
          <Chip cor={l.situacao_site === 'com_site' ? COR.site : COR.venda}>
            <Globe size={13} /> {situacaoSite(l.situacao_site)}
          </Chip>
          {l.oportunidade && (
            <Chip cor={COR.venda}>
              <Target size={13} /> {OPORTUNIDADE[l.oportunidade]}
            </Chip>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 mt-4">
          {celular && (
            <Botao href={`https://wa.me/${celular.replace(/\D/g, '')}`} cor={COR.contato} cheio>
              <MessageCircle size={15} /> WhatsApp {fmtTel(celular)}
            </Botao>
          )}
          {site && <Botao href={site} cor={COR.site}><Globe size={15} /> Ver site <ArrowUpRight size={13} /></Botao>}
          {l.instagram && <Botao href={l.instagram} cor={COR.instagram}><Camera size={15} /> Instagram <ArrowUpRight size={13} /></Botao>}
          {l.google_maps_url && <Botao href={l.google_maps_url} cor={COR.google}><MapPin size={15} /> Google Maps <ArrowUpRight size={13} /></Botao>}
        </div>
      </header>

      {/* ------------------------------------------------ os quatro numeros grandes */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Destaque
          cor={COR.google}
          icone={Star}
          rotulo="Google"
          valor={nota !== null ? notaGoogle(nota) : '—'}
          nota={l.total_avaliacoes ? `${num(l.total_avaliacoes)} avaliações no Maps` : 'sem avaliações'}
        >
          {nota !== null && <Estrelas nota={nota} />}
        </Destaque>
        <Destaque
          cor={COR.instagram}
          icone={Camera}
          rotulo="Instagram"
          valor={seguidores !== null ? mil(seguidores) : ig ?? 'não achou'}
          pequeno={seguidores === null}
          nota={
            seguidores !== null
              ? `seguidores${l.posts_instagram ? ` · ${num(l.posts_instagram)} posts` : ''}`
              : ig
                ? 'perfil achado · os seguidores entram com a etapa instagram'
                : 'nem no site nem na busca do Google'
          }
        />
        <Destaque
          cor={COR.site}
          icone={Globe}
          rotulo="Site"
          valor={l.situacao_site === 'com_site' ? 'no ar' : l.situacao_site === 'site_morto' ? 'fora' : 'sem'}
          nota={mk ? (brechas ? `${brechas} de ${testes.length} testes falharam` : 'passou em todos os testes') : situacaoSite(l.situacao_site)}
        />
        <Destaque
          cor={COR.receita}
          icone={Building2}
          rotulo="Empresa"
          valor={anos !== null ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : l.porte_estimado ?? '—'}
          nota={anos !== null ? `aberta em ${data(`${receita.abertura}T12:00:00`)} · ${receita.porte?.toLowerCase() ?? ''}` : 'porte estimado pelo site'}
        />
      </div>

      {/* ------------------------------------------------ a venda: o que a IA achou para oferecer */}
      {l.justificativa_oportunidade && (
        <section
          className="rounded-xl border p-6 lg:p-7 mb-5 flex gap-5 items-start"
          style={{ background: `linear-gradient(90deg, ${COR.venda}22, ${COR.venda}08)`, borderColor: `${COR.venda}55` }}
        >
          <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-destaque text-fundo">
            <Lightbulb size={22} />
          </span>
          <div>
            <p className="rotulo text-destaque">A venda que cabe</p>
            <p className="text-lg lg:text-xl leading-snug">{l.justificativa_oportunidade.replace(/^Oportunidade \w+:\s*/i, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase())}</p>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* ---------------------------------------------- de onde vem a nota */}
        <Bloco cor={classe.cor} icone={Target} titulo="De onde vem a nota" sub={`A régua do nicho ${nomeNicho(l.nicho)}: cada sinal vale pontos.`}>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-5">
            {pesos.map((p) => {
              const s = sinal(p.sinal);
              return (
                <div
                  key={p.sinal}
                  title={`${SINAIS[p.sinal] ?? p.sinal}: ${s?.tem ? `+${s.pontos}` : `0 de ${p.peso}`}`}
                  style={{ width: `${(p.peso / totalPesos) * 100}%`, background: s?.tem ? classe.cor : '#ffffff14' }}
                />
              );
            })}
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {pesos.map((p) => {
              const s = sinal(p.sinal);
              return (
                <li key={p.sinal} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={s?.tem ? { background: `${classe.cor}26`, color: classe.cor } : { background: '#ffffff0d', color: COR.falta }}
                  >
                    {s?.tem ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <span className={s?.tem ? '' : 'text-apagado/70'}>{SINAIS[p.sinal] ?? p.sinal}</span>
                  <span className="ml-auto titulo text-xs" style={{ color: s?.tem ? classe.cor : COR.falta }}>
                    {s?.tem ? `+${s.pontos}` : `0/${p.peso}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-borda text-sm">
            <div>
              <p className="rotulo">É do nicho?</p>
              <p className={l.aderente_nicho === false ? 'text-destaque' : ''}>
                {l.aderente_nicho === null ? 'não avaliado' : l.aderente_nicho ? 'sim' : 'não'}
                {l.motivo_nicho && <span className="text-apagado font-light"> · {l.motivo_nicho}</span>}
              </p>
            </div>
            <div>
              <p className="rotulo">Requisitos</p>
              <p className={l.requisitos_ok === false ? 'text-destaque' : ''}>
                {l.requisitos_ok === null ? 'não avaliado' : l.requisitos_ok ? 'passou' : 'reprovou'}
                {l.motivo_requisitos && <span className="text-apagado font-light"> · {l.motivo_requisitos}</span>}
              </p>
            </div>
          </div>
        </Bloco>

        {/* ---------------------------------------------- raio-x do site */}
        <Bloco
          cor={COR.site}
          icone={Globe}
          titulo="Raio-x do site"
          sub={mk ? 'O que a prospecção leu no código do site. Cada falha é argumento de venda.' : 'Sem site para testar.'}
        >
          {mk ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {testes.map((t) => (
                  <div
                    key={t.chave}
                    className="rounded-lg border p-3"
                    style={t.ok ? { borderColor: `${COR.contato}40`, background: `${COR.contato}0D` } : { borderColor: `${COR.venda}55`, background: `${COR.venda}12` }}
                  >
                    <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: t.ok ? COR.contato : COR.venda }}>
                      {t.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />} {t.ok ? 'tem' : 'não tem'}
                    </p>
                    <p className="text-sm mt-1 leading-tight">{t.rotulo}</p>
                    {!t.ok && <p className="text-[11px] text-apagado font-light mt-1">{t.brecha}</p>}
                  </div>
                ))}
              </div>
              {(l.site_titulo || l.resumo_site) && (
                <div className="mt-5 pt-5 border-t border-borda">
                  {l.site_titulo && <p className="text-sm font-medium">{l.site_titulo}</p>}
                  {l.resumo_site && <p className="text-sm text-apagado font-light mt-1 leading-relaxed">{l.resumo_site}</p>}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-apagado font-light">
              {l.situacao_site === 'site_morto'
                ? 'O site cadastrado no Google não abre. Para quem vende site, é a abordagem mais fácil que existe.'
                : 'A empresa não tem site. Tudo o que o cliente acha dela está no Google Maps e no Instagram.'}
            </p>
          )}
        </Bloco>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
        {/* ---------------------------------------------- mapa */}
        <Bloco cor={COR.google} icone={MapPin} titulo="No Google Maps" sub={l.endereco ?? undefined}>
          {mapa && (
            <iframe
              src={mapa}
              title={`Mapa de ${nome}`}
              className="w-full h-72 rounded-lg border border-borda"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {nota !== null && (
              <>
                <Estrelas nota={nota} tamanho={18} />
                <span className="titulo text-lg" style={{ color: COR.google }}>{notaGoogle(nota)}</span>
                <span className="text-sm text-apagado">{num(l.total_avaliacoes)} avaliações</span>
              </>
            )}
            {l.google_maps_url && (
              <a href={l.google_maps_url} target="_blank" rel="noreferrer" className="ml-auto text-xs flex items-center gap-1 hover:underline" style={{ color: COR.google }}>
                abrir no Maps <ArrowUpRight size={12} />
              </a>
            )}
          </div>
        </Bloco>

        {/* ---------------------------------------------- contato */}
        <Bloco cor={COR.contato} icone={Phone} titulo="Contato" sub="Tudo o que a prospecção achou para chegar nela.">
          <div className="flex flex-col gap-3">
            {celular ? (
              <a
                href={`https://wa.me/${celular.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg p-3 border hover:brightness-125 transition"
                style={{ borderColor: `${COR.contato}55`, background: `${COR.contato}14` }}
              >
                <MessageCircle size={20} style={{ color: COR.contato }} />
                <span>
                  <span className="rotulo mb-0" style={{ color: COR.contato }}>WhatsApp</span>
                  <span className="titulo text-lg">{fmtTel(celular)}</span>
                </span>
              </a>
            ) : (
              <p className="text-sm text-apagado">Nenhum celular achado.</p>
            )}
            {telefones.map((t) => (
              <Linha key={t} icone={Phone} cor={COR.contato}>{fmtTel(t)}</Linha>
            ))}
            {(l.emails ?? []).map((e) => (
              <Linha key={e} icone={Mail} cor={COR.contato}>{e}</Linha>
            ))}
            {(telReceita.length > 0 || emailReceita) && (
              <div className="rounded-lg p-3 border mt-1" style={{ borderColor: `${COR.receita}44`, background: `${COR.receita}0f` }}>
                <p className="rotulo mb-2" style={{ color: COR.receita }}>Declarado na Receita · fora do site e do Maps</p>
                <div className="flex flex-col gap-2">
                  {telReceita.map((t) => (
                    <Linha key={t} icone={Phone} cor={COR.receita}>{fmtTel(t)}</Linha>
                  ))}
                  {emailReceita && <Linha icone={Mail} cor={COR.receita}>{emailReceita}</Linha>}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-3 mt-1 border-t border-borda">
              {l.facebook && <Chip cor={COR.site} href={l.facebook}>Facebook</Chip>}
              {l.linkedin && <Chip cor={COR.site} href={l.linkedin}>LinkedIn</Chip>}
              {l.youtube && <Chip cor={COR.venda} href={l.youtube}>YouTube</Chip>}
              {l.instagram && <Chip cor={COR.instagram} href={l.instagram}>{ig ?? 'Instagram'}</Chip>}
            </div>
          </div>
        </Bloco>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* ---------------------------------------------- receita */}
        <Bloco
          cor={COR.receita}
          icone={Building2}
          titulo="A empresa no papel"
          sub={
            !l.cnpj ? undefined
              : l.cnpj_origem === 'busca' ? `CNPJ ${l.cnpj}: achado na pesquisa do Google e conferido pelo CEP do Maps.`
              : `CNPJ ${l.cnpj}: publicado no site da empresa.`
          }
        >
          {l.receita ? (
            <>
              <p className="text-base font-medium">{l.razao_social}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {receita.situacao && <Chip cor={receita.situacao === 'ATIVA' ? COR.contato : COR.venda}>{receita.situacao.toLowerCase()}</Chip>}
                {receita.porte && <Chip cor={COR.receita}>{receita.porte.toLowerCase()}</Chip>}
                {receita.capital_social ? <Chip cor={COR.receita}>capital {brl(receita.capital_social)}</Chip> : null}
              </div>
              {receita.atividade && <p className="text-sm text-apagado font-light mt-3">{receita.atividade}</p>}
              {receita.socios && receita.socios.length > 0 && (
                <div className="mt-5 pt-5 border-t border-borda">
                  <p className="rotulo flex items-center gap-2"><Users size={12} /> Quem manda</p>
                  <ul className="flex flex-col gap-2.5 mt-2">
                    {receita.socios.map((s) => (
                      <li key={s.nome} className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${COR.receita}26`, color: COR.receita }}>
                          {s.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('')}
                        </span>
                        <span className="text-sm">
                          {s.nome.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())}
                          {s.cargo && <span className="block text-xs text-apagado font-light">{s.cargo}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-apagado font-light">
              {l.cnpj ? `CNPJ ${l.cnpj} achado, a Receita ainda não foi consultada.` : (l.cnpj_nota ?? 'O CNPJ ainda não foi procurado.')}
              {l.decisor && <span className="block mt-2 text-texto">Decisor: {l.decisor}</span>}
            </p>
          )}
        </Bloco>

        {/* ---------------------------------------------- instagram */}
        <Bloco cor={COR.instagram} icone={Camera} titulo="Instagram" sub={ig ?? undefined}>
          {perfil && seguidores !== null ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="titulo text-3xl" style={{ color: COR.instagram }}>{mil(seguidores)}</p><p className="text-xs text-apagado">seguidores</p></div>
                <div><p className="titulo text-3xl">{num(perfil.posts ?? l.posts_instagram)}</p><p className="text-xs text-apagado">posts</p></div>
                <div>
                  <p className="titulo text-3xl">{perfil.dias_sem_postar ?? '—'}</p>
                  <p className="text-xs text-apagado">dias sem postar</p>
                </div>
              </div>
              {perfil.bio && <p className="text-sm font-light mt-4 whitespace-pre-wrap">{perfil.bio}</p>}
              {l.abordagem_instagram && (
                <div className="mt-5 pt-5 border-t border-borda">
                  <p className="rotulo">Ganchos para a abordagem</p>
                  <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{l.abordagem_instagram}</p>
                </div>
              )}
            </>
          ) : l.instagram ? (
            <div className="flex flex-col gap-4">
              <a href={l.instagram} target="_blank" rel="noreferrer" className="titulo text-2xl hover:underline" style={{ color: COR.instagram }}>
                {ig}
              </a>
              <p className="text-sm text-apagado font-light">
                O perfil foi achado{l.instagram_origem === 'pesquisa' ? ' pela busca no Google' : ' no site'}. Seguidores, posts e os ganchos
                para a abordagem entram quando a etapa <code className="text-texto">instagram</code> rodar.
              </p>
            </div>
          ) : (
            <p className="text-sm text-apagado font-light">Nenhum perfil achado, nem no site nem na busca do Google.</p>
          )}
        </Bloco>
      </div>

      <p className="text-xs text-apagado/70 font-light">
        Achado em {dataHora(l.created_at)} buscando “{l.termo_busca ?? '—'}” em {l.praca ?? '—'}
        {l.enriquecido_em ? ` · enriquecido em ${dataHora(l.enriquecido_em)}` : ''}.
      </p>
    </Pagina>
  );
}
