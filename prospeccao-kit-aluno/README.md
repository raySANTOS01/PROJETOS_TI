# Máquina de leads — a pasta que acha e qualifica empresas

Você escolhe o nicho e a cidade. Esta pasta acha as empresas no Google Maps, visita o site de cada
uma, colhe e-mail, telefone e WhatsApp, pesquisa no Google o que o site não trouxe (o próprio site,
Instagram, LinkedIn), puxa o CNPJ na Receita, lê o Instagram pelo Apify, pede para
a IA entender o que a empresa vende e devolve tudo com uma nota de 0 a 100.

Pelo mesmo Apify dá para ir além quando o seu critério pedir: anúncio ativo na Meta (já vem como
comando à parte), LinkedIn, TikTok e Facebook.

E ela corta a lista do jeito que você vende: tira quem tem avaliação demais (já tem marketing
rodando) ou de menos, exige celular, e marca cada empresa como **com site, sem site ou site fora do
ar** — e, para quem tem site, se ela **anuncia ou não**.

E mostra tudo num **painel**, no seu computador: a lista com filtros e uma ficha por empresa, com a
nota, o Google, o Instagram, o site, a Receita e o contato, cada assunto com a sua cor. Com as cores
e o nome da sua marca, se você pedir.

**Não é uma lista crua.** É uma lista em que você sabe quais valem a ligação de amanhã, com o nome
curto da empresa ("é da Clínica OSPE?"), o sócio que decide (pelo CNPJ na Receita) e, em português,
o porquê da nota e qual venda cabe ali.

---

## ⭐ O que decide se isto funciona para você

**Isto é um sistema. Quem diz o que é um bom lead é você.** Quantas avaliações no Google, se tem site,
se anuncia, qual rede social pesa mais: a máquina executa o critério que você der. Critério vago, lista vaga.

A IA caça a informação (Google Maps, site, Receita, redes sociais) e julga o que achou pela sua régua.
Ela só julga o que buscou: por isso a primeira decisão é **que informação você precisa**.

Dá para rodar **igual à aula** (o nicho de clínica odontológica já vem pronto) e é assim que você
começa. Mas o resultado vem quando você responde **[MEU-CLIENTE-IDEAL.md](MEU-CLIENTE-IDEAL.md)**:
são as perguntas que viram o arquivo do seu nicho.

---

## O que você precisa ter

| | O que | Onde |
|---|---|---|
| 1 | **Claude Code** instalado (Codex, Antigravity e Cursor também servem) | [claude.com/pricing](https://claude.com/pricing) — é plano pago |
| 2 | **Node.js 20 ou mais novo** (a prospecção roda no 18; o painel pede o 20) | [nodejs.org](https://nodejs.org) |
| 3 | Uma conta no **Apify** | **a única conta de coleta:** acha as empresas no Maps, pesquisa no Google e lê o Instagram. Sem cartão, US$ 5 grátis por mês (~250 empresas) |
| 4 | Um projeto no **Supabase** | camada gratuita resolve |
| 5 | Chave do **Google Places** e/ou do **Serper** (opcional) | só para **economizar** o Apify quando o volume crescer: o Places dá 1.000 buscas grátis/mês (pede cartão), o Serper 2.500 buscas (sem cartão). Preencheu, a máquina usa sozinha |

**Não tem chave de IA.** Quem lê o site, limpa o nome e escreve os ganchos é a IA com quem você conversa.

---

## Como usar

Abra esta pasta no Claude Code e mande um **"oi"**.

O agente lê o `CLAUDE.md`, que foi escrito para ele, e conduz o resto: preenche as chaves, aplica a
tabela no seu Supabase, cria o arquivo do seu nicho, roda a busca e te entrega a lista. Você conversa
em português — não precisa decorar comando nenhum.

Se preferir na mão:

```bash
npm install
cp .env.exemplo .env.local        # e preencha
node prospectar.mjs rodar --nicho clinica-odontologica --praca "Belo Horizonte MG"   # 10 empresas
```

Todo comando para em **10 empresas**, para a primeira rodada custar centavos. Volume é `--limite 200`.

Para ver na tela: `cd painel && npm install && npm run dev` e abra <TROQUE_PELO_SEU_NEXT_PUBLIC_APP_URL>.

---

## A ordem de leitura

1. **`COMECE-AQUI.md`** — a configuração, na ordem, uma vez só.
2. **`MEU-CLIENTE-IDEAL.md`** — as perguntas que transformam a máquina da aula na sua.
3. **`CLAUDE.md`** — não é para você, é para o seu agente. Vale ler para saber o que ele pode.
4. **`APRENDIZADOS.md`** — o que as rodadas já ensinaram. Os seus aprendizados entram lá também.
5. **`OPCOES.md`** — as outras ferramentas que servem para cada etapa, com custo e quando trocar.
6. **`docs/o-painel.md`** — ligar o painel e deixar com a cara da sua marca.
7. **`docs/`** — o porquê de cada decisão, quando você quiser discordar de alguma.

---

## O arquivo que você vai mexer

Um só: `nichos/<seu-nicho>.json`. Ali ficam os termos de busca, as cidades, **os requisitos** (faixa
de avaliações, celular) e **o peso de cada sinal na nota**. Se para o seu negócio e-mail vale mais que Instagram, troque o número e a régua muda —
sem tocar em código.

Vêm dois exemplos prontos, e eles são diferentes de propósito: em `energia-solar.json` o LinkedIn
pontua, em `clinica-odontologica.json` ele vale zero. Clínica de bairro não tem página de empresa, e
pontuar isso só puniria lead bom. **A régua é de quem prospecta.**

---

## A regra que não se quebra

**Lista não é disparo.** Você vai terminar com o contato de dezenas de empresas e vai ser tentado a
mandar mensagem para todas de uma vez. Disparo em massa para lista fria é o caminho mais rápido de
perder o seu número — e esta pasta, de propósito, **não tem comando de envio**. Ela entrega o corte
para você abordar com critério, começando pelas classe A.

Os dados colhidos são públicos e de empresa, não de pessoa física: é o que está no Google Maps e no
site que a própria empresa publicou. Trate como tal.

---

## Quando a lista precisa se refazer sozinha

Rodar isso toda segunda-feira sem abrir o computador é o mesmo Claude Code, agendado numa máquina
que não dorme. Se você for por esse caminho, a hospedagem que eu uso e indico é a Hostinger:
[contrate por aqui com 10% OFF, cupom `PEDROALMEIDA`](https://www.hostg.xyz/aff_c?offer_id=6&aff_id=214984&url_id=5038).

---

## O que esta pasta NÃO faz

| Não faz | Por quê |
|---|---|
| mandar mensagem para o lead | é outra ferramenta e outro risco |
| garantir o Instagram de todo mundo | ele vem do site ou da pesquisa no Google; perfil sem a marca no @, no nome ou na bio é descartado de propósito |
| garantir que "não anuncia" é verdade | a busca é pelo nome da empresa; quem anuncia com página de outro nome escapa |
| garantir o CNPJ de toda empresa | ele é procurado pelo nome e só entra se o CEP da Receita bater com o do Maps; o resto fica em branco, com o motivo |
| pessoa física | isso é uma máquina de empresa com endereço |
