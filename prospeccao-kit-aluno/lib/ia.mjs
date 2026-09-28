// A IA da prospecção é a IA da conversa: o Claude Code, o Codex, o Antigravity, a que estiver aberta
// nesta pasta. Não é chamada de API — não tem chave, conta nem cobrança à parte (decisão de 18/set/2026).
//
// O script faz o trabalho duro (Maps, site, Receita, Apify) e separa num arquivo o que só uma IA
// resolve, com a regra de cada tarefa dentro. A IA da conversa preenche e o script grava:
//   node prospectar.mjs ia pendentes --nicho X     → saidas/ia-X.json
//   (a IA lê o arquivo e preenche cada "resposta")
//   node prospectar.mjs ia gravar --nicho X
//
// Três tarefas: o nome curto (regra em nome.mjs), o que a empresa vende pelo texto do site e os
// ganchos do Instagram (regra em instagram.mjs). Dado duro — e-mail, telefone, CNPJ, redes — continua
// saindo por regex em site.mjs: a IA só entra onde é insubstituível.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './env.mjs';
import { consultar } from './db.mjs';
import { REGRA_NOMES } from './nome.mjs';
import { REGRA_ABORDAGEM } from './instagram.mjs';

/** Itens por tarefa em cada arquivo: 20 sites a IA lê sem se perder; o resto vem na volta seguinte. */
export const LOTE_IA = 20;
// O texto vem por página ("[início] … [equipe] … [contato] …"): 7 mil caracteres cobrem a home e a equipe
const TEXTO_MAX = 7000;
const PORTES = ['micro', 'pequena', 'media', 'grande', 'indefinido'];
const TIPOS = ['presta_servico', 'fornecedor', 'ensino', 'outro'];

const REGRA_SITE = `Cada item traz o texto do site de uma empresa, dividido por página ([início], [equipe], [contato]...).
Faça o RAIO-X do site: preencha cada campo de "resposta" usando só o que está escrito no texto. Não invente.
resumo: 2 ou 3 frases, diretas e sem marketing: o que a empresa é, o que faz e para quem.
  Se o texto não é de empresa (página de erro, domínio à venda, site de outra coisa), resumo null.
tipo: o que a empresa É, e não o assunto de que fala:
  "presta_servico" — atende o cliente final com o serviço do ramo (a clínica que trata paciente)
  "fornecedor"     — vende produto, equipamento, software ou serviço PARA quem é do ramo (loja, laboratório, distribuidora)
  "ensino"         — curso, escola, pós-graduação, mentoria ou treinamento para profissionais do ramo
  "outro"          — nenhum dos três
  Quem presta o serviço E dá curso é "presta_servico" se atende o cliente final.
servicos: lista dos serviços ou produtos citados, até 8, cada um com até 4 palavras ("implante dentário", "clareamento").
publico: quem compra dela, em até 8 palavras ("pacientes particulares e convênios", "dentistas e clínicas").
profissionais: { "quantos": número de profissionais que atendem citados no texto (conte os nomes da equipe) ou null,
  "quem": até 5 nomes com a especialidade, se o texto trouxer ("Dra. Ana Lima, ortodontista") }.
unidades: número de endereços/filiais citados, ou null.
porte: micro | pequena | media | grande | indefinido. Baseie em sinais concretos (nº de profissionais e unidades,
  anos de mercado, clientes citados). Sem sinal claro, "indefinido". Sempre preenchido: diz ao script que o site foi lido.
do_nicho: true | false — a empresa É o cliente descrito em "publico_alvo" (no topo deste bloco)?
  Fornecedor, escola e empresa de outro ramo são false, mesmo falando do ramo o tempo todo. Na dúvida real, null.
motivo: uma frase curta com a prova do do_nicho, citando o texto ("página Equipe lista 4 dentistas e agenda de pacientes").`;

const PARA_A_IA = (nicho) => `Você é a IA que está conversando com quem roda esta prospecção.
Cada bloco abaixo tem uma "regra" e uma lista de "itens". Em cada item, preencha "resposta" seguindo a regra do bloco,
usando só o que está no próprio item. Não mude nada fora de "resposta". Salve este mesmo arquivo e rode:
  node prospectar.mjs ia gravar --nicho ${nicho}`;

export const arquivoIa = (nicho) => path.join(RAIZ, 'saidas', `ia-${nicho}.json`);

async function filas(nicho, limite) {
  const [nomes, sites, instagram] = await Promise.all([
    consultar(
      `SELECT id, nome, categoria FROM prospeccao.leads
        WHERE nicho = $1 AND nome_empresa IS NULL ORDER BY id LIMIT $2`, [nicho, limite]),
    consultar(
      `SELECT id, COALESCE(nome_empresa, nome) AS empresa, categoria, texto_site FROM prospeccao.leads
        WHERE nicho = $1 AND site_vivo AND site_lido_em IS NULL AND length(texto_site) >= 200
        ORDER BY score DESC NULLS LAST LIMIT $2`, [nicho, limite]),
    // ganchos só para quem continua na lista: não gasta leitura com quem já saiu
    consultar(
      `SELECT id, COALESCE(nome_empresa, nome) AS empresa, instagram_perfil FROM prospeccao.leads
        WHERE nicho = $1 AND instagram_perfil IS NOT NULL AND abordagem_instagram IS NULL
          AND aderente_nicho IS NOT FALSE AND requisitos_ok IS NOT FALSE
        ORDER BY score DESC NULLS LAST LIMIT $2`, [nicho, limite]),
  ]);
  return { nomes: nomes.rows, sites: sites.rows, instagram: instagram.rows };
}

/** Escreve saidas/ia-<nicho>.json com o que falta. Devolve as contagens; total 0 = nada para a IA. */
export async function montarPendentes(nicho, { limite = LOTE_IA, servico = null, publico = null } = {}) {
  const f = await filas(nicho, limite);
  const conta = { nomes: f.nomes.length, sites: f.sites.length, instagram: f.instagram.length };
  conta.total = conta.nomes + conta.sites + conta.instagram;
  const destino = arquivoIa(nicho);
  if (!conta.total) { fs.rmSync(destino, { force: true }); return { ...conta, destino: null }; }

  const pacote = { para_a_ia: PARA_A_IA(nicho), nicho, gerado_em: new Date().toISOString() };
  if (f.nomes.length) pacote.nomes = {
    regra: REGRA_NOMES,
    itens: f.nomes.map((l) => ({ id: l.id, nome: l.nome, categoria: l.categoria, resposta: { empresa: null, pessoa: null } })),
  };
  if (f.sites.length) pacote.sites = {
    regra: REGRA_SITE,
    publico_alvo: publico ?? 'não escrito no nicho: julgue pelo ramo do nicho',
    itens: f.sites.map((l) => ({
      id: l.id, empresa: l.empresa, categoria: l.categoria,
      texto: l.texto_site.slice(0, TEXTO_MAX),
      resposta: { resumo: null, tipo: null, servicos: [], publico: null, profissionais: { quantos: null, quem: [] }, unidades: null, porte: null, do_nicho: null, motivo: null },
    })),
  };
  if (f.instagram.length) pacote.instagram = {
    regra: REGRA_ABORDAGEM,
    servico_do_vendedor: servico,
    itens: f.instagram.map((l) => ({ id: l.id, empresa: l.empresa, perfil: l.instagram_perfil, resposta: { leitura: null, ideias: [] } })),
  };
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(pacote, null, 2), 'utf8');
  return { ...conta, destino };
}

const curto = (v, max) => {
  const t = v == null ? '' : String(v).trim();
  return t && t !== 'null' ? t.slice(0, max) : null;
};

/** Lê o arquivo que a IA preencheu e grava no banco. Item sem resposta fica pendente para a próxima volta. */
export async function gravarRespostas(nicho) {
  const origem = arquivoIa(nicho);
  if (!fs.existsSync(origem)) throw new Error(`Não há ${path.relative(RAIZ, origem)}. Rode antes: node prospectar.mjs ia pendentes --nicho ${nicho}`);
  let pacote;
  try { pacote = JSON.parse(fs.readFileSync(origem, 'utf8')); }
  catch (e) { throw new Error(`${path.relative(RAIZ, origem)} não é um JSON válido (${e.message}). Conserte o arquivo e rode de novo.`); }

  const feito = { nomes: 0, sites: 0, instagram: 0, sem_resposta: 0 };
  for (const it of pacote.nomes?.itens ?? []) {
    const empresa = curto(it.resposta?.empresa, 80);
    if (!empresa) { feito.sem_resposta++; continue; }
    await consultar(`UPDATE prospeccao.leads SET nome_empresa = $3, nome_pessoa = $4 WHERE id = $1 AND nicho = $2`,
      [it.id, nicho, empresa, curto(it.resposta?.pessoa, 60)]);
    feito.nomes++;
  }
  for (const it of pacote.sites?.itens ?? []) {
    const r = it.resposta ?? {};
    const porte = curto(r.porte, 20)?.toLowerCase().replace('é', 'e');
    if (!PORTES.includes(porte)) { feito.sem_resposta++; continue; }
    const inteiro = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : null);
    const lista = (v, max, tam) => (Array.isArray(v) ? v : []).map((x) => curto(x, tam)).filter(Boolean).slice(0, max);
    const raioX = {
      resumo: curto(r.resumo, 600),
      tipo: TIPOS.includes(r.tipo) ? r.tipo : null,
      servicos: lista(r.servicos, 8, 60),
      publico: curto(r.publico, 120),
      profissionais: { quantos: inteiro(r.profissionais?.quantos), quem: lista(r.profissionais?.quem, 5, 80) },
      unidades: inteiro(r.unidades),
      porte,
      do_nicho: typeof r.do_nicho === 'boolean' ? r.do_nicho : null,
      motivo: curto(r.motivo, 240),
    };
    await consultar(
      `UPDATE prospeccao.leads SET resumo_site = $3, porte_estimado = $4, raio_x_site = $5, site_lido_em = now()
        WHERE id = $1 AND nicho = $2`,
      [it.id, nicho, raioX.resumo, porte, JSON.stringify(raioX)]);
    feito.sites++;
  }
  for (const it of pacote.instagram?.itens ?? []) {
    const leitura = curto(it.resposta?.leitura, 300);
    if (!leitura) { feito.sem_resposta++; continue; }
    const ideias = (Array.isArray(it.resposta?.ideias) ? it.resposta.ideias : [])
      .map((x) => curto(x, 300)).filter(Boolean).slice(0, 3).map((x) => `• ${x}`);
    await consultar(`UPDATE prospeccao.leads SET abordagem_instagram = $3 WHERE id = $1 AND nicho = $2`,
      [it.id, nicho, [leitura, ...ideias].join('\n')]);
    feito.instagram++;
  }
  fs.rmSync(origem, { force: true });
  return feito;
}
