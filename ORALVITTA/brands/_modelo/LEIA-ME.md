# Molde de projeto

Comece um projeto novo com: `npm run novo -- <id> "Nome do Negócio" "Cidade"` (cria `brands/<id>/` a partir deste molde).

## Campos de `brand.json`

| Campo | O que é |
|---|---|
| `id`, `name`, `subtitle`, `fullName`, `city` | Identidade. `subtitle` aparece pequeno sob o nome no cabeçalho (só com logo `mark`). |
| `vertical` | Tipo de negócio/sistema por trás: `clinica` (agendamento). Outros tipos entram como módulos (veja `docs/MODELO.md`). |
| `logo.style` | `mark` = ícone quadrado + nome em texto; `wide` = logo horizontal inteira (sem texto ao lado). |
| `logo.file`, `logo.favicon` | Arquivos em `img/`. |
| `design.fonts` | `[família do Google Fonts, pesos]` para títulos (`display`) e texto (`body`). |
| `design.tone` | `light` ou `dark` (no escuro, defina todas as cores neutras em `colors`). O painel admin continua claro. |
| `design.hero` | `split` (texto + cartão de horários), `centered` (tudo centralizado) ou `image` (foto de fundo; exige `img/hero.jpg`). |
| `design.radius` | Arredondamento dos cartões em px (0 = reto, 18 = bem suave). |
| `design.buttons` | `pill`, `soft` ou `square`. |
| `colors` | Paleta. `teal-*` = cor da marca (300 claro → 700 escuro). `navy-800/900` = títulos e faixas escuras. `mist-*`/`line` = fundos e bordas. `ink`/`ink-soft` = texto. Opcionais: `on-primary`, `on-band`, `band`, `btn-hover`. |
| `copy` | Textos de destaque do site (use `{city}` para inserir a cidade). |
| `about` | Seção "Sobre nós" (opcional). Imagem em `img/`. |
| `gallery` | Lista de imagens em `img/` (opcional; com 5+ fotos a primeira vira destaque). |
| `clinic` | Telefone, WhatsApp (só números, com 55), Instagram, endereço. |
| `showInsurances`, `insurances` | Convênios (se houver). |
| `hours` | Horário inicial. Depois a dona ajusta no painel. |
| `services` | `[nome, descrição, duração em minutos]` — valem só na criação do banco. |

Imagens: PNG/JPG em `img/`, de preferência já redimensionadas (hero ≤ 2000px, galeria ≤ 1200px).
