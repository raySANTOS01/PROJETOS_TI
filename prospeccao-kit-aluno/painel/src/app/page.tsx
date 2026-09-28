import Link from 'next/link';
import {
  listarProspeccao, nichosProspeccao, resumir, nomeNicho, situacaoSite, classeInfo, logoDoSite, nomeOportunidade,
  CLASSES, SITUACOES_SITE, OPORTUNIDADES, type FiltroProspeccao,
} from '@/lib/prospeccao';
import { telefone as fmtTel, num } from '@/lib/fmt';
import { Pagina, Titulo, Metrica, Vazio } from '@/components/ui';
import { FiltroLeads } from '@/components/FiltroLeads';
import { SeloClasse } from '@/components/SeloClasse';
import { LogoEmpresa } from '@/components/LogoEmpresa';
import { Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Prospeccao({ searchParams }: { searchParams: Promise<FiltroProspeccao> }) {
  const filtro = await searchParams;
  const [leads, nichos] = await Promise.all([listarProspeccao(filtro), nichosProspeccao()]);
  const r = resumir(leads);

  return (
    <Pagina>
      <Titulo sub="Empresas achadas e qualificadas pela prospecção. A nota diz em qual encostar primeiro.">
        Leads de prospecção
      </Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <Metrica rotulo="Na lista" valor={num(r.total)} nota="com os filtros de agora" />
        <Metrica rotulo="Classe A" valor={num(r.classeA)} nota="nota 75 ou mais" destaque />
        <Metrica rotulo="Com celular" valor={num(r.comCelular)} nota="dá para chamar no WhatsApp" />
        <Metrica rotulo="Com Instagram" valor={num(r.comInstagram)} nota="dá para ver o perfil antes de chamar" />
      </div>

      <FiltroLeads
        rota="/"
        placeholder="Empresa, cidade, decisor ou celular"
        filtro={filtro}
        grupos={[
          { chave: 'nicho', rotulo: 'Nicho', opcoes: nichos.map((n) => ({ id: n.nicho, rotulo: `${nomeNicho(n.nicho)} · ${n.total}` })) },
          { chave: 'classe', rotulo: 'Classe', opcoes: CLASSES.map((c) => ({ id: c.id, rotulo: c.rotulo })) },
          { chave: 'site', rotulo: 'Site', opcoes: SITUACOES_SITE.map((s) => ({ id: s.id, rotulo: s.rotulo })) },
          { chave: 'oportunidade', rotulo: 'Oportunidade', opcoes: OPORTUNIDADES.map((o) => ({ id: o.id, rotulo: o.rotulo })) },
          { chave: 'lista', rotulo: 'Lista', rotuloTodos: 'Só os aptos', opcoes: [{ id: 'todos', rotulo: 'Incluir fora do nicho e reprovados' }] },
        ]}
      />

      {leads.length === 0 ? (
        <div className="cartao mt-5">
          <Vazio>Nenhum lead de prospecção com esse filtro.</Vazio>
        </div>
      ) : (
        <div className="cartao mt-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[1080px]">
            <thead>
              <tr className="text-apagado text-[11px] uppercase tracking-wider border-b border-borda">
                <th className="text-left font-medium px-4 py-3">Empresa</th>
                <th className="text-left font-medium px-4 py-3">Nota</th>
                <th className="text-left font-medium px-4 py-3">Contato</th>
                <th className="text-left font-medium px-4 py-3">Site</th>
                <th className="text-left font-medium px-4 py-3">Oportunidade</th>
                <th className="text-left font-medium px-4 py-3">Google</th>
                <th className="text-left font-medium px-4 py-3">Nicho</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const fora = l.aderente_nicho === false || l.requisitos_ok === false;
                return (
                  <tr key={l.id} className={`border-b border-borda/60 hover:bg-white/4 transition-colors ${fora ? 'opacity-55' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/lead/${l.id}`} className="flex items-center gap-3">
                        <LogoEmpresa
                          src={logoDoSite(l.site_url_final ?? l.site)}
                          nome={l.nome_empresa ?? l.nome ?? '?'}
                          cor={classeInfo(l.classificacao).cor}
                          tamanho={38}
                        />
                        <span className="min-w-0">
                          <p className="font-medium">{l.nome_empresa ?? l.nome ?? '(sem nome)'}</p>
                          <p className="text-xs text-apagado font-light">
                            {[l.nome_pessoa ?? l.decisor, [l.cidade, l.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || '—'}
                          </p>
                          {fora && (
                            <p className="text-[11px] text-destaque/80 font-light">
                              {l.aderente_nicho === false ? 'fora do nicho' : 'reprovado nos requisitos'}
                            </p>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <SeloClasse classe={l.classificacao} score={l.score} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>{fmtTel(l.celular ?? l.whatsapp ?? l.telefone_google)}</p>
                      <p className="text-apagado font-light truncate max-w-[220px]">{l.emails?.[0] ?? ''}</p>
                    </td>
                    <td className={`px-4 py-3 text-xs ${l.situacao_site === 'com_site' ? 'text-apagado' : 'text-destaque'}`}>
                      {situacaoSite(l.situacao_site)}
                    </td>
                    <td className="px-4 py-3 text-apagado text-xs">{nomeOportunidade(l.oportunidade)}</td>
                    <td className="px-4 py-3 text-apagado text-xs">
                      {l.avaliacao ? (
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Star size={13} fill="#F5B82E" stroke="#F5B82E" />
                          <span className="text-texto font-medium">
                            {Number(l.avaliacao).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>
                          · {num(l.total_avaliacoes)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-apagado text-xs">{nomeNicho(l.nicho)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-apagado/70 mt-4 font-light">
        {leads.length} {leads.length === 1 ? 'lead' : 'leads'}, da nota maior para a menor
        {leads.length === 500 ? ' (mostrando os 500 primeiros)' : ''}. Quem grava aqui é o prospectar.mjs;
        este painel só lê.
      </p>
    </Pagina>
  );
}
