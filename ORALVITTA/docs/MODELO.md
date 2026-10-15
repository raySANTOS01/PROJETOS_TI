# Modelo para criar sites com sistema

Um único código (`ORALVITTA/`) gera sites diferentes. Cada projeto é uma pasta `brands/<id>/` (identidade, visual, textos, imagens, dados iniciais) e roda com `BRAND=<id> npm start`, com **banco de dados e senha de admin próprios**.

```
brands/<id>/brand.json   identidade, design, cores, textos, contatos, serviços e catálogo iniciais
brands/<id>/img/         logo, favicon, hero.jpg, sobre.jpg, galeria…
brands/_modelo/          molde + LEIA-ME com todos os campos
views/                   páginas HTML com marcadores {{...}}
src/                     servidor, banco, agenda, autenticação
npm run novo -- id "Nome" "Cidade"      cria um projeto a partir do molde
npm run export -- id ../pasta           pacote só daquele cliente (sem dados dos outros)
```

## Visual único por projeto

O site muda de cara só com `design` + `colors` + `copy` + imagens (nenhuma edição de código):

| Alavanca | Opções |
|---|---|
| Fontes | qualquer par do Google Fonts (`design.fonts`) |
| Tema | `light` ou `dark` |
| Hero | `split`, `centered`, `image` (foto de fundo) |
| Forma | `radius` 0–18 px, botões `pill`/`soft`/`square` |
| Cor | paleta completa em `colors`, tirada da logo do cliente |
| Conteúdo | textos próprios, seção "Sobre", galeria, endereço com mapa |

Pares de fontes que funcionam bem: Cormorant Garamond + Inter (clínica elegante) · Oswald + Inter (academia, esporte) · Fraunces + DM Sans (restaurante, acolhedor) · Playfair Display + Inter (editorial, joalheria) · Syne + Inter (moderno, tecnologia) · Montserrat + Lora (corporativo) · Bebas Neue + Inter (impacto).
Regra: **não repita a combinação de fontes + tema + hero de outro projeto.**

## Verticais (o sistema por trás de cada tipo de negócio)

| `vertical` | Sistema | Estado |
|---|---|---|
| `clinica` | Agendamento por horário com serviços de durações diferentes, sem conflito, bloqueios da dona, acompanhamento pelo paciente, painel | **Pronto** |
| `loja` | **Vitrine com catálogo editável** (categorias e produtos com fotos enviadas pelo painel, preço fixo / "a partir de" / sob consulta), **pedido pelo WhatsApp** (carrinho, endereço, data, cartão), **agendamento de homenagens/serviços ao vivo**, formulário "Ligamos para você", painel com pedidos, catálogo e contatos. Serve floricultura, presentes, cestas, lojas em geral. | **Pronto** |
| `restaurante` | Cardápio editável (categorias, itens, foto, preço, esgotado) + reserva de mesa (capacidade por turno e nº de pessoas) + pedido por WhatsApp | A construir |
| `academia` | Planos (preço, benefícios) + grade semanal de aulas com vagas + aula experimental com reserva de vaga | A construir |
| `salao` | Agendamento com vários profissionais + serviços com preço | A construir |

Já existem no motor: catálogo, carrinho, pedidos, contatos e **envio de fotos pelo painel** (vertical `loja`). Ainda faltam, para os próximos tipos: **capacidade** (várias reservas no mesmo horário), **vários recursos** (profissionais, mesas) e **pagamento online** (hoje o fechamento é pelo WhatsApp). Cada uma entra como módulo reutilizável, não como código copiado de um cliente.

## Regras de ouro

1. Nunca inventar fatos do cliente (preços, prêmios, números, horários). Falta algo → usar um padrão editável e **avisar**.
2. Dados de um cliente nunca aparecem no pacote de outro (`npm run export`).
3. Tudo que o cliente edita no dia a dia fica no painel; identidade e visual ficam em `brands/<id>/`.
4. Textos em português do Brasil, sem emojis, sem exageros de marketing.

## Vocabulário e logo em texto

- `vocab`: `{ "appt": "homenagem", "appts": "homenagens" }` troca "consulta/consultas" em todo o site e no painel.
- `askInsurance: false` esconde o campo de convênio (use fora de clínicas).
- `logo.style: "text"` desenha a logo com um coração e o nome em fonte cursiva (`design.fonts.accent`), útil enquanto o cliente não manda o arquivo da logo.
- `catalog`: lista de categorias e produtos iniciais (`service` liga o produto a um serviço agendável). Depois de criado o banco, o catálogo é editado no painel.
