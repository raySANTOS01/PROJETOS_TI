# O painel — a sua lista numa tela

A planilha diz **quem**. O painel mostra **por quê**: cada empresa numa ficha com a nota, o Google, o
Instagram, o site, a Receita e o contato, cada assunto com a sua cor. É a tela que você abre antes de
chamar alguém no WhatsApp.

Ele mora na pasta `painel/` e só **lê** o banco. Quem acha, enriquece e grava é o `prospectar.mjs`.
Rodou a prospecção de novo? É só atualizar a página: o que entrou aparece sozinho.

---

## O que você precisa

| | O que | Por quê |
|---|---|---|
| 1 | A prospecção configurada (o `COMECE-AQUI.md` até o passo 5) | o painel mostra o que ela gravou; banco vazio, tela vazia |
| 2 | **Node.js 20 ou mais novo** | o painel é feito em Next.js, que pede o Node 20. Confira com `node -v` |

Não precisa de chave nova. O painel usa o mesmo `SUPABASE_DB_URL` do `.env.local` da pasta de cima:
a senha do banco continua num lugar só.

---

## Ligar

```bash
cd painel
npm install        # só na primeira vez, leva um minuto
npm run dev
```

Abra **<TROQUE_PELO_SEU_NEXT_PUBLIC_APP_URL>** no navegador.

✅ **Deu certo quando:** aparece a lista com os números no topo (na lista, classe A, com celular,
com Instagram) e, clicando numa empresa, abre a ficha dela.

Para desligar, `Ctrl + C` no terminal.

---

## As duas telas

**A lista (`/`).** As empresas da nota maior para a menor, com filtros de nicho, classe, site,
oportunidade e a busca por nome, cidade, decisor ou celular. Por padrão ela esconde quem é de outro
ramo ou reprovou nos requisitos — o mesmo corte do `listar` sem `--todos`. O chip "Incluir fora do
nicho e reprovados" traz todos de volta, apagados.

**A ficha (`/lead/<id>`).** Uma empresa inteira, com uma cor por assunto:

| Cor | Assunto | De onde vem |
|---|---|---|
| amarelo | Google: nota, avaliações, mapa | `buscar` |
| rosa | Instagram: seguidores, posts, dias sem postar, ganchos de abordagem | `pesquisar` + `instagram` |
| azul | Site: no ar ou não e o raio-x (celular, WhatsApp, pixel, Analytics, rodapé) | `enriquecer` |
| roxo | Receita: razão social, idade, porte, sócios, o telefone declarado | `cnpj` |
| verde | Contato: WhatsApp, telefones, e-mails | `enriquecer` + `cnpj` |
| laranja | A venda que cabe e de onde vem a nota | `enriquecer` + `validar` |

Bloco vazio é etapa que não rodou, não erro. A própria ficha diz qual etapa falta.

---

## Deixar com a sua cara

Peça ao seu agente, em português. Ele sabe onde fica cada coisa; a tabela é para você conferir.

| Você pede | Onde ele mexe |
|---|---|
| "põe as cores da minha marca" | `painel/src/app/globals.css`, no bloco `@theme`: `--color-destaque`, `--color-fundo`, `--color-texto`, `--color-apagado`, e os tons de cartão e borda |
| "troca o nome lá em cima" | `painel/src/app/layout.tsx`, a constante `MARCA` |
| "quero outra fonte" | `painel/src/app/layout.tsx`, o import do `next/font/google` |
| "muda a cor do Instagram / do Google na ficha" | `painel/src/app/lead/[id]/page.tsx`, o objeto `COR` no topo |
| "tira a coluna X / põe a coluna Y na lista" | `painel/src/app/page.tsx`, a tabela |
| "o nome do meu nicho aparece sem acento" | `painel/src/lib/prospeccao.ts`, o dicionário `ACENTOS` |
| "os sinais da nota com outro nome" | `painel/src/lib/prospeccao.ts`, o objeto `SINAIS` (a chave é a mesma do `pesos` do seu nicho) |
| "as classes A, B, C e D com outro rótulo ou cor" | `painel/src/lib/prospeccao.ts`, a lista `CLASSES` |
| "mostra na ficha um dado que a prospecção já grava" | o tipo `LeadProspeccao` em `prospeccao.ts` e um bloco novo na ficha. A consulta já traz todas as colunas da tabela |

**A regra que evita dor de cabeça:** personalização é aparência e texto. Se o que você quer é mudar
**quem entra na lista** ou **quanto cada coisa vale na nota**, isso é no `nichos/<seu-nicho>.json` e no
`validar`, não no painel. O painel só mostra a régua; quem decide é o JSON.

Mexeu e quer conferir que nada quebrou? `npm run typecheck` dentro de `painel/`.

---

## Cuidados

- **Ele roda no seu computador, e é assim que deve ficar.** A lista tem telefone e e-mail de dezenas
  de empresas. Se um dia quiser abrir de fora (celular, sócio), peça ao agente para pôr login **antes**
  de publicar em qualquer lugar. Painel sem senha na internet é a sua lista para quem achar o link.
- **O painel não manda mensagem.** O botão de WhatsApp só abre a conversa no seu WhatsApp; quem escreve
  é você. Não peça botão de disparo em massa: é o caminho mais rápido de perder o número.
- **O painel não grava.** Corrigir um dado (um Instagram errado, por exemplo) é no banco ou rodando a
  etapa de novo com `--refazer`.

---

## Se algo der errado

| O que você vê | O que é |
|---|---|
| `npm run dev` reclama da versão do Node | o Node é mais velho que o 20: atualize em nodejs.org |
| a página abre com erro de conexão ou `password authentication failed` | falta `SUPABASE_DB_URL` no `.env.local` da pasta de cima, ou a senha nela está errada |
| `relation "prospeccao.leads" does not exist` | os SQL de `sql/` não foram aplicados (passo 3 do `COMECE-AQUI.md`) |
| a lista abre vazia | a prospecção ainda não rodou, ou o filtro está apertado: clique em "Todos" |
| a porta 3000 está ocupada | `npm run dev -- -p 3001` e abra http://localhost:3001 |
| o logo da empresa não aparece | ele vem do ícone do site dela; sem site ou sem ícone, entram as iniciais |
| o mapa fica em branco | alguns bloqueadores de anúncio barram o mapa do Google; o link "abrir no Maps" funciona sempre |
