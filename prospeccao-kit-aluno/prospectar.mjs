#!/usr/bin/env node
// CLI de prospecção: acha empresas, visita o site de cada uma e classifica.
//   (todo comando para em 10 leads; --limite 200 para a rodada de verdade)
//   node prospectar.mjs buscar     --nicho energia-solar --praca "Rio de Janeiro RJ" [--limite 10] [--termos 2] [--paginas 3]
//   node prospectar.mjs enriquecer --nicho energia-solar [--limite 10]
//   node prospectar.mjs enriquecer --nicho energia-solar --refazer   (relê quem veio antes da tag de site)
//   node prospectar.mjs rodar      --nicho energia-solar --praca "Rio de Janeiro RJ" [--limite 10]
//   node prospectar.mjs rodar      --nicho energia-solar --continuar   (depois da vez da IA: segue sem buscar de novo)
//   node prospectar.mjs ia pendentes --nicho energia-solar   (o que só a IA da conversa resolve → saidas/ia-<nicho>.json)
//   node prospectar.mjs ia gravar    --nicho energia-solar   (grava o que ela preencheu)
//   node prospectar.mjs pesquisar  --nicho energia-solar [--limite 10] [--refazer]   (Serper ou Apify: site, Instagram e LinkedIn que faltaram)
//   node prospectar.mjs instagram  --nicho energia-solar [--classe A] [--limite 10] [--refazer]   (Apify: seguidores, posts, ganchos)
//   node prospectar.mjs validar    --nicho energia-solar
//   node prospectar.mjs anuncios   --nicho energia-solar [--classe A] [--limite 10] [--refazer]   (Apify: anúncio ativo na Biblioteca da Meta; fora do rodar)
//   node prospectar.mjs cnpj      --nicho energia-solar [--classe A] [--limite 10] [--refazer]   (Receita: razão social, sócios)
//   node prospectar.mjs listar     --nicho energia-solar [--classe A] [--site com|sem|morto] [--oportunidade alta|media|baixa] [--todos]
//   node prospectar.mjs exportar   --nicho energia-solar [os mesmos filtros do listar]
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, env } from './lib/env.mjs';
import { buscar, normalizarLugar, motorBusca } from './lib/places.mjs';
import { enriquecerSite } from './lib/site.mjs';
import { montarPendentes, gravarRespostas } from './lib/ia.mjs';
import { classificar, justificarNota, PESOS_PADRAO, FAIXAS } from './lib/score.mjs';
import { aderente } from './lib/aderencia.mjs';
import { oportunidade, explicar, justificarOportunidade } from './lib/marketing.mjs';
import { checarRequisitos } from './lib/requisitos.mjs';
import { consultarCnpj, mesmoEndereco, decisor } from './lib/cnpj.mjs';
import { usuarioDoLink, consultarPerfis, resumirPerfil, justificarInstagram } from './lib/instagram.mjs';
import { buscarAnuncios, resumirAnuncios, justificarAnuncios, urlBiblioteca } from './lib/anuncios.mjs';
import { sessao, procurarSite, procurarInstagram, procurarLinkedin, acharCnpj, mesmoTelefone, perfilBate, motorPesquisa, preBuscar, primeiraBusca, tentativasCnpj } from './lib/pesquisa.mjs';
import { cnpjValido } from './lib/cnpj.mjs';
import { inserirLead, leadsPendentes, salvarEnriquecimento, consultar, encerrar } from './lib/db.mjs';

const CONCORRENCIA = 5;
// Padrão de 10 leads por comando: a aula mostra o fluxo inteiro sem gastar busca e IA com 200 empresas.
// Para a rodada de verdade, passe --limite.
const LIMITE = 10;

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    // flag sem valor (--todos, --refazer) vira true, inclusive quando é a última do comando
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) ? true : argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}

function perfilNicho(nicho) {
  const arquivo = path.join(RAIZ, 'nichos', `${nicho}.json`);
  if (!fs.existsSync(arquivo)) {
    const existentes = fs.readdirSync(path.join(RAIZ, 'nichos')).map((f) => f.replace('.json', ''));
    throw new Error(`Nicho "${nicho}" não existe. Disponíveis: ${existentes.join(', ')}`);
  }
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

// ---------------------------------------------------------------- buscar
async function comandoBuscar(o) {
  const perfil = perfilNicho(o.nicho);
  const praca = o.praca ?? perfil.pracas_sugeridas[0];
  const termos = perfil.termos.slice(0, Number(o.termos ?? perfil.termos.length));
  const limite = Number(o.limite ?? LIMITE);
  const paginas = Number(o.paginas ?? (limite <= 20 ? 1 : 3));   // 10 leads cabem numa página: não paga as outras

  console.log(`\n🔎 ${perfil.rotulo} · ${praca}  (Maps pelo ${motorBusca() === 'apify' ? 'Apify' : 'Google Places'})`);
  console.log(`   ${termos.length} termos × até ${paginas * 20} resultados\n`);

  let novos = 0, repetidos = 0, encerrados = 0;
  const vistos = new Set();

  for (const termo of termos) {
    if (novos >= limite) break;
    const consulta = `${termo} ${praca}`;
    let lugares;
    try {
      lugares = await buscar(consulta, { maxPaginas: paginas, maximo: limite - novos + 10 });   // folga para quem já está na base
    } catch (e) {
      console.log(`   ✗ "${termo}" — ${e.message}`);
      continue;
    }
    let novosDoTermo = 0;
    for (const lugar of lugares) {
      if (novos >= limite) break;
      if (vistos.has(lugar.id)) continue;      // mesmo lugar aparecendo em dois termos
      vistos.add(lugar.id);
      const lead = normalizarLugar(lugar, { nicho: perfil.nicho, praca, termo_busca: termo });
      if (lead._encerrado) { encerrados++; continue; }   // permanentemente fechado não é lead
      const { novo } = await inserirLead(lead);
      if (novo) { novos++; novosDoTermo++; } else repetidos++;
    }
    console.log(`   ✓ "${termo}" — ${lugares.length} lugares, ${novosDoTermo} inéditos`);
  }

  console.log(`\n📥 ${novos} leads novos · ${repetidos} já estavam na base · ${encerrados} fechados descartados`);
  return novos;
}

// ------------------------------------------------------------ enriquecer
async function enriquecerUm(lead, pesos) {
  if (!lead.site) {
    const nota = classificar(lead, { site_vivo: false }, pesos);
    await salvarEnriquecimento(lead.id, {
      site: null, site_url_final: null, site_status: null, site_vivo: false,
      site_titulo: null, site_erro: 'sem site divulgado no Maps',
      emails: [], telefones_site: [], whatsapp: null, instagram: null, facebook: null,
      linkedin: null, youtube: null, cnpj: null, resumo_site: null, porte_estimado: null,
      situacao_site: 'sem_site', marketing: null, oportunidade: null,
      ...nota, status: 'enriquecido',
      justificativa_nota: justificarNota(nota, pesos),
      justificativa_oportunidade: justificarOportunidade('sem_site', null),
    });
    return { nome: lead.nome, ...nota, semSite: true };
  }

  try {
    const dados = await enriquecerSite(lead.site);
    // o texto fica guardado: quem lê é a IA da conversa, depois (comando `ia`)
    const texto_site = dados.site_vivo && dados.texto?.length >= 200 ? dados.texto : null;
    const nota = classificar(lead, dados, pesos);
    const situacao_site = dados.site_vivo ? 'com_site' : 'site_morto';
    await salvarEnriquecimento(lead.id, {
      site: lead.site, ...dados, texto_site, ...nota, status: 'enriquecido',
      situacao_site,
      oportunidade: oportunidade(dados.marketing),
      justificativa_nota: justificarNota(nota, pesos),
      justificativa_oportunidade: justificarOportunidade(situacao_site, dados.marketing),
    });
    return { nome: lead.nome, ...nota, vivo: dados.site_vivo };
  } catch (e) {
    await consultar(
      `UPDATE prospeccao.leads SET status='erro', site_erro=$2, enriquecido_em=now() WHERE id=$1`,
      [lead.id, String(e.message).slice(0, 300)],
    );
    return { nome: lead.nome, erro: e.message };
  }
}

async function comandoEnriquecer(o) {
  const perfil = perfilNicho(o.nicho);
  const limite = Number(o.limite ?? LIMITE);
  const fila = await leadsPendentes({ nicho: perfil.nicho, limite, refazer: Boolean(o.refazer) });
  if (!fila.length) { console.log('\n✓ Nada pendente pra enriquecer.'); return []; }

  console.log(`\n🌐 Enriquecendo ${fila.length} leads (${CONCORRENCIA} de cada vez)\n`);
  const resultados = [];
  for (let i = 0; i < fila.length; i += CONCORRENCIA) {
    const bloco = fila.slice(i, i + CONCORRENCIA);
    const feitos = await Promise.all(bloco.map((l) => enriquecerUm(l, perfil.pesos)));
    for (const r of feitos) {
      const marca = r.erro ? '✗' : ({ A: '🔥', B: '👍', C: '·', D: '✗' }[r.classificacao] ?? '·');
      console.log(`   ${marca} ${String(r.score ?? '—').padStart(3)} ${r.classificacao ?? ''} ${(r.nome ?? '').slice(0, 52)}${r.erro ? ` — ${r.erro.slice(0, 40)}` : ''}`);
    }
    resultados.push(...feitos);
  }
  return resultados;
}

// ------------------------------------------------------------- pesquisar
// O que o Maps e o site não trouxeram, procurado no Google (Serper ou Apify). Roda depois do enriquecer.
// No Apify cada execução leva ~20 s para subir: a primeira busca de todo mundo vai num lote só e os
// leads rodam 5 de cada vez. No Serper, um por vez, como sempre foi.
//   sem site      → procura o site; só vira site se o telefone dele bater com o do Maps (aí relê o site inteiro)
//   sem Instagram → procura o @; conta como pista e o comando `instagram` confere o perfil pelo Apify
//   sem LinkedIn  → só se o LinkedIn pesa no nicho (peso zero não gasta busca)
function somarSinal(lead, chave, pesos, nota) {
  if (lead.sinais?.[chave]?.tem || !(pesos[chave] > 0)) return null;
  const sinais = { ...lead.sinais, [chave]: { tem: true, pontos: pesos[chave], nota } };
  const score = (lead.score ?? 0) + pesos[chave];
  const classificacao = FAIXAS.find((f) => score >= f.minimo).classe;
  sinais._total = score;
  Object.assign(lead, { sinais, score, classificacao });
  return { score, classificacao, sinais, justificativa_nota: justificarNota({ score, classificacao, sinais }, pesos) };
}

async function comandoPesquisar(o) {
  const perfil = perfilNicho(o.nicho);
  const pesos = { ...PESOS_PADRAO, ...perfil.pesos };
  const limite = Number(o.limite ?? LIMITE);
  const { onde, params } = montarFiltro(o);
  const faltaLinkedin = pesos.linkedin > 0 ? 'OR linkedin IS NULL' : '';
  const { rows: fila } = await consultar(
    `SELECT * FROM prospeccao.leads
      WHERE ${onde} AND status = 'enriquecido' AND (site IS NULL OR instagram IS NULL ${faltaLinkedin})
            ${o.refazer ? '' : 'AND pesquisado_em IS NULL'}
      ORDER BY score DESC, total_avaliacoes DESC NULLS LAST LIMIT ${limite}`, params);
  if (!fila.length) { console.log('\n✓ Ninguém com site, Instagram ou LinkedIn para pesquisar.'); return; }

  const motor = motorPesquisa();
  const nomeMotor = motor === 'apify' ? 'Apify' : 'Serper';
  console.log(`\n🔍 Pesquisa no Google (${nomeMotor}) · ${perfil.rotulo} · ${fila.length} leads\n`);
  const conta = { buscas: 0, site: 0, instagram: 0, linkedin: 0 };
  await preBuscar(fila.flatMap((l) => [
    ...(!l.site || !l.instagram ? [primeiraBusca.site(l)] : []),
    ...(!l.linkedin && pesos.linkedin > 0 ? [primeiraBusca.linkedin(l)] : []),
  ]));
  const umLead = async (lead) => {
    const s = sessao(lead);
    const achou = [];
    try {
      // 1. o site
      if (!lead.site) {
        const { site, agregador } = await procurarSite(lead, s);
        if (site) {
          const dados = await enriquecerSite(site).catch(() => null);
          if (dados?.site_vivo && mesmoTelefone(lead, dados)) {
            await enriquecerUm({ ...lead, site }, pesos);
            await consultar(`UPDATE prospeccao.leads SET site_origem = 'pesquisa' WHERE id = $1`, [lead.id]);
            lead = (await consultar(`SELECT * FROM prospeccao.leads WHERE id = $1`, [lead.id])).rows[0];
            if (lead.instagram) await consultar(`UPDATE prospeccao.leads SET instagram_origem = 'site' WHERE id = $1`, [lead.id]);
            s.log.achados.site = site; conta.site++; achou.push(`site ${site}`);
          } else {
            s.log.descartes.push(`${site}: ${dados?.site_vivo ? 'telefone não bate com o do Maps' : 'não respondeu'}`);
          }
        }
        if (!lead.instagram && agregador) {
          const pagina = await enriquecerSite(agregador).catch(() => null);
          if (pagina?.instagram) s.log.achados.instagram_agregador = pagina.instagram;
        }
      }
      // 2. o Instagram
      if (!lead.instagram) {
        const insta = s.log.achados.instagram_agregador ?? await procurarInstagram(lead, s);
        if (insta) {
          const nota = somarSinal(lead, 'instagram', pesos, 'achado na pesquisa do Google');
          await consultar(
            `UPDATE prospeccao.leads SET instagram = $2, instagram_origem = 'pesquisa'
                    ${nota ? ', score = $3, classificacao = $4, sinais = $5, justificativa_nota = $6' : ''} WHERE id = $1`,
            nota ? [lead.id, insta, nota.score, nota.classificacao, JSON.stringify(nota.sinais), nota.justificativa_nota] : [lead.id, insta]);
          s.log.achados.instagram = insta; conta.instagram++; achou.push(`@${insta.split('/').filter(Boolean).pop()}`);
        }
      }
      // 3. o LinkedIn
      if (!lead.linkedin && pesos.linkedin > 0) {
        const li = await procurarLinkedin(lead, s);
        if (li) {
          const nota = somarSinal(lead, 'linkedin', pesos, 'achado na pesquisa do Google');
          await consultar(
            `UPDATE prospeccao.leads SET linkedin = $2, linkedin_origem = 'pesquisa'
                    ${nota ? ', score = $3, classificacao = $4, sinais = $5, justificativa_nota = $6' : ''} WHERE id = $1`,
            nota ? [lead.id, li, nota.score, nota.classificacao, JSON.stringify(nota.sinais), nota.justificativa_nota] : [lead.id, li]);
          s.log.achados.linkedin = li; conta.linkedin++; achou.push('LinkedIn');
        }
      }
    } catch (e) {
      if (/SERPER_API_KEY|créditos|APIFY_TOKEN|Crédito do Apify/.test(e.message)) throw e;   // chave ou crédito: parar a fila inteira
      s.log.erro = e.message;
    }
    await consultar(`UPDATE prospeccao.leads SET pesquisa = $2, pesquisado_em = now() WHERE id = $1`, [lead.id, JSON.stringify(s.log)]);
    conta.buscas += s.log.buscas;
    const nome = (lead.nome_empresa ?? lead.nome ?? '').slice(0, 38).padEnd(38);
    console.log(`   ${achou.length ? '✓' : '—'} ${nome} ${achou.join(' · ') || 'nada novo'}  (${s.log.buscas} buscas)`);
  };
  const deUmaVez = motor === 'apify' ? 5 : 1;
  for (let i = 0; i < fila.length; i += deUmaVez) await Promise.all(fila.slice(i, i + deUmaVez).map(umLead));
  console.log(`\n   ✓ ${conta.site} sites · ${conta.instagram} Instagram · ${conta.linkedin} LinkedIn · ${conta.buscas} buscas no ${nomeMotor}\n`);
}

// ------------------------------------------------------------- validar nicho
async function comandoValidar(o) {
  const perfil = perfilNicho(o.nicho);
  const { rows } = await consultar(
    `SELECT id, nome, categoria, resumo_site, total_avaliacoes, telefone_google, telefones_site,
            whatsapp, site_vivo, seguidores
       FROM prospeccao.leads WHERE nicho = $1 AND status = 'enriquecido'`, [perfil.nicho]);

  // Celular que aparece em mais de uma empresa (em qualquer nicho) é central ou agência, não o dono.
  const { rows: rep } = await consultar(
    `SELECT tel FROM (
       SELECT unnest(array_remove(ARRAY[whatsapp, telefone_google] || telefones_site, NULL)) AS tel, google_id
         FROM prospeccao.leads) t
      GROUP BY tel HAVING count(DISTINCT google_id) > 1`);
  const repetidos = new Set(rep.map((r) => r.tel));

  let dentro = 0;
  const fora = [], duvidosos = [], reprovados = [];
  for (const lead of rows) {
    const v = aderente(lead, perfil.aderencia);
    const r = checarRequisitos(lead, perfil.requisitos, repetidos);
    await consultar(
      `UPDATE prospeccao.leads SET aderente_nicho = $2, motivo_nicho = $3,
              celular = $4, requisitos_ok = $5, motivo_requisitos = $6 WHERE id = $1`,
      [lead.id, v.veredito === 'indefinido' ? null : v.veredito === 'sim', v.motivo,
       r.celular, r.ok, r.motivos.join('; ') || null]);
    if (v.veredito === 'nao') { fora.push({ nome: lead.nome, motivo: v.motivo }); continue; }
    if (!r.ok) { reprovados.push({ nome: lead.nome, motivo: r.motivos.join('; ') }); continue; }
    if (v.veredito === 'sim') dentro++;
    else duvidosos.push({ nome: lead.nome, motivo: v.motivo });
  }

  console.log(`\n🎯 ${dentro} aprovados · ${fora.length} de outro ramo · ${reprovados.length} reprovados nos requisitos · ${duvidosos.length} sem como saber o ramo\n`);
  for (const f of fora) console.log(`   ✗ ${(f.nome ?? '').slice(0, 44).padEnd(44)} — ${f.motivo}`);
  for (const f of reprovados) console.log(`   ⊘ ${(f.nome ?? '').slice(0, 44).padEnd(44)} — ${f.motivo}`);
  if (duvidosos.length) {
    console.log('\n   Sem site pra confirmar o ramo (entram na lista, mas confira antes de abordar):');
    for (const d of duvidosos) console.log(`   ? ${(d.nome ?? '').slice(0, 44)}`);
  }
  console.log('');
  return { dentro, fora, duvidosos, reprovados };
}

// -------------------------------------------------------------------- ia
// O que só uma IA resolve (nome curto, o que o site vende, ganchos do Instagram) é da IA da conversa,
// não de uma API: o script escreve o arquivo, ela preenche, o script grava. Ver lib/ia.mjs.
async function comandoIa(o) {
  const perfil = perfilNicho(o.nicho);
  const acao = o._[1];
  if (acao === 'pendentes') { await vezDaIa(o, { sozinho: true }); return; }
  if (acao !== 'gravar') throw new Error('Use: ia pendentes | ia gravar  (com --nicho)');

  const f = await gravarRespostas(perfil.nicho);
  const sem = f.sem_resposta ? ` · ${f.sem_resposta} sem resposta (voltam na próxima)` : '';
  console.log(`\n🤖 Gravado: ${f.nomes} nomes · ${f.sites} sites · ${f.instagram} perfis${sem}`);
  const resta = await montarPendentes(perfil.nicho, { servico: perfil.cliente_ideal?.servico });
  if (resta.total) console.log(`   Ainda falta: ${resta.nomes} nomes · ${resta.sites} sites · ${resta.instagram} perfis, já em ${path.relative(RAIZ, resta.destino)}\n`);
  else console.log(`   Nada mais para a IA. Se veio do rodar: node prospectar.mjs rodar --nicho ${perfil.nicho} --continuar\n`);
}

/** Escreve o arquivo da IA e avisa. Devolve true se tem trabalho para ela — o rodar para aqui. */
async function vezDaIa(o, { sozinho = false } = {}) {
  if (o['pular-ia'] && !sozinho) return false;
  const perfil = perfilNicho(o.nicho);
  const n = await montarPendentes(perfil.nicho, { servico: perfil.cliente_ideal?.servico });
  if (!n.total) {
    if (sozinho) console.log('\n✓ Nada pendente para a IA.\n');
    return false;
  }
  console.log(`\n🤖 Vez da IA da conversa: ${n.nomes} nomes · ${n.sites} sites · ${n.instagram} perfis do Instagram`);
  console.log(`   → ${path.relative(RAIZ, n.destino)}`);
  console.log('   Leia o arquivo, preencha cada "resposta" pela "regra" do bloco, salve e rode:');
  console.log(`   node prospectar.mjs ia gravar --nicho ${perfil.nicho}`);
  if (!sozinho) console.log(`   Depois: node prospectar.mjs rodar --nicho ${perfil.nicho} --continuar`);
  console.log('');
  return true;
}

// ------------------------------------------------------------------ cnpj
// Fila: quem passou no nicho e nos requisitos e ainda não foi consultado, da melhor nota pra baixo.
// Em série, de propósito: a reserva (cnpj.ws) aceita 3 por minuto.
async function comandoCnpj(o) {
  const perfil = perfilNicho(o.nicho);
  const limite = Number(o.limite ?? LIMITE);
  const { onde, params } = montarFiltro(o);
  const { rows: fila } = await consultar(
    `SELECT id, nome, nome_empresa, endereco, cidade, cnpj, score, sinais FROM prospeccao.leads
      WHERE ${onde} AND status = 'enriquecido' ${o.refazer ? '' : 'AND cnpj_consultado_em IS NULL'}
      ORDER BY score DESC, total_avaliacoes DESC NULLS LAST LIMIT ${limite}`, params);
  if (!fila.length) { console.log('\n✓ Ninguém pendente de CNPJ.'); return; }

  console.log(`\n🏢 CNPJ na Receita · ${perfil.rotulo} · ${fila.length} leads\n`);
  const conta = { site: 0, busca: 0, sem: 0, descartado: 0 };
  const pesquisa = motorPesquisa();
  // as 3 tentativas de uma vez: custa até 2 buscas a mais por lead achado cedo, e poupa minutos de espera no Apify
  if (pesquisa) await preBuscar(fila.filter((l) => !l.cnpj).flatMap(tentativasCnpj));
  for (const lead of fila) {
    let cnpj = lead.cnpj, origem = cnpj ? 'site' : null, nota = null, dados = null;
    // sem CNPJ no site, a pesquisa no Google (Serper ou Apify): o número tem que estar num resultado de verdade, e o CEP tem que bater
    if (!cnpj && pesquisa) {
      const confere = async (c) => { const d = await consultarCnpj(c); return d && mesmoEndereco(lead, d) ? d : null; };
      const achado = await acharCnpj(lead, sessao(lead), cnpjValido, confere).catch(() => ({ dados: null, testados: 0 }));
      if (achado.dados) { dados = achado.dados; cnpj = dados.cnpj; origem = 'busca'; }
      else if (achado.testados) nota = `pesquisa achou ${achado.testados} CNPJ, nenhum com o CEP do Maps`;
    }
    if (!cnpj) nota ??= pesquisa ? 'não publicado no site nem achado na pesquisa' : 'não publicado no site (sem chave de pesquisa, não pesquisou)';
    if (cnpj && !dados) {
      dados = await consultarCnpj(cnpj);
      if (!dados) { nota = `${cnpj} não consta na Receita`; dados = null; }
      else if (origem === 'busca' && !mesmoEndereco(lead, dados)) {
        nota = `busca achou ${cnpj} (${dados.razao_social}), mas o CEP não bate com o do Maps`;
        dados = null;
      }
    }
    const ok = Boolean(dados);
    if (ok && !lead.sinais?.cnpj?.tem) {
      // CNPJ que veio da busca também vale o ponto: refaz a nota e a justificativa com ele
      const pesos = { ...PESOS_PADRAO, ...perfil.pesos };
      const sinais = { ...lead.sinais, cnpj: { tem: true, pontos: pesos.cnpj, nota: 'achado na busca, conferido pelo CEP' } };
      const score = (lead.score ?? 0) + pesos.cnpj;
      const classificacao = FAIXAS.find((f) => score >= f.minimo).classe;
      sinais._total = score;
      await consultar(
        `UPDATE prospeccao.leads SET score = $2, classificacao = $3, sinais = $4, justificativa_nota = $5 WHERE id = $1`,
        [lead.id, score, classificacao, JSON.stringify(sinais), justificarNota({ score, classificacao, sinais }, pesos)]);
    }
    await consultar(
      `UPDATE prospeccao.leads SET cnpj = COALESCE($2, cnpj), cnpj_origem = $3, receita = $4,
              razao_social = $5, decisor = $6, cnpj_nota = $7, cnpj_consultado_em = now() WHERE id = $1`,
      [lead.id, ok ? dados.cnpj : null, ok ? origem : null, ok ? JSON.stringify(dados) : null,
       dados?.razao_social ?? null, decisor(dados), nota]);

    if (ok) conta[origem]++; else if (nota?.includes('não bate') || nota?.includes('não consta')) conta.descartado++; else conta.sem++;
    const marca = ok ? (origem === 'site' ? '✓' : '🔎') : nota?.includes('não bate') ? '⊘' : '—';
    const detalhe = ok
      ? `${dados.razao_social} · ${dados.situacao} · desde ${dados.abertura?.slice(0, 4)} · ${decisor(dados) ?? 'sem sócio'}`
      : nota;
    console.log(`   ${marca} ${(lead.nome ?? '').slice(0, 38).padEnd(38)}  ${detalhe}`);
  }
  console.log(`\n   ✓ ${conta.site} pelo site · 🔎 ${conta.busca} achados na busca · ⊘ ${conta.descartado} descartados · — ${conta.sem} sem CNPJ\n`);
}

// ------------------------------------------------------------- instagram
// Fila: quem tem link de Instagram (achado no site), não foi descartado e ainda não foi consultado.
// Um lote = uma execução do Apify. Rode o validar depois: seguidores_min/max é requisito.
async function comandoInstagram(o) {
  const perfil = perfilNicho(o.nicho);
  const limite = Number(o.limite ?? LIMITE);
  const { onde, params } = montarFiltro(o);
  const { rows: candidatos } = await consultar(
    `SELECT id, nome, nome_empresa, instagram, instagram_origem, site, site_url_final, telefone_google, score, sinais
       FROM prospeccao.leads
      WHERE ${onde} AND status = 'enriquecido' AND instagram IS NOT NULL
            ${o.refazer ? '' : 'AND instagram_consultado_em IS NULL'}
      ORDER BY score DESC, total_avaliacoes DESC NULLS LAST LIMIT ${limite}`, params);
  if (!candidatos.length) { console.log('\n✓ Ninguém com Instagram pendente de consulta.'); return; }

  // o mesmo @ em duas empresas (rede, agência) é consultado uma vez só
  const porUsuario = new Map();
  for (const l of candidatos) {
    const u = usuarioDoLink(l.instagram);
    if (!u) {
      await consultar(`UPDATE prospeccao.leads SET instagram_nota = $2, instagram_consultado_em = now() WHERE id = $1`,
        [l.id, `link não é de perfil: ${l.instagram}`]);
      continue;
    }
    porUsuario.set(u, [...(porUsuario.get(u) ?? []), l]);
  }

  console.log(`\n📸 Instagram pelo Apify · ${perfil.rotulo} · ${porUsuario.size} perfis (uma execução)\n`);
  const crus = await consultarPerfis([...porUsuario.keys()]);
  const achados = new Map(crus.filter((p) => p?.username).map((p) => [p.username.toLowerCase(), p]));

  for (const [usuario, leads] of porUsuario) {
    const lido = resumirPerfil(achados.get(usuario));
    for (const l of leads) {
      const empresa = l.nome_empresa ?? l.nome;
      let r = lido;
      // @ que veio da pesquisa no Google é pista: só fica se o perfil for mesmo da empresa
      if (lido && l.instagram_origem === 'pesquisa' && !perfilBate(lido, l)) {
        const pesos = { ...PESOS_PADRAO, ...perfil.pesos };
        const sinais = { ...l.sinais, instagram: { tem: false, pontos: 0, nota: `@${usuario} da pesquisa não é da empresa` } };
        const score = Math.max(0, (l.score ?? 0) - (l.sinais?.instagram?.pontos ?? 0));
        const classificacao = FAIXAS.find((f) => score >= f.minimo).classe;
        sinais._total = score;
        await consultar(
          `UPDATE prospeccao.leads SET instagram = NULL, instagram_origem = NULL, score = $2, classificacao = $3, sinais = $4,
                  justificativa_nota = $5, instagram_nota = $6, instagram_consultado_em = now() WHERE id = $1`,
          [l.id, score, classificacao, JSON.stringify(sinais), justificarNota({ score, classificacao, sinais }, pesos),
           `@${usuario} achado na pesquisa, mas o perfil (${lido.nome ?? 'sem nome'}) não é da empresa: descartado`]);
        console.log(`   ⊘ ${empresa.slice(0, 34).padEnd(34)}  @${usuario.padEnd(24)}  não é da empresa (${lido.nome ?? 'sem nome'})`);
        continue;
      }
      const justificativa = justificarInstagram(r);
      const abordagem = null;   // os ganchos são da IA da conversa (comando `ia`): perfil relido volta para a fila dela
      await consultar(
        `UPDATE prospeccao.leads SET instagram_perfil = $2, seguidores = $3, posts_instagram = $4,
                ultimo_post_instagram = $5, justificativa_instagram = $6, abordagem_instagram = $7,
                instagram_nota = $8, instagram_consultado_em = now() WHERE id = $1`,
        [l.id, r ? JSON.stringify(r) : null, r?.seguidores ?? null, r?.posts ?? null, r?.ultimo_post ?? null,
         justificativa, abordagem, r ? null : 'perfil não encontrado, privado ou removido']);
      console.log(`   ${r ? '✓' : '—'} ${empresa.slice(0, 34).padEnd(34)}  @${usuario.padEnd(24)}  ${justificativa ?? 'perfil não encontrado ou privado'}`);
    }
  }
  console.log(`\n   ✓ ${[...porUsuario.keys()].filter((u) => resumirPerfil(achados.get(u))).length} de ${porUsuario.size} perfis lidos\n`);
}

// -------------------------------------------------------------- anúncios
// Fila: quem passou no nicho e nos requisitos, com nome limpo, ainda não consultado. Uma execução por lote.
// Achou anúncio ativo num lead com site: a oportunidade cai para baixa, que é o que o pixel tentava dizer.
async function comandoAnuncios(o) {
  const perfil = perfilNicho(o.nicho);
  const limite = Number(o.limite ?? LIMITE);
  const { onde, params } = montarFiltro(o);
  const { rows: fila } = await consultar(
    `SELECT id, nome, nome_empresa, site_url_final, site, instagram, situacao_site, oportunidade, justificativa_oportunidade
       FROM prospeccao.leads
      WHERE ${onde} AND status = 'enriquecido' AND nome_empresa IS NOT NULL
            ${o.refazer ? '' : 'AND anuncios_consultado_em IS NULL'}
      ORDER BY score DESC, total_avaliacoes DESC NULLS LAST LIMIT ${limite}`, params);
  if (!fila.length) { console.log('\n✓ Ninguém pendente na Biblioteca de Anúncios (o comando pede nome limpo: rode `ia pendentes` antes).'); return; }

  console.log(`\n📣 Biblioteca de Anúncios da Meta · ${perfil.rotulo} · ${fila.length} empresas (uma execução)\n`);
  const crus = await buscarAnuncios([...new Set(fila.map((l) => l.nome_empresa))]);
  const porBusca = new Map();
  // a chave é o termo buscado, não a URL: o Apify pode devolver a URL com outra codificação
  const termo = (url) => { try { return new URL(url).searchParams.get('q'); } catch { return null; } };
  for (const a of crus) porBusca.set(termo(a.inputUrl), [...(porBusca.get(termo(a.inputUrl)) ?? []), a]);

  let anunciam = 0;
  for (const l of fila) {
    const dominio = (() => { try { return new URL(l.site_url_final ?? l.site).hostname.replace(/^www\./, ''); } catch { return null; } })();
    const r = resumirAnuncios(porBusca.get(termo(urlBiblioteca(l.nome_empresa))) ?? [],
      { empresa: l.nome_empresa, dominio, usuarioInstagram: usuarioDoLink(l.instagram) });
    const justificativa = justificarAnuncios(r, l.nome_empresa);
    const baixa = r.ativos > 0 && l.situacao_site === 'com_site';
    await consultar(
      `UPDATE prospeccao.leads SET anuncios = $2, anuncios_ativos = $3, justificativa_anuncios = $4,
              oportunidade = $5, justificativa_oportunidade = $6, anuncios_consultado_em = now() WHERE id = $1`,
      [l.id, JSON.stringify(r), r.ativos, justificativa,
       baixa ? 'baixa' : l.oportunidade,
       baixa ? `Oportunidade baixa: tem anúncio ativo na Meta agora, então alguém já cuida do tráfego.` : l.justificativa_oportunidade]);
    if (r.ativos) anunciam++;
    console.log(`   ${r.ativos ? '📣' : '—'} ${l.nome_empresa.slice(0, 34).padEnd(34)}  ${justificativa.slice(0, 110)}`);
  }
  console.log(`\n   ✓ ${anunciam} de ${fila.length} anunciam agora · ${crus.length} anúncios cobrados pelo Apify\n`);
}

// ----------------------------------------------------------- listar / exportar
const SITUACOES = { com: 'com_site', sem: 'sem_site', morto: 'site_morto' };

/** Os cortes que listar e exportar entendem. Sem --todos, some quem é de outro ramo ou reprovou nos requisitos. */
function montarFiltro(o) {
  const filtros = ['nicho = $1'];
  const params = [o.nicho];
  const add = (sql, valor) => { params.push(valor); filtros.push(sql.replace('?', `$${params.length}`)); };
  if (!o.todos) filtros.push('aderente_nicho IS NOT FALSE', 'requisitos_ok IS NOT FALSE');
  if (o.classe) add('classificacao = ?', String(o.classe).toUpperCase());
  if (o.site) {
    const s = SITUACOES[o.site];
    if (!s) throw new Error(`--site aceita: ${Object.keys(SITUACOES).join(' | ')}`);
    add('situacao_site = ?', s);
  }
  if (o.oportunidade) add('oportunidade = ?', String(o.oportunidade).toLowerCase().replace('é', 'e'));
  return { onde: filtros.join(' AND '), params };
}

async function comandoListar(o) {
  const { onde, params } = montarFiltro(o);
  const { rows } = await consultar(
    `SELECT COALESCE(nome_empresa, nome) AS nome, score, classificacao, situacao_site, oportunidade, celular, emails, instagram,
            total_avaliacoes
       FROM prospeccao.leads WHERE ${onde}
      ORDER BY score DESC, total_avaliacoes DESC NULLS LAST`, params);

  const SITE = { com_site: 'com  ', sem_site: 'sem  ', site_morto: 'morto' };
  console.log(`\n📋 ${rows.length} leads\n`);
  console.log('  SCORE  CL  EMPRESA                                   SITE   OPORT.  CELULAR  EMAIL  IG   AVAL.');
  console.log('  ' + '─'.repeat(92));
  for (const l of rows) {
    console.log(
      `  ${String(l.score).padStart(4)}   ${l.classificacao}   ${(l.nome ?? '').slice(0, 40).padEnd(40)}  ` +
      `${SITE[l.situacao_site] ?? '  ?  '}  ${(l.oportunidade ?? '—').padEnd(6)}  ${l.celular ? '   ✓   ' : '   —   '}  ` +
      `${l.emails?.length ? ' ✓ ' : ' — '}   ${l.instagram ? '✓' : '—'}   ${String(l.total_avaliacoes ?? 0).padStart(4)}`);
  }
  const conta = (campo) => rows.reduce((a, l) => { a[l[campo]] = (a[l[campo]] ?? 0) + 1; return a; }, {});
  const cl = conta('classificacao'), si = conta('situacao_site'), op = conta('oportunidade');
  console.log(`\n  A(quente) ${cl.A ?? 0} · B(bom) ${cl.B ?? 0} · C(fraco) ${cl.C ?? 0} · D(descarta) ${cl.D ?? 0}`);
  console.log(`  com site ${si.com_site ?? 0} · sem site ${si.sem_site ?? 0} · site fora do ar ${si.site_morto ?? 0}`);
  console.log(`  oportunidade: alta ${op.alta ?? 0} · média ${op.media ?? 0} · baixa ${op.baixa ?? 0}\n`);
  return rows;
}

async function comandoExportar(o) {
  const { onde, params } = montarFiltro(o);
  const { rows: brutos } = await consultar(
    `SELECT nome_empresa, nome_pessoa, classificacao, score, justificativa_nota,
            situacao_site, oportunidade, justificativa_oportunidade, marketing, celular,
            telefone_google, whatsapp, array_to_string(emails,'; ') AS email,
            site, site_origem, instagram, instagram_origem, seguidores, posts_instagram, ultimo_post_instagram::date AS ultimo_post,
            justificativa_instagram, abordagem_instagram, anuncios_ativos, justificativa_anuncios, linkedin, cnpj, razao_social, decisor,
            receita->>'abertura' AS aberta_em, receita->>'porte' AS porte_receita, cidade, uf, endereco, avaliacao,
            total_avaliacoes, porte_estimado, resumo_site, google_maps_url, nome AS nome_no_maps
       FROM prospeccao.leads WHERE ${onde} ORDER BY score DESC`, params);
  // o jsonb vira frase legível na planilha: "sem pixel de anúncio, copyright 2021, sem botão de WhatsApp"
  const rows = brutos.map(({ marketing, ...r }) => ({ ...r, sinais_marketing: explicar(marketing) }));

  const escapar = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  };
  const colunas = Object.keys(rows[0] ?? { vazio: '' });
  const csv = [colunas.join(';'), ...rows.map((r) => colunas.map((c) => escapar(r[c])).join(';'))].join('\n');

  const hoje = new Date().toISOString().slice(0, 10);
  const sufixo = [o.classe && String(o.classe).toUpperCase(), o.site && `${o.site}-site`, o.oportunidade && `oportunidade-${o.oportunidade}`]
    .filter(Boolean).map((s) => '-' + s).join('');
  const destino = path.join(RAIZ, 'saidas', `${hoje}-${o.nicho}${sufixo}.csv`);
  fs.writeFileSync(destino, '﻿' + csv, 'utf8');   // BOM: Excel abre com acento certo
  console.log(`\n💾 ${rows.length} leads → ${destino}\n`);
  return destino;
}

// ---------------------------------------------------------------------- main
const o = args(process.argv.slice(2));
const comando = o._[0];
try {
  if (!comando) {
    console.log('Comandos: buscar | enriquecer | ia | pesquisar | instagram | validar | anuncios | cnpj | rodar | listar | exportar  (todos pedem --nicho)');
  } else {
    if (!o.nicho) throw new Error('Faltou --nicho (ex.: --nicho energia-solar)');
    switch (comando) {
      case 'buscar':     await comandoBuscar(o); break;
      case 'enriquecer': await comandoEnriquecer(o); break;
      case 'validar':    await comandoValidar(o); break;
      case 'cnpj':       await comandoCnpj(o); break;
      case 'ia':         await comandoIa(o); break;
      case 'nomes':      throw new Error(`O nome curto agora é da IA da conversa: node prospectar.mjs ia pendentes --nicho ${o.nicho}`);
      case 'pesquisar':  await comandoPesquisar(o); break;
      case 'instagram':  await comandoInstagram(o); break;
      case 'anuncios':   await comandoAnuncios(o); break;
      case 'rodar':
        if (!o.continuar) await comandoBuscar(o);
        await comandoEnriquecer(o);
        // a IA da conversa lê antes do validar: o ramo da empresa sai do resumo do site
        if (await vezDaIa(o)) break;
        // o que o site não trouxe, procurado no Google. Sem chave do Serper nem do Apify a rodada segue sem ele.
        if (motorPesquisa()) await comandoPesquisar(o);
        else console.log('\n🔍 Pesquisa no Google pulada: falta APIFY_TOKEN (ou SERPER_API_KEY) no .env.local');
        await comandoValidar(o);
        await comandoCnpj(o);
        // Instagram depois do validar: o Apify cobra por perfil, e quem já saiu da lista não é consultado.
        // O segundo validar aplica seguidores_min/max. Sem chave do Apify a rodada segue sem ele.
        // Anúncio ativo NÃO entra no rodar: é camada extra, pelo comando `anuncios`.
        if (env.APIFY_TOKEN) { await comandoInstagram(o); await comandoValidar(o); }
        else console.log('\n📸 Instagram pulado: falta APIFY_TOKEN no .env.local');
        // de novo: os ganchos do Instagram (e o site que a pesquisa achou) só existem depois daqui
        if (await vezDaIa(o)) break;
        await comandoListar(o);
        await comandoExportar(o);
        break;
      case 'listar':     await comandoListar(o); break;
      case 'exportar':   await comandoExportar(o); break;
      default: throw new Error(`Comando desconhecido: ${comando}`);
    }
  }
} catch (e) {
  console.error('\n✗', e.message, '\n');
  process.exitCode = 1;
} finally {
  await encerrar();
}
