# O filtro de nicho — três níveis, e a ordem entre eles

O problema que este filtro resolve: **score alto no nicho errado é pior que score baixo.**

Quando você busca por texto no Google Maps, vem vizinho de tema junto. Buscando clínica odontológica
vem loja de material dentário, faculdade de odontologia e laboratório de prótese. Todos têm site,
e-mail e reputação. Todos tiram nota alta. **E nenhum é cliente.**

## Quem decide não é o nome

Numa rodada real de energia solar apareceu uma empresa chamada "Energia Solar" com sobrenome, site
no ar e nota alta. Era uma **distribuidora de câmeras de segurança**. O nome no Maps era isca de
busca.

Por isso o filtro lê o **resumo que a IA extraiu do site** — o que a empresa *diz que faz* — e não o
nome nem a categoria do Maps.

## As três listas, na ordem em que decidem

No JSON do seu nicho:

```json
"aderencia": {
  "confirma":       ["odontolog", "dentista", "ortodont"],
  "descarta_forte": ["material odontológico", "formar profissionais", "escola de"],
  "descarta":       ["clínica veterinária", "medicina estética"]
}
```

| Ordem | Lista | O que é | Vence |
|---|---|---|---|
| 1º | `descarta_forte` | **identidade** que elimina na hora | tudo, até a confirmação |
| 2º | `confirma` | a **prova** de que é do nicho | o `descarta` |
| 3º | `descarta` | **suspeita**, só decide se não houve prova | nada |

E há um quarto caso, que não é lista: **a IA leu o site inteiro e não falou do seu nicho.** Isso é
resposta, não dúvida — o lead sai.

## O fornecedor do nicho escapa da expressão fechada

Na rodada da aula, uma loja de produtos odontológicos saiu com nota 100 buscando "ortodontia aparelho".
A lista `descarta_forte` **tinha** `"produtos odontológicos"`. Mas o site dizia *"vende produtos,
equipamentos e instrumentais odontológicos"*: com palavras no meio, a expressão fechada não casou.

Quem entregou o que ela era foi a **Receita**: *"Comércio atacadista de produtos odontológicos"*. As
clínicas de verdade dizem *"Atividade odontológica"*. O resumo do site é o que a empresa **conta**; a
atividade na Receita é o que ela **declarou ser**.

Duas lições:

1. **Decida se o seu cliente é o nicho ou quem vende para ele.** A busca traz os dois.
2. **Nos leads que você vai abordar, confira a atividade da Receita** (o comando `cnpj` a grava em
   `receita.atividade`). "Comércio atacadista", "comércio varejista", "fabricação" e "ensino" costumam
   ser o fornecedor ou a escola do nicho. Se o erro se repetir, peça ao agente para o `validar` ler
   também esse campo.

## Por que `confirma` vence `descarta`

A primeira versão deste filtro barrava qualquer empresa cujo site falasse "condomínio". Ela derrubou
três clientes legítimos de uma vez.

O motivo: "condomínio" no site de uma instaladora não é a identidade dela, é o **cliente** dela —
*"instalamos em casas, empresas e condomínios"*.

🔴 **A regra que sai disso:** nunca ponha em `descarta` uma palavra que descreve **quem o seu nicho
atende**. Ela vai derrubar exatamente os leads maiores, que são os que listam mais tipos de cliente.

## Por que `descarta_forte` só aceita expressão fechada

Porque ela vence a confirmação. Uma palavra genérica ali derruba lead bom sem apelação.

| Não faça | Faça | Porque |
|---|---|---|
| `"curso"` | `"formar profissionais"` | a instaladora que instala **e** dá curso é lead legítimo |
| `"plano"` | `"operadora de plano"` | a clínica que *aceita* planos diria "plano" |
| `"prótese"` | `"laboratório de prótese"` | a clínica que *coloca* prótese é cliente |

**A pergunta que separa as duas listas:** essa expressão diz o que a empresa **É**, ou diz o que ela
**faz para o cliente**? Só a primeira entra em `descarta_forte`.

## Empresa sem site continua na lista

Sem site vivo não há resumo, e sem resumo o filtro não tem o que ler. O veredito é **indefinido**, e
o lead **fica na lista**, marcado.

🔴 Isso é decisão, não falha: **não se descarta empresa por falta de prova, só por prova contra.**
Empresa sem site costuma ser exatamente o cliente de quem vende presença digital.

`listar` e `exportar` escondem quem foi barrado; `--todos` mostra tudo.

## Como testar o seu filtro sem gastar

Rode `validar` e leia o motivo de cada barrado — ele diz **qual expressão** derrubou e **de onde**
ela veio (do resumo do site ou do nome do Maps). Se você reconhecer um cliente bom na lista dos
barrados, a culpa é da sua lista, não da ferramenta. Ajuste o JSON e rode `validar` de novo: ele não
gasta busca nem IA, só relê o que já está no banco.
