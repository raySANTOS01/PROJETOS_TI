# As opções de cada etapa

Cada etapa da máquina tem mais de um jeito de ser feita. Aqui está o que está ligado hoje (✅), o que
dá para trocar e quando vale a pena. **Nada disso é definitivo:** mudou o preço, a cota ou a qualidade,
troque a peça e registre o motivo em `APRENDIZADOS.md`.

A pergunta que decide cada troca é a mesma do cliente ideal: **esse dado muda quem eu ligo?** Se não
muda, não pague por ele.

---

## 1. Achar as empresas

| Opção | Custo | Quando escolher |
|---|---|---|
| ✅ **Apify · Google Maps Scraper** (`compass~crawler-google-places`) | US$ 0,004 por empresa, dentro dos US$ 5/mês grátis | o padrão da aula (19/set/2026): sem cartão, e a mesma conta faz a pesquisa e o Instagram. Traz telefone, site, nota e avaliações |
| ✅ **Google Places API (New)** | 1.000 buscas grátis por mês (até 20 empresas cada), depois US$ 35 a cada mil | **economia**: preencheu `GOOGLE_PLACES_API_KEY`, ela assume sozinha. Pede cartão no Google Cloud |
| Serper · Places | crédito do Serper | se você já usa o Serper e quer uma chave a menos |

## 2. Ler o site

| Opção | Custo | Quando escolher |
|---|---|---|
| ✅ **Leitura própria** (página inicial, /contato, /sobre; contato por regex, resumo pela IA da conversa) | grátis | o padrão: e-mail, telefone e link de rede são padrão de texto, não precisam de IA; o resumo sai do plano da IA que você já usa |
| IA por API (Gemini, OpenAI) chamada pelo script | centavos por lead + uma chave a mais | só se a rodada tiver que acontecer sem ninguém conversando (um agendamento sem agente) |
| Firecrawl (devolve o site em markdown) | pago por página | site que só carrega com JavaScript e volta vazio na leitura própria |

## 3. Pesquisar no Google o que faltou (site, Instagram, LinkedIn, CNPJ)

| Opção | Custo | Quando escolher |
|---|---|---|
| ✅ **Apify · Google Search Scraper** (`apify~google-search-scraper`) | US$ 0,0045 por busca | o padrão da aula: mesma conta do Maps. Mais lento (~20 s por execução), por isso as buscas vão em lote |
| ✅ **Serper** (`SERPER_API_KEY`) | 2.500 buscas grátis ao criar a conta, sem cartão | **economia e velocidade**: preencheu a chave, ele assume sozinho. Menos de 1 s por busca |
| SerpAPI | plano grátis pequeno, depois pago | mesma ideia do Serper, com mais motores (Maps, Imagens) |
| A busca na web da própria IA da conversa | o plano dela | sem conta nova, mas lenta para dezenas de empresas e ela pode inventar número: só vale com a conferência do CEP |
| Agente de IA com o Serper como ferramenta (o jeito do n8n) | Serper + IA por lead | quando a regra fixa errar muito e precisar de alguém "pensando" em cada resultado |

**Como está feito:** sem agente. As sequências de busca são fixas (nome + endereço, depois `site:instagram.com`,
depois o agregador de links…), uma regra lê os resultados e a mesma busca é reaproveitada entre site,
Instagram e CNPJ. No teste de 15/set/2026: 10 clínicas, 16 buscas, 8 Instagram e 1 site achados.

**O que vem da pesquisa é pista até ser conferido:**
- site: só vira site se o telefone dele bater com o do Maps;
- Instagram: o comando `instagram` lê o perfil e descarta quem não tem a marca no @, no nome ou na bio;
- CNPJ: só entra se o CEP da Receita bater com o do Maps.

## 4. O Instagram

| Opção | Custo | Quando escolher |
|---|---|---|
| ✅ **Apify · Instagram Profile Scraper** | US$ 2,60 a cada mil perfis | o padrão: seguidores, posts, bio e últimas legendas sem login |
| Apify · Instagram Reel/Post Scraper + uma IA lendo imagem e vídeo | bem mais caro por lead | quando a abordagem precisa citar o conteúdo dos posts, não só a frequência |
| API oficial da Meta (`business_discovery`) | grátis | só com token de login do **Facebook** ligado a uma conta profissional; o token de login do Instagram não lê outras contas |

## 5. O CNPJ e o sócio

| Opção | Custo | Quando escolher |
|---|---|---|
| ✅ **BrasilAPI**, com **cnpj.ws** de reserva | grátis (a reserva aceita 3 por minuto) | o padrão |
| Receita pelo número achado no site | grátis | é o primeiro caminho, antes de qualquer pesquisa |
| APIs pagas de dados de empresa | por consulta | quando precisar de telefone e e-mail dos sócios, faturamento estimado etc. |

## 6. Camadas extras (fora do exemplo da aula)

| Dado | Opção | Custo |
|---|---|---|
| Anúncio ativo na Meta | ✅ comando `anuncios` (Apify · Facebook Ads Scraper, busca pelo nome da empresa) | US$ 5,80 a cada mil anúncios |
| LinkedIn da empresa | ✅ o link, pela pesquisa no Google (só se o LinkedIn pesa no nicho) · Apify · LinkedIn Company Scraper para porte e funcionários | Serper · crédito do Apify |
| TikTok | Apify · TikTok Profile Scraper | crédito do Apify |
| Página do Facebook | Apify · Facebook Pages Scraper | crédito do Apify |

Não existe comando pronto para TikTok, Facebook e porte no LinkedIn. Peça ao agente: ele propõe o
raspador, o custo e o campo do cliente ideal que o dado muda, e só constrói depois do seu "sim".
