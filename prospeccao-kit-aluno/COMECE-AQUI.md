# Comece aqui — a configuração, uma vez só

São quatro passos, e só duas contas: Apify e Supabase. Depois deles você nunca mais volta neste arquivo.

**O caminho fácil:** abra esta pasta no Claude Code e mande um "oi". Ele conduz os quatro passos
falando com você. Este documento é para quando você quiser entender ou conferir o que ele fez.

---

## Passo 1 — Deixar a pasta pronta

```bash
npm install
cp .env.exemplo .env.local
```

O `.env.local` é onde as suas chaves moram. Ele **nunca** vai para o git — já está bloqueado.

✅ **Deu certo quando:** `node prospectar.mjs` responde mostrando os comandos disponíveis.

---

## Passo 2 — A chave do Apify (uma conta faz a coleta inteira)

O Apify é uma loja de raspadores prontos. Com **um token só**, a máquina:

- acha as empresas no **Google Maps** (nome, telefone, site, nota, avaliações, endereço);
- **pesquisa no Google** o que o Maps e o site não trouxeram (site, Instagram, LinkedIn, CNPJ);
- lê o **Instagram** de cada empresa (seguidores, posts, se está parado).

A conta é **sem cartão** e o plano gratuito dá **US$ 5 por mês**, que renovam sozinhos. Uma empresa
com tudo custa perto de US$ 0,02 (US$ 0,004 no Maps, US$ 0,0045 por busca no Google, US$ 0,0026 no
Instagram): dá umas **250 empresas por mês** sem pagar nada.

1. Crie a conta em [apify.com](https://apify.com).
2. Abra [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations) e copie o **Personal API token**.
3. Cole em `APIFY_TOKEN` no `.env.local`.

✅ **Deu certo quando:** o `rodar` do passo 5 mostra "(Maps pelo Apify)" no cabeçalho e devolve empresas de verdade.

Fora da aula, o mesmo token serve para mais: o comando `anuncios` procura **anúncio ativo** na
Biblioteca de Anúncios da Meta, e o agente consegue ligar raspadores de LinkedIn, TikTok e Facebook
quando o seu cliente ideal pedir.

---

## Passo 3 — O banco (Supabase)

É onde os leads ficam, e é o que faz a mesma empresa não entrar duas vezes.

1. Crie um projeto em [supabase.com](https://supabase.com). A camada gratuita resolve.
   **Guarde a senha do banco** que ele pede na criação — ela vai no próximo item.
2. **Project Settings → Database → Connection string → URI.** Copie.
3. No que você copiou, troque `[YOUR-PASSWORD]` pela senha do item 1.
4. Cole em `SUPABASE_DB_URL` no `.env.local`.
5. Aplique a tabela. Peça ao agente — *"aplica os SQL da pasta sql no meu Supabase"* — ou faça na
   mão, no **SQL Editor** do painel, os arquivos de `sql/` na ordem do número (`001` a `010`).

✅ **Deu certo quando:** `node prospectar.mjs listar --nicho energia-solar` responde
"0 leads" em vez de reclamar que a tabela não existe.

---

## Passo 4 — A IA: nada para configurar

Não tem chave de IA. Quem lê o site e diz o que a empresa vende, limpa o nome ("Clínica OSPE" em vez de
"DENTISTA CENTRO - Dr. Paulo Mendes Clínica OSPE - implantes") e escreve os ganchos do Instagram é **a IA
com quem você está conversando**: o Claude Code, o Codex, o Antigravity, a que você usar.

O script faz o trabalho duro e, quando chega nessa parte, para e deixa um arquivo em `saidas/` para ela
preencher. Você não precisa fazer nada: o agente vê a pausa, lê, preenche e segue sozinho.

✅ **Deu certo quando:** depois da primeira rodada, os leads têm o nome curto e a coluna `resumo_site` preenchida.

---

## Passo 4.1 — Gastar menos: Google Places e Serper (opcional)

Tudo já funciona só com o Apify. Estas duas chaves são para depois, quando o volume crescer e você quiser
**economizar o crédito do Apify**. Preencheu, a máquina passa a usar a chave no lugar do Apify, sozinha.

**Google Places — acha as empresas.** O Google dá **1.000 buscas grátis por mês**, cada uma com até 20
empresas, mas **pede cartão cadastrado** no Google Cloud. Passou do grátis, são US$ 35 a cada mil buscas:
vale criar um alerta de orçamento no Faturamento.

1. Entre em [console.cloud.google.com](https://console.cloud.google.com) e crie um projeto.
2. **APIs e serviços → Ativar APIs → procure "Places API (New)"** e ative.
   🔴 Tem que ser a **New**. A Places API antiga existe, aparece primeiro na busca e **não serve** —
   se você ativar a errada, a busca devolve zero empresas sem dizer o motivo.
3. **Credenciais → Criar credencial → Chave de API.**
4. **Restrinja a chave** ali mesmo: em "Restrições de API", escolha só a Places API (New).
   🔴 Chave sem restrição que vaza é outra pessoa gastando o seu crédito. São dez segundos.
5. Cole em `GOOGLE_PLACES_API_KEY`.

✅ **Deu certo quando:** o cabeçalho do `buscar` mostra "(Maps pelo Google Places)".

**Serper — pesquisa no Google.** A conta nova vem com **2.500 buscas grátis**, sem cartão, e responde em
menos de um segundo (o Apify leva uns 20 segundos por lote).

1. Crie a conta em [serper.dev](https://serper.dev).
2. Copie a chave em [serper.dev/api-key](https://serper.dev/api-key).
3. Cole em `SERPER_API_KEY`.

✅ **Deu certo quando:** a etapa 🔍 mostra "Pesquisa no Google (Serper)".

**Como a pesquisa no Google trabalha, com qualquer um dos dois:** ela entra no que o Maps e o site não
trouxeram — o **site** de quem não divulgou no Maps, o **Instagram** que o site não linka, o **LinkedIn** e o
**CNPJ**. Na rodada de teste, 8 de 10 clínicas tinham Instagram que o site não mostrava. Tudo que a
pesquisa acha é conferido antes de valer: o site pelo telefone do Maps, o Instagram pelo perfil, o CNPJ pelo
CEP da Receita. Cada coisa procurada tem no máximo **3 buscas**, cada uma num formato diferente: achou,
para; não achou na terceira, fica como não encontrado.

Quer usar o Apify mesmo com a chave preenchida? `BUSCA_EMPRESAS=apify` ou `PESQUISA_GOOGLE=apify` no
`.env.local`. Outras ferramentas (SerpAPI, a busca na web da sua própria IA) estão em `OPCOES.md`.

---

## Passo 5 — A primeira rodada

Comece com um dos nichos que já vêm prontos, para provar que está tudo ligado antes de escrever o seu.

```bash
node prospectar.mjs rodar --nicho clinica-odontologica --praca "Belo Horizonte MG"
```

Um comando faz tudo, na ordem da aula: busca no Google Maps, visita os sites, **para para a IA ler** os sites
e limpar os nomes, pesquisa no Google o que faltou, tira quem não é do nicho, puxa o CNPJ, lê o Instagram,
**para de novo** para a IA escrever os ganchos, mostra a lista e exporta a planilha. Cada pausa termina com
`node prospectar.mjs rodar --nicho clinica-odontologica --continuar` (o agente faz isso por você). **Para em 10
empresas**, de propósito: você vê o resultado inteiro gastando centavos.

Anúncio ativo não entra no `rodar`. Quando quiser, é um comando à parte: `node prospectar.mjs anuncios --nicho clinica-odontologica`.

Gostou? `--limite 200` traz o volume de verdade.

Depois de ver a lista, experimente os cortes. Cada um responde uma venda diferente:

```bash
node prospectar.mjs listar --nicho clinica-odontologica --site sem              # quem compra site
node prospectar.mjs listar --nicho clinica-odontologica --oportunidade alta     # tem site e não anuncia
```

⏱️ O `enriquecer` leva cerca de três segundos por empresa, cinco ao mesmo tempo. Cem empresas dão
uns cinco minutos. **Não é travamento, é o trabalho acontecendo.**

📤 O CSV cai em `saidas/`, com a marca que faz o Excel abrir os acentos certos. As colunas
`justificativa_nota` e `justificativa_oportunidade` dizem, em português, por que cada empresa tirou
aquela nota e qual venda cabe nela.

---

## Passo 5.1 — Ver no painel

A planilha diz quem. O painel mostra por quê: cada empresa numa ficha, com a nota, o Google, o
Instagram, o site, a Receita e o contato. Ele usa o mesmo `.env.local`, sem chave nova. Pede **Node 20
ou mais novo** (`node -v`).

```bash
cd painel
npm install
npm run dev
```

Abra **<TROQUE_PELO_SEU_NEXT_PUBLIC_APP_URL>**. Ou peça ao agente: *"abre o painel"*.

✅ **Deu certo quando:** a lista aparece com as empresas da rodada e, clicando numa, abre a ficha.

Para deixar com as cores e o nome da sua marca, peça ao agente *"deixa o painel com a minha cara"*.
O que dá para mudar, e onde, está em `docs/o-painel.md`.

---

## Passo 6 — O seu cliente ideal

Até aqui você rodou a máquina **da aula**. Agora ela vira a sua. Peça ao agente:

> *"quero montar o meu cliente ideal"*

Ele faz as perguntas de `MEU-CLIENTE-IDEAL.md`, uma por vez: o que você vende, quem compra, quantas
avaliações no Google é pequeno ou grande demais, se precisa ter site, se anunciar conta a favor ou
contra. Com as respostas, ele monta o `nichos/<seu-nicho>.json` e mostra antes de salvar.

**Este é o passo que decide o resultado.** Responda com número, não com "empresas médias".
**Confira os termos de busca antes de mandar buscar** — termo ruim gasta dinheiro e traz lista errada.

E leia `docs/o-filtro-de-nicho.md` antes de mexer nas três listas de aderência. É o pedaço onde é
mais fácil derrubar cliente bom sem perceber.

---

## Se algo der errado

| O que você vê | O que é |
|---|---|
| `Faltam chaves no .env.local` | o arquivo não existe ou o nome da variável está diferente |
| a busca devolve 0 empresas | pelo Google Places: ativou a Places API antiga em vez da **New**. Pelo Apify: o termo ou a praça não existem no Maps |
| `REQUEST_DENIED` / 403 | a restrição da chave não inclui a Places API (New) |
| `relation "prospeccao.leads" does not exist` | o passo 3.5 não foi feito |
| nenhum lead com resumo | a pausa da IA foi pulada: peça ao agente *"roda a vez da IA"* (`ia pendentes` → preencher → `ia gravar`) |
| o `rodar` parou com "🤖 Vez da IA da conversa" | não é erro: é a pausa para a IA ler. O agente preenche e segue com `--continuar` |
| todos os leads como "indefinido" | nenhum site respondeu, ou o nicho está sem regra de aderência |
| o painel não abre ou abre vazio | veja o fim de `docs/o-painel.md` |

Cole o erro na conversa com o seu agente. Resolver o que quebra também é trabalho dele.
