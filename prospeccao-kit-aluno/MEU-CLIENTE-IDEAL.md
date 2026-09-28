# O seu cliente ideal — o que decide se esta máquina traz resultado

Esta pasta é um **sistema de prospecção**. O código acha, visita, confere e dá nota. Mas quem diz
**o que é um bom lead** é você — e é isso, não o código, que separa uma lista que vira reunião de uma
lista que vira ligação perdida.

> A máquina executa o critério que você der. Critério vago, lista vaga.

---

## Dois caminhos

| | Caminho | Quando escolher |
|---|---|---|
| **1** | **Igual à aula** — usa `nichos/clinica-odontologica.json` como veio | para a primeira rodada: prova que tudo está ligado e mostra como fica a lista |
| **2** | **O seu** — responde as perguntas abaixo e o agente monta o `nichos/<seu-nicho>.json` | assim que a primeira rodada funcionar. **É aqui que está o resultado** |

Para o caminho 2, abra esta pasta no Claude Code e peça:

> *"quero montar o meu cliente ideal"*

O agente faz as perguntas uma a uma, mostra o arquivo do nicho antes de salvar e só busca depois do seu "sim".

---

## O que a máquina consegue ver

Antes de responder, saiba o que dá para medir. A IA faz duas coisas:

1. **Caça a informação**: entra no Google Maps, no site da empresa, na Receita e nas redes sociais.
2. **Julga o que achou**: lê pelo critério que você escreveu, dá a nota e diz o porquê.

Ela só julga o que buscou. Por isso a pergunta que vem antes de todas é:
**que informação você precisa para saber se uma empresa é o seu cliente?**

| Etapa | De onde vem | O que traz | Custo | Na aula |
|---|---|---|---|---|
| 1 · Buscar | Google Maps (Places API) | nome, telefone, endereço, nota e nº de avaliações | grátis até 1.000 buscas por mês (cada uma traz até 20 empresas) | ✅ |
| 2 · Site | o site da própria empresa | e-mail, WhatsApp, Instagram e pixel de anúncio | grátis | ✅ |
| 3 · Leitura | a IA da conversa (a sua) | o que a empresa vende, o porte e o nome curto da empresa e do profissional | o seu plano de IA, sem chave | ✅ |
| 4 · Pesquisa | Google, pelo Serper | o que faltou: site de quem não divulgou, Instagram que o site não linka, LinkedIn, CNPJ | 2.500 buscas grátis ao criar a conta | ✅ |
| 5 · CNPJ | Receita Federal | razão social, sócio que decide, data de abertura, porte | grátis | ✅ |
| 6 · Instagram | Apify | seguidores, posts, último post, engajamento e ideias de abordagem | plano gratuito: US$ 5/mês, ~1.900 perfis | ✅ |
| extra | Apify · Biblioteca de Anúncios | anúncio rodando agora na Meta (comando `anuncios`) | ~US$ 5,80 a cada mil anúncios | ❌ fora do exemplo |
| extra | Apify · LinkedIn, TikTok, Facebook | cargo, porte, frequência de post | depende do raspador | ❌ não vem pronto: peça ao agente |

Cada linha tem outras ferramentas possíveis (Apify no lugar do Google Maps, SerpAPI no lugar do Serper…).
Estão todas em `OPCOES.md`, com custo e quando vale trocar.

**O Apify e o Serper têm limite.** Os US$ 5 do mês e as buscas grátis acabam. Busque o dado que muda a sua decisão, não tudo o que
dá para buscar. Se anúncio ativo não muda quem você liga, não pague por ele.

---

## As perguntas

Cada resposta tem um destino. A coluna **Na máquina** diz se ela já muda a lista hoje (✅) ou se é
anotação sua para a abordagem (📝) — ainda assim vale responder: é o que você vai dizer no telefone.

### 1. O que você vende

| Pergunta | Na máquina | Vira |
|---|---|---|
| Qual serviço você vende? (site, tráfego, automação, atendimento com IA…) | ✅ | decide o corte: quem vende **site** trabalha `--site sem`; quem vende **tráfego**, `--site com --oportunidade alta` |
| Quanto custa, mais ou menos, por mês ou por projeto? | 📝 | quem não fatura o bastante para pagar isso não é lead — pense nisso ao responder as avaliações abaixo |
| Qual resultado você promete? | 📝 | a primeira frase da abordagem |

### 2. Quem compra

| Pergunta | Na máquina | Vira |
|---|---|---|
| Que tipo de empresa? Seja específico: "clínica odontológica", não "saúde" | ✅ | `rotulo` e os `termos` de busca |
| Como o cliente procuraria essa empresa no Google? Liste 6 jeitos | ✅ | `termos` — um termo só traz no máximo 60 empresas |
| Em quais cidades você atende? | ✅ | `pracas_sugeridas` |
| O que prova que a empresa é do ramo? (palavras que aparecem no site) | ✅ | `aderencia.confirma` |
| **Você quer o nicho ou quem vende para o nicho?** (a clínica ou a loja que vende para o dentista) | ✅ | decide o que vai para `confirma` e o que vai para `descarta_forte` |
| O que parece do ramo e **não é** cliente? (fornecedor, escola, franquia, rede grande) | ✅ | `aderencia.descarta_forte` |
| Com quem você fala: o dono, o gerente, o profissional? | 📝 | a coluna `decisor` (sócio-administrador na Receita) e `nome_pessoa` já trazem o nome |

> ⚠️ **O erro que aconteceu na aula.** Buscando "ortodontia aparelho", entrou com nota 100 uma empresa
> que vende produtos odontológicos **para dentistas**. Site no ar, Instagram, WhatsApp, 5 estrelas: tudo
> certo, só que ela não é clínica, é fornecedora da clínica. Quem vende para dentista não é dentista.
> Isso acontece em todo nicho: a busca por energia solar traz a distribuidora de placas, a busca por
> academia traz a loja de suplemento. Decida antes qual dos dois é o seu cliente e escreva isso no JSON.
> Depois, antes de ligar, olhe a **atividade na Receita** (`receita.atividade`, que vem do comando `cnpj`):
> "Comércio atacadista de…" entrega o fornecedor, que o site às vezes esconde.

### 3. O tamanho certo — nem pequeno demais, nem grande demais

O melhor lead costuma ser **o do meio**: já existe no digital, mas o marketing ainda não funciona.

| Pergunta | Na máquina | Vira |
|---|---|---|
| Com quantas avaliações no Google a empresa é pequena demais para pagar você? | ✅ | `requisitos.avaliacoes_min` |
| E com quantas ela já é grande, com agência ou marketing próprio? | ✅ | `requisitos.avaliacoes_max` |
| Você aborda por ligação ou WhatsApp? Então precisa de celular? | ✅ | `requisitos.exige_celular` |
| Você só atende quem já tem site? | ✅ | `requisitos.exige_site` — deixe `false` se sem site é **outra venda** sua |
| Empresa aberta há quanto tempo, no mínimo? | 📝 | a Receita traz a data de abertura em `receita` (comando `cnpj`) |
| Porte na Receita (MEI, ME, EPP) diz algo para você? | 📝 | também vem em `receita` |

### 4. Como está o marketing dela

| Pergunta | Na máquina | Vira |
|---|---|---|
| Ter site no ar conta a favor? Quanto? | ✅ | `pesos.site_vivo` |
| Anunciar (ter pixel da Meta ou do Google Ads) é bom ou ruim para você? | ✅ | a coluna `oportunidade`: sem pixel = alta ou média, com pixel = baixa |
| Anúncio **rodando agora** na Meta muda algo? | ✅ | comando `anuncios` (camada extra, fora do `rodar`): achou anúncio ativo, a oportunidade cai para baixa. Quem vende tráfego quer quem **não** anuncia; quem vende criativo pode querer justamente quem anuncia |
| Instagram, WhatsApp, e-mail, LinkedIn: qual pesa mais no seu nicho? | ✅ | `pesos` — somam 100. Clínica de bairro não tem LinkedIn: lá ele vale 0 |
| Nota no Google abaixo de 4 é problema ou é argumento de venda? | ✅ | `pesos.reputacao` (nota 4,0+ com 10+ avaliações soma) |
| Quantos seguidores no Instagram já é grande demais? E pouco demais? | ✅ | `requisitos.seguidores_max` e `seguidores_min` (comando `instagram`, pelo Apify) |
| Quantos posts ela precisa ter? Postou nos últimos 30 dias? | 📝 | vem escrito em `justificativa_instagram` ("último post há 94 dias: perfil parado"); não elimina ninguém |

### 5. Quem fica de fora de qualquer jeito

| Pergunta | Na máquina | Vira |
|---|---|---|
| Redes, franquias e marcas grandes que nunca vão te contratar? | ✅ | nomes delas em `aderencia.descarta_forte` |
| Quem já é seu cliente ou já disse não? | 📝 | tire da planilha antes de ligar |

---

## A resposta da aula, para comparar

É o `nichos/clinica-odontologica.json`. Não é a resposta certa, é **uma** resposta:

| | Na aula |
|---|---|
| Vende | site para quem não tem, tráfego para quem tem site e não anuncia |
| Quem | clínica e consultório odontológico; fora loja de material, escola, rede e franquia |
| Tamanho | de 16 a 349 avaliações no Google, com celular. Seguidores ainda sem limite (`null`) |
| Pesos | site 25 · Instagram 20 · WhatsApp 15 · e-mail 10 · telefone 10 · reputação 10 · CNPJ 5 · endereço 5 · LinkedIn 0 |

Onde a sua resposta for diferente, o seu JSON é diferente. É para ser.

---

## O critério não fica pronto no primeiro dia

A primeira lista vai errar: vai deixar passar empresa que você nunca atenderia e cortar alguma boa.
Cada erro desses é um critério que você ainda não tinha escrito. Registre em `APRENDIZADOS.md`,
ajuste o JSON e rode de novo. A máquina fica boa com o uso, e o seu cliente ideal fica claro junto.
