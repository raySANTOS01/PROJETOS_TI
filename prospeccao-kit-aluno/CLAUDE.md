# CLAUDE.md — instruções para o agente

Esta pasta acha empresas de um nicho numa cidade, visita o site de cada uma, colhe os contatos
públicos e devolve a lista com uma nota de 0 a 100.

Leia este arquivo inteiro antes do primeiro comando. O porquê de cada decisão está em `docs/`.

**O que decide o resultado é o critério do dono, não o código.** Antes da primeira busca no nicho
dele, ele escolhe um de dois caminhos (seção 2): igual à aula, ou o cliente ideal dele.

---

## 1. As possibilidades

### Read-only — pode rodar sem perguntar

| O dono pede | O comando |
|---|---|
| "quais nichos existem?" | `ls nichos/` |
| "me mostra os leads" | `node prospectar.mjs listar --nicho <nicho>` |
| "só os melhores" | `node prospectar.mjs listar --nicho <nicho> --classe A` |
| "quem não tem site?" / "pra quem eu vendo site?" | `node prospectar.mjs listar --nicho <nicho> --site sem` (e `--site morto`) |
| "só quem tem site" | `node prospectar.mjs listar --nicho <nicho> --site com` |
| "quem está com o marketing fraco?" | `node prospectar.mjs listar --nicho <nicho> --oportunidade alta` |
| "inclui os de outro ramo e os reprovados" | `node prospectar.mjs listar --nicho <nicho> --todos` |
| "exporta pra planilha" | `node prospectar.mjs exportar --nicho <nicho>` + os mesmos filtros do `listar` |
| "por que essa empresa tirou essa nota?" | leia `justificativa_nota` daquele lead (a conta detalhada está em `sinais`) |
| "qual venda cabe nessa empresa?" | leia `justificativa_oportunidade` daquele lead |
| "como está o Instagram dela?" / "como eu abordo?" | leia `justificativa_instagram` e `abordagem_instagram` daquele lead |
| "ela anuncia?" | leia `justificativa_anuncios` daquele lead |
| "o que já aprendemos?" | leia `APRENDIZADOS.md` |
| "dá para trocar a ferramenta de X?" / "que outras opções existem?" | leia `OPCOES.md` |
| "de onde veio esse site / esse Instagram?" | `site_origem` e `instagram_origem` (vazio/`site` = do Maps ou do site; `pesquisa` = do Google) e o caminho em `pesquisa` |
| "qual o nome dela / com quem eu falo?" | `nome_empresa`, `nome_pessoa` e `decisor` daquele lead (`nome` é o original do Maps) |
| "por que essa empresa saiu da lista?" | consulte `motivo_requisitos` e `motivo_nicho` daquele lead |
| "abre o painel" / "me mostra na tela" | `cd painel && npm install` (só na primeira vez) e `npm run dev` em segundo plano; mande o link <TROQUE_PELO_SEU_NEXT_PUBLIC_APP_URL>. A ficha de um lead é `/lead/<id>` |

Os filtros se combinam: `--classe A --site com --oportunidade alta`.

### Muda o mundo — mostre o plano e espere o "sim"

| O dono pede | O comando | Por que confirmar |
|---|---|---|
| "busca empresas de X em Y" | `node prospectar.mjs buscar --nicho <nicho> --praca "<Cidade UF>"` | gasta cota do Google (1.000 buscas grátis por mês; depois cobra) |
| "enriquece a lista" | `node prospectar.mjs enriquecer --nicho <nicho> --limite <n>` | leva ~3 s por empresa; guarda o texto do site para **você** ler depois (`ia`) |
| "procura o que faltou no Google" / "acha o Instagram deles" | `node prospectar.mjs pesquisar --nicho <nicho>` | **gasta buscas** (Serper, se tiver a chave; senão Apify, US$ 0,0045 cada) (no máximo 3 por coisa procurada: achou, para; não achou na terceira, é não encontrado); procura site, Instagram e LinkedIn (este só se pesa no nicho). Grava `pesquisa` com o caminho de cada lead |
| "limpa os nomes" / "lê os sites" / "faz os ganchos" | `node prospectar.mjs ia pendentes --nicho <nicho>`, você preenche, `ia gravar` | é trabalho **seu** (seção "A vez da IA"); escreve `nome_empresa`, `nome_pessoa`, `resumo_site`, `porte_estimado` e `abordagem_instagram` |
| "olha o Instagram deles" | `node prospectar.mjs instagram --nicho <nicho>` | **gasta crédito do Apify** (~US$ 0,03 a cada 10 perfis); grava seguidores, posts e último post (os ganchos são seus, na vez da IA) |
| "quem está anunciando?" | `node prospectar.mjs anuncios --nicho <nicho>` | **gasta crédito do Apify** (até 5 anúncios por empresa); busca na Biblioteca de Anúncios da Meta pelo nome |
| "puxa o CNPJ / quem é o dono" | `node prospectar.mjs cnpj --nicho <nicho> --classe A` | procura pelo nome e consulta a Receita; ~3 por minuto quando a API gratuita principal cai |
| "relê os leads antigos" | `node prospectar.mjs enriquecer --nicho <nicho> --refazer` | revisita quem foi enriquecido antes da tag de site existir |
| "muda os requisitos" | edite `requisitos` em `nichos/<nicho>.json` e rode `validar` | muda quem entra na lista |
| "faz tudo" | `node prospectar.mjs rodar --nicho <nicho> --praca "<Cidade UF>"` | é buscar + enriquecer + **pausa para você** + pesquisar + validar + cnpj + instagram + validar + **pausa para você** + listar + exportar (só com `APIFY_TOKEN` faz tudo; `GOOGLE_PLACES_API_KEY` e `SERPER_API_KEY`, se existirem, assumem o Maps e a pesquisa para economizar). Depois de cada pausa: `rodar --continuar`. **Não roda `anuncios`** |
| "olha o TikTok / Facebook deles" / "porte no LinkedIn" | não existe comando pronto: proponha a opção de `OPCOES.md` (ator do Apify), o custo e o campo que ele muda no critério | só construa depois do "sim"; o dado tem que mudar uma decisão do `MEU-CLIENTE-IDEAL.md` |
| "separa quem não é do nicho" | `node prospectar.mjs validar --nicho <nicho>` | escreve o veredito no banco |
| "cria um nicho de X" / "meu cliente ideal" | as perguntas da seção 2, depois `nichos/<nicho>.json` | os termos definem o custo; os critérios, o resultado |

**Todo comando para em 10 empresas.** É de propósito: a primeira rodada é para ver a lista, não para
gastar. Volume é `--limite 200`, e só com o "sim" do dono.

### A ordem correta, sempre

```
cliente ideal -> buscar -> enriquecer -> IA (nomes + sites) -> pesquisar -> validar -> cnpj -> instagram -> validar
              -> IA (ganchos) -> listar -> exportar
                                                                     (camada extra, só se o dono pedir: anuncios)
```

`pesquisar` vem logo depois do `enriquecer`: o site que ela acha muda a nota e o filtro de nicho.
Tudo que ela acha é pista até ser conferido (site pelo telefone do Maps, Instagram pelo perfil, CNPJ pelo CEP).

`instagram` vem **depois** do primeiro `validar`, para não pagar perfil de quem já saiu da lista, e
pede um **segundo** `validar`, porque seguidores é requisito. `anuncios` fica fora do exemplo da aula:
rode depois do `validar`, só quando anúncio ativo muda o critério do dono.

`validar` **antes** de `listar`. Score alto no nicho errado é pior que score baixo. É o `validar`
também que aplica os requisitos do nicho (faixa de avaliações, celular).

### A vez da IA — é você

Nesta pasta **a IA é você**, a que está conversando com o dono (Claude Code, Codex, Antigravity, qualquer
uma). Não existe chave de IA para configurar. O script faz o trabalho duro e, quando chega no que só uma IA
resolve, para e escreve `saidas/ia-<nicho>.json`:

| Bloco | O que você preenche | Para quê |
|---|---|---|
| `nomes` | `empresa` e `pessoa` | o nome curto da abordagem ("é da Clínica X?") |
| `sites` | `resumo` e `porte` | o filtro de nicho decide pelo resumo, então vem **antes** do `validar` |
| `instagram` | `leitura` e 3 `ideias` | os ganchos da primeira conversa |

1. Leia o arquivo. Cada bloco tem a `regra`, e ela manda: siga à risca, use só o que está no item, não invente.
2. Preencha só os campos `resposta` e salve o mesmo arquivo. Não apague itens nem mude o `id`.
3. Rode `node prospectar.mjs ia gravar --nicho <nicho>`. Se ele disser que ainda falta, o arquivo novo já está lá: repita.
4. Veio do `rodar`? Siga com `node prospectar.mjs rodar --nicho <nicho> --continuar` (não busca de novo).

Isso **não** precisa do "sim" do dono: não gasta crédito nenhum. Avise em uma linha ("li 10 sites e limpei
10 nomes") e siga. Com muitas empresas, o arquivo vem em lotes de 20 por tarefa. `--pular-ia` roda o `rodar`
sem parar, e a lista sai sem nome curto nem resumo; só use se o dono pedir.

## 1.1 O painel — a lista numa tela

`painel/` é um app Next.js que **só lê** `prospeccao.leads`: a lista (`/`) e a ficha de cada empresa
(`/lead/<id>`). Quem grava continua sendo o `prospectar.mjs`. Ele usa o `SUPABASE_DB_URL` do `.env.local`
desta pasta, sem chave nova, e pede Node 20 ou mais novo.

Quando o dono pedir para personalizar ("minhas cores", "meu nome", "tira essa coluna"), siga
`docs/o-painel.md`: ele diz qual arquivo muda cada coisa. Mostre o antes e o depois de cada mudança
e rode `npm run typecheck` dentro de `painel/` no fim.

- Aparência e texto se mudam no painel. **Quem entra na lista e quanto vale cada sinal, não**: isso é
  o JSON do nicho e o `validar`. Se o pedido é esse, diga e mude lá.
- **Nunca ponha o painel na internet sem login.** Tem contato de dezenas de empresas. Se o dono quiser
  abrir de fora, proponha o login primeiro e só publique com o "sim" dele.
- **Nunca crie botão que grava no banco ou que manda mensagem.** O botão de WhatsApp só abre a conversa
  no aparelho do dono (trava 5 da seção 4).

---

## 2. O cliente ideal — antes de qualquer nicho novo

Ofereça os dois caminhos na primeira conversa, com uma frase cada:

1. **Igual à aula** — roda `clinica-odontologica` como veio. Serve para ver a máquina funcionando.
2. **O seu** — você faz as perguntas de `MEU-CLIENTE-IDEAL.md` e monta o nicho dele.

Conduzindo o caminho 2:

- **Uma pergunta por vez**, na ordem do documento. Dê o exemplo da aula quando ele travar.
- **Resposta vaga não vira campo.** "Empresas de saúde" → pergunte qual. "Empresas médias" → pergunte
  quantas avaliações no Google.
- Resposta ✅ vai para o campo que o documento indica. Resposta 📝 (ticket, tempo de empresa,
  seguidores, frequência de post, quem já é cliente) vai para o campo `observacao` do JSON, em
  frases — a máquina ainda não mede isso, e o dono precisa ler antes de ligar.
- **Mostre o JSON inteiro e explique cada requisito em uma linha** antes de salvar. Depois mostre os
  termos e pergunte se busca — com `--limite 10`.

## 2.1 Os campos do nicho

Copie `nichos/energia-solar.json` ou `nichos/clinica-odontologica.json` e troque os campos.

| Campo | Regra |
|---|---|
| `termos` | **6 termos variados.** O Google devolve no máximo 60 resultados por termo; um termo só faz o dono achar que o nicho é pequeno |
| `pracas_sugeridas` | `"Cidade UF"`, com espaço e sigla em maiúscula |
| `pesos` | somam 100. Ajuste ao nicho: clínica local não tem LinkedIn, então lá ele vale 0 |
| `aderencia.confirma` | o que **prova** que é do nicho. Radical curto pega variação (`odontolog`) |
| `aderencia.descarta_forte` | identidade que elimina na hora. **Só expressão fechada** |
| `aderencia.descarta` | suspeita; só decide se não houve confirmação |

| `requisitos.avaliacoes_min` / `avaliacoes_max` | a faixa do lead "do meio". Pergunte ao dono; os exemplos usam 16 e 349 |
| `requisitos.exige_celular` | `true` se a abordagem é ligação ou WhatsApp |
| `requisitos.seguidores_min` / `seguidores_max` | `null` não julga. Só reprova quem teve o perfil lido pelo `instagram` |
| `requisitos.exige_site` | deixe `false`, a menos que o dono só venda para quem já tem site. Sem site é **outra venda**, não lead ruim |

**Ao criar o nicho, pergunte ao dono o que ele vende.** Se vende site, o lead dele é `--site sem`.
Se vende tráfego, é `--site com --oportunidade alta`. Detalhes: `docs/requisitos-e-tag-de-site.md`.

🔴 **A regra que mais erra:** `descarta_forte` com palavra solta derruba cliente bom. `"curso"`
elimina a instaladora que instala **e** dá curso. Use `"formar profissionais"`.

🔴 **Nunca ponha em `descarta` o que é CLIENTE do nicho.** Uma instaladora que atende condomínios
diz "condomínio" no site — isso é quem ela atende, não o que ela é.

**Sempre mostre os termos ao dono antes de buscar.** Termo ruim gasta dinheiro e traz lista errada.

---

## 3. O que precisa estar configurado

| Precisa | Para | Como checar (read-only) |
|---|---|---|
| `.env.local` com as 2 chaves (Apify e Supabase) | tudo | `node -e "import('./lib/env.mjs').then(m=>console.log(Object.keys(m.env)))"` |
| `APIFY_TOKEN` | `buscar` (Maps), `pesquisar` e a busca de CNPJ (Google), `instagram` e `anuncios` | **o caminho padrão: uma conta faz a coleta inteira.** O cabeçalho do `buscar` diz "(Maps pelo Apify)" |
| `GOOGLE_PLACES_API_KEY` | `buscar` | opcional, para **economizar** o Apify: preenchida, o Maps passa a ser por ela (1.000 buscas grátis/mês, mas o Google Cloud pede cartão) |
| `SERPER_API_KEY` | `pesquisar` e a busca de CNPJ | opcional, para **economizar** e ganhar velocidade: preenchida, a pesquisa passa a ser por ela (2.500 grátis, sem cartão) |
| `BUSCA_EMPRESAS` / `PESQUISA_GOOGLE` | forçar `apify`, `google` ou `serper` | vazias = escolhe sozinho: a chave de economia se existir, senão o Apify |
| `SUPABASE_DB_URL` | tudo | `node prospectar.mjs listar --nicho <qualquer>` responde a tabela vazia |
| schema aplicado | tudo | o comando acima não reclama de relação inexistente |

**Se o schema não existir:** aplique os arquivos de `sql/`, de `001` a `010`, nessa ordem, no
projeto Supabase do dono. Mostre o SQL antes de aplicar. Todos usam `IF NOT EXISTS`: reaplicar não estraga nada.

### Conduzindo a configuração

Quando o dono mandar "oi" numa pasta sem `.env.local`, conduza o `COMECE-AQUI.md` **um passo por
vez**: diga o que vai precisar, dê o link da tela, espere ele colar a chave, escreva no `.env.local`
e rode o comando de checagem da tabela acima antes de ir para o próximo. Nunca repita a chave dele
na conversa depois de gravada.

---

## 4. As travas — o que você NUNCA faz sozinho

1. **Nunca rode `buscar` ou `rodar` sem o dono confirmar o nicho e a praça.** Custa dinheiro.
2. **Nunca crie nicho e busque no mesmo passo.** Os termos e os requisitos passam pelo dono primeiro.
   **Nunca invente critério de cliente ideal** que ele não disse: pergunte.
3. **Nunca aplique SQL sem mostrar o arquivo.**
4. **Nunca escreva `.env.local` no git.** Nem cole chave em documento, commit ou mensagem.
5. **Este kit não manda mensagem para ninguém.** Não existe comando de abordagem aqui, e não
   invente um. Se o dono pedir disparo, diga que é outra ferramenta e outra decisão.
6. **Nunca apague lead.** Empresa fora do nicho fica marcada, não deletada.
7. **Nunca "conserte" o score mexendo no código.** A régua mora no JSON do nicho.
8. **Nunca afirme na abordagem o que a máquina só supôs.** "Não anuncia" e "perfil parado" são leituras;
   os ganchos de `abordagem_instagram` são sugestão da IA, e o dono confere antes de usar.

## 4.1 Aprendizados — a pasta melhora com o uso

Ao fim de toda rodada, se algo surpreendeu (lead bom reprovado, empresa de outro ramo que passou, dado
errado, custo acima do esperado), **proponha ao dono uma linha em `APRENDIZADOS.md`**, na seção "Os seus
aprendizados": `data · o que aconteceu → o que mudou`. Se o aprendizado pede ajuste de régua, mostre a
mudança no JSON do nicho junto. Leia o arquivo antes de mexer em requisito, peso ou aderência.

---

## 5. As armadilhas — o erro × o que ele significa

| O erro devolve | O que é de verdade | Conserto |
|---|---|---|
| `ERR_MODULE_NOT_FOUND: Cannot find package 'pg'` | as dependências não foram instaladas — é sempre o primeiro erro | `npm install` na pasta |
| `Faltam chaves no .env.local` | o arquivo não existe, ou o nome da variável está diferente | copie `.env.exemplo` para `.env.local` |
| `buscar` falha com "Falta a chave para achar as empresas" | não tem `APIFY_TOKEN` nem `GOOGLE_PLACES_API_KEY` | preencha o `APIFY_TOKEN` (o caminho mais simples) |
| `listar --nicho <inexistente>` devolve 0 leads em vez de erro | `listar` lê o banco, não o arquivo do nicho: 0 leads é a resposta correta | confira o nome com `ls nichos/` |
| busca devolve 0 empresas | pelo Google Places: a **Places API (New)** não está ativada — a antiga não serve. Pelo Apify: termo ou praça que o Maps não reconhece | ative e espere um minuto / reescreva o termo |
| a pesquisa no Google demora | é o Apify: cada execução leva ~20 s para subir (as buscas vão em lote e 5 leads ao mesmo tempo) | não é travamento. Quer rápido: `SERPER_API_KEY` |
| `REQUEST_DENIED` ou 403 na busca | chave restrita a outra API, ou a outro domínio | revise a restrição da chave |
| `relation "prospeccao.leads" does not exist` | o schema não foi aplicado | rode os três SQL de `sql/` |
| `column "situacao_site" does not exist` | faltou o `003-site-e-requisitos.sql` | aplique ele |
| `column "nome_empresa"` / `"receita"` / `"justificativa_nota" does not exist` | faltou o `005`, o `004` ou o `006` | aplique os que faltam |
| "Ninguém pendente de CNPJ" com lista cheia | `cnpj` só pega lead já `enriquecido` e ainda não consultado | rode `enriquecer` antes, ou `cnpj --refazer` |
| lead com CNPJ vazio e `cnpj_nota` preenchida | não achou, ou achou e o CEP da Receita não bateu com o do Maps | é a trava funcionando: IA inventa CNPJ com facilidade |
| só 10 empresas numa busca | é o limite padrão | `--limite 200` com o "sim" do dono |
| `APIFY_TOKEN inválido (401)` | token copiado errado ou revogado | copie de novo em console.apify.com/settings/integrations |
| `Crédito do Apify acabou (402)` | os US$ 5 do mês acabaram | espere renovar ou assine; não é bug |
| "Ninguém com Instagram pendente" com lista cheia | o @ vem do link no site ou da pesquisa no Google; sem chave de pesquisa (Apify ou Serper) quem não linka o Instagram fica sem | rode `pesquisar` antes |
| `SERPER_API_KEY inválida (401/403)` | chave copiada errada | copie de novo em serper.dev/api-key |
| `Serper 400 … (créditos acabaram)` | as buscas grátis acabaram | recarregue no serper.dev; a rodada para para não gravar lead pela metade |
| `instagram` descartou um @ com "não é da empresa" | o @ veio da pesquisa e o perfil não tem a marca no @, no nome nem na bio | é a trava; se o dono disser que é dela, grave o link à mão em `instagram` |
| site achado na pesquisa não entrou (`pesquisa.descartes`) | o telefone do site não bate com o do Maps | é a trava: site de outra empresa com nome parecido |
| lead sem anúncio, mas o dono jura que anuncia | ele anuncia com uma página de nome bem diferente do nome da empresa | registre em `APRENDIZADOS.md`; a busca é pelo nome |
| `seguidores` vazio e o lead passou nos requisitos | seguidores só reprova quem teve o perfil lido | é de propósito: falta de dado não elimina |
| "Ninguém pendente na Biblioteca" | `anuncios` pede o nome limpo | rode `ia pendentes`, preencha os nomes e `ia gravar` antes |
| todo lead com `situacao_site` vazio | foram enriquecidos antes do SQL 003 | `enriquecer --refazer` |
| quase todo lead sai reprovado | a faixa de avaliações está apertada para o nicho, ou ninguém divulga celular | leia os motivos no `validar` e ajuste `requisitos` com o dono |
| `cannot execute UPDATE in a read-only transaction` | a conexão do pooler herdou um ajuste de outro cliente. O código já se protege; se aparecer, é versão antiga do `lib/db.mjs` | troque a porta da URL de `6543` para `5432` |
| todo lead sem `resumo_site` | a vez da IA foi pulada (`--pular-ia`) ou o `ia gravar` não rodou | `node prospectar.mjs ia pendentes --nicho <nicho>` e siga a seção "A vez da IA" |
| `ia gravar` diz "sem resposta" | algum item ficou com `resposta` vazia (no site, falta o `porte`) | é de propósito: ele volta no próximo `ia pendentes` |
| todo lead `indefinido` no nicho | o nicho não tem `aderencia`, ou nenhum site respondeu | confira o JSON e o `site_vivo` |
| a mesma empresa "de novo" a cada rodada | não é duplicata: o `google_id` é a chave, e ela só atualiza | conte pela linha "já estavam na base" |
| lead com nota boa e site fora do ar | é a bandeira **site morto**: parece estruturada e não é | trate como lead, com outra abordagem |
| `enriquecer` parece travado | 5 sites por vez, ~3 s cada; 100 empresas dão ~5 min | espere |

---

## 6. Onde está escrito o porquê

| Pergunta | Documento |
|---|---|
| por que expressão regular e não IA para achar e-mail? | `docs/por-que-regex-e-nao-ia.md` |
| como o filtro de nicho decide, e por que em três níveis? | `docs/o-filtro-de-nicho.md` |
| de onde vem a nota, e como mudar a régua? | `docs/a-regua-do-score.md` |
| requisitos, tag de site e oportunidade — quem entra e qual venda cabe? | `docs/requisitos-e-tag-de-site.md` |
| as perguntas do cliente ideal e onde cada resposta entra | `MEU-CLIENTE-IDEAL.md` |
| o que as rodadas já ensinaram | `APRENDIZADOS.md` |
| que outras ferramentas servem para cada etapa, e quando trocar | `OPCOES.md` |
| a configuração inicial, na ordem | `COMECE-AQUI.md` |
| o painel: ligar, o que cada tela mostra e onde personalizar | `docs/o-painel.md` |
