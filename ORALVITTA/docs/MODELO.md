# Modelo para criar sites com sistema

Um único código (`ORALVITTA/`) gera sites diferentes. Cada projeto é uma pasta `brands/<id>/` (identidade, visual, textos, imagens, dados iniciais) e roda com `BRAND=<id> npm start`, com **banco de dados e senha de admin próprios**.

```
brands/<id>/brand.json   identidade, design, cores, textos, contatos, serviços iniciais
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
| `restaurante` | Cardápio editável (categorias, itens, foto, preço, esgotado) + reserva de mesa (capacidade por turno e nº de pessoas) + pedido por WhatsApp | A construir |
| `academia` | Planos (preço, benefícios) + grade semanal de aulas com vagas + aula experimental com reserva de vaga | A construir |
| `salao` | Agendamento com vários profissionais + serviços com preço | A construir |
| `loja` | Catálogo de produtos + carrinho que gera pedido no WhatsApp + painel de produtos | A construir |

Peças que o motor ainda precisa ganhar para os próximos tipos: **capacidade** (várias reservas no mesmo horário), **vários recursos** (profissionais, mesas), **preços**, **upload de imagens pelo painel**. Cada uma entra como módulo reutilizável, não como código copiado de um cliente.

## Regras de ouro

1. Nunca inventar fatos do cliente (preços, prêmios, números, horários). Falta algo → usar um padrão editável e **avisar**.
2. Dados de um cliente nunca aparecem no pacote de outro (`npm run export`).
3. Tudo que o cliente edita no dia a dia fica no painel; identidade e visual ficam em `brands/<id>/`.
4. Textos em português do Brasil, sem emojis, sem exageros de marketing.
