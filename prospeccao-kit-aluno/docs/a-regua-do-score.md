# A régua — de onde vem a nota, e como mudar a sua

A nota responde uma pergunta só: **quanto essa empresa se deixa encontrar?**

Não é nota de qualidade da empresa, nem de probabilidade de compra. É de **presença**. Empresa que
publica site, e-mail e WhatsApp é empresa que investe em ser achada — e é com quem a conversa começa
mais fácil.

## Os nove sinais

| Sinal | Padrão | O que ele prova |
|---|---|---|
| Site respondendo | 25 | investe em existir, e há onde ler sobre ela |
| Instagram | 15 | tem canal vivo |
| E-mail publicado | 15 | aceita ser procurada por escrito |
| Telefone | 10 | dá para ligar |
| WhatsApp identificado | 10 | atende pelo canal mais rápido |
| Reputação (≥ 4,0 com ≥ 10 avaliações) | 10 | tem cliente e cuida disso |
| CNPJ no site | 5 | formalizada, e você já tem o número |
| LinkedIn | 5 | tem estrutura de empresa |
| Endereço completo | 5 | é local, dá para visitar |

**Soma 100.** As faixas:

| Classe | Nota | Leia como |
|---|---|---|
| **A** | 75+ | quente — comece por aqui |
| **B** | 50 a 74 | bom |
| **C** | 25 a 49 | fraco |
| **D** | abaixo de 25 | descarte |

## A conta fica gravada

Cada lead tem a coluna `sinais`, que guarda sinal por sinal: se tinha, quantos pontos deu e a
observação. **Discordar de uma nota é ler a conta, não adivinhar.**

## Como mudar a régua — e por que você deveria

Os pesos moram no JSON do seu nicho. **Mudar a régua não pede código.**

Os dois exemplos que vêm na pasta são diferentes de propósito:

| | energia solar | clínica odontológica |
|---|---|---|
| Instagram | 15 | **20** |
| WhatsApp | 10 | **15** |
| E-mail | 15 | **10** |
| LinkedIn | 5 | **0** |

O motivo: clínica de bairro vive de Instagram e agenda por WhatsApp. Paciente não manda e-mail para
marcar consulta, e clínica de bairro não tem página de empresa no LinkedIn — **pontuar LinkedIn ali
só puniria lead bom.**

🔴 **A regra:** peso é sobre o seu processo de venda, não sobre a empresa. Se você aborda por e-mail
frio, e-mail vale mais. Se você aborda por telefone, telefone vale mais. Mantenha a soma em 100 para
as faixas A/B/C/D continuarem fazendo sentido.

## As duas armadilhas que a nota esconde

### Site morto

Empresa que divulga um site no Google Maps e o site não responde ganha a bandeira `site_morto`.

Isso **não** é apenas deixar de somar 25 pontos: é um fato sobre ela. A empresa **parece**
estruturada e não é. Muda a abordagem — e se o que você vende é presença digital, é gancho de venda,
não motivo de descarte.

### Link social cadastrado como site

Tem empresa que cadastra o link do WhatsApp, o Linktree ou o próprio perfil do Instagram no campo
"site" do Google. Se isso contasse como site próprio, a nota inflava com um sinal falso.

A ferramenta classifica esses casos como **pista**: aproveita a informação e deixa o campo de site
vazio, que é a verdade.

## Sobre o e-mail colhido

O e-mail sai de `mailto:` primeiro, que é a fonte confiável, e só depois do texto solto da página. E
há uma lista de descarte, porque página de site tem e-mail que não é da empresa: serviço de
monitoramento de erro, plataforma que hospedou o site, nome de arquivo de imagem com arroba.

Sobra o e-mail de contato de verdade — normalmente algo como `contato@exemplo.com.br`. Se você vir
lixo passando, a lista de descarte é o lugar de mexer.
