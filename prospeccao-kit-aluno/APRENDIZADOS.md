# Aprendizados da prospecção

> Os aprendizados abaixo vieram das rodadas de quem montou esta pasta. **Os seus entram na última
> seção**, no mesmo formato. É este arquivo que faz a máquina melhorar com o uso.

O que as rodadas ensinaram e o código sozinho não conta. **Leia antes de mexer em régua, filtro ou
integração.** Terminou uma rodada com surpresa (lead bom descartado, dado que mentiu, custo fora do
previsto)? Registre aqui, no mesmo dia, e diga o que mudou por causa disso.

Formato: **data · o que aconteceu → o que mudou.**

---

## Régua e requisitos

- **14/set/2026 · Google Analytics contava como anúncio** → 37 de 46 clínicas saíram "já anuncia". Só pixel
  da Meta e tag de conversão do Google Ads contam.
- **14/set/2026 · o lead bom é o do meio** → faixa de 16 a 349 avaliações. Abaixo, mal existe; acima, já tem marketing.
- **14/set/2026 · sem site não é lead ruim, é outra venda** → `exige_site: false` e a tag `situacao_site`.
- **15/set/2026 · empresa com 1 milhão de seguidores não precisa de quem vende marketing** → `requisitos.seguidores_min/max`.
  Ainda sem número definido nos nichos: é pergunta do cliente ideal.

## Dados que mentem

- **18/set/2026 · um atacadista passou como clínica, com nota 100.** Uma loja que vende produtos
  odontológicos **para dentistas** (fornecedora do nicho, não o nicho) entrou pela busca "ortodontia aparelho".
  O `descarta_forte` tinha "produtos odontológicos", mas o site dizia "produtos, equipamentos e instrumentais
  odontológicos": expressão fechada não pega a mesma ideia com palavras no meio. A Receita entregava
  ("Comércio atacadista de produtos odontológicos"; as clínicas dizem "Atividade odontológica"), só que o
  `validar` roda antes do `cnpj` e nunca relê a atividade. A categoria "Loja" do Maps não decide sozinha:
  uma clínica de verdade também estava como "Loja".
  → Pendente: o `validar` ler `receita.atividade` e barrar "comércio atacadista", "comércio varejista",
  "fabricação" e "ensino", rodando de novo depois do `cnpj` no `rodar`. A pergunta "você quer o nicho ou
  quem vende para o nicho?" entrou no `MEU-CLIENTE-IDEAL.md`.
- **18/set/2026 · a visão geral do Google deu o CNPJ de outra empresa.** Pesquisando "[nome] cnpj [cidade]", a
  resposta de IA do Google trouxe, com toda a certeza, uma clínica de nome quase igual em outro bairro. O
  `cnpj` achou o certo porque não aceita número sem o CEP da Receita bater com o do Maps. Busca manual
  também erra: confira pelo endereço antes de dizer "achei".
- **15/set/2026 · o nome do Maps é vitrine** ("DENTISTA CENTRO - Dr. Fulano Clínica X - implantes") → `nomes`.
  A abordagem é "esse número é da Clínica X?", e o nome cheio denuncia a lista.
- **15/set/2026 · IA inventa CNPJ** → dígito verificador + CEP da Receita igual ao do Maps. Na primeira
  rodada, 2 de 12 achados eram de outra clínica com nome parecido.
- **15/set/2026 · a página que anuncia muitas vezes não é a ligada ao Instagram** → a Biblioteca de Anúncios é buscada
  pelo nome da empresa, e o anúncio conta se a página tem a marca ou leva ao site/@ dela.
- **15/set/2026 · o site não linka o próprio Instagram** → 8 de 10 clínicas tinham Instagram e o site não
  mostrava o link. A pesquisa no Google (`pesquisar`) achou os 8 em 16 buscas, e o @ passa pela conferência do perfil.
- **15/set/2026 · o que o Gemini não achou, o Google achou** → CNPJ em 2 de 4 empresas onde a busca do Gemini
  tinha voltado vazia. Agora o `cnpj` tenta primeiro os números que aparecem nos resultados do Serper.
- **14/set/2026 · o Gemini muda de ideia** → a mesma clínica saiu distribuidora numa leitura e clínica na outra.
  O filtro de nicho decide por regra, e o resumo da IA é só insumo.

## Integrações

- **18/set/2026 · a chave de IA quebrou e a lista saiu pela metade, sem aviso.** Por três dias a chave da API
  do Gemini deu 401, o código tratava a IA como enfeite e seguia: nome curto, resumo do site e ganchos do
  Instagram saíram vazios, e ninguém viu. → A IA deixou de ser API: é a IA da conversa (Claude Code, Codex,
  Antigravity), pelo comando `ia`. Sem chave para quebrar, e o `rodar` **para e avisa** quando falta a leitura.
- **18/set/2026 · "a IA não está usando as APIs" era o limite de 10.** Todo comando para em 10 leads para o
  teste sair barato; quem roda assim e para ali fica com a maior parte da lista sem pesquisa, sem CNPJ e sem
  Instagram, e parece que a chave não funciona. Rodada de verdade: `--limite 200` em cada etapa. E chave que
  existe no n8n não existe na CLI até alguém copiar para o `.env.local`.
- **18/set/2026 · a Receita tem um telefone que o site não mostra.** O cadastro do CNPJ traz o telefone e o
  e-mail que a empresa declarou, muitas vezes do dono ou do contador. O `cnpj` guarda em `receita.telefones`
  e `receita.email`.
- **15/set/2026 · BrasilAPI devolve 403 sem User-Agent.**
- **15/set/2026 · a API oficial do Instagram só lê outras contas com login do Facebook e Página ligada**
  (`business_discovery`) → Apify, que lê qualquer perfil público.
- **14/set/2026 · pooler do Supabase vazou `read_only`** → `BEGIN READ WRITE` em toda consulta.

## Integrações

- **19/set/2026 · três contas viraram uma (Apify)** → o Maps (`compass~crawler-google-places`) e a pesquisa
  no Google (`apify~google-search-scraper`) pelo mesmo token do Instagram; Places e Serper ficaram como
  economia, usados sozinhos quando a chave existe. Rodada de teste, 5 clínicas de Campinas só com
  `APIFY_TOKEN` + `SUPABASE_DB_URL`: Maps, site, 3 Instagram achados na pesquisa, 2 CNPJ, 3 perfis lidos,
  **US$ 0,09 no total**. O Apify devolve o mesmo place id do Places: dedupe vale entre os dois.
- **19/set/2026 · no Apify, busca avulsa é o gargalo** → cada execução leva ~20 s para subir. O `cnpj`
  em série, com as tentativas 2 e 3 uma por vez, levou **4 min para 5 leads**; adiantando as 3 tentativas
  num lote só, **56 s**. Regra: toda busca previsível vai em lote (`preBuscar`); o `pesquisar` roda 5 leads juntos.

## Os seus aprendizados

<!-- data · o que aconteceu → o que mudou. O agente propõe uma linha aqui ao fim de toda rodada com surpresa. -->

## Critérios citados e ainda não medidos

- Tempo de empresa e porte na Receita como requisito (o dado já vem no `cnpj`).
- Nota média baixa no Google como dor (reputação), não como defeito.
- Várias unidades da mesma marca = rede.
- Agendamento online e plataforma do site (Wix, WordPress).
- TikTok, Facebook e porte no LinkedIn pelo Apify (as opções estão em `OPCOES.md`).
