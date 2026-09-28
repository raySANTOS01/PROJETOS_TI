# Requisitos, tag de site e oportunidade — quem entra e qual venda cabe

A nota (`docs/a-regua-do-score.md`) ordena. Mas ordenar não basta: tem lead que **não deveria estar
na lista**, e tem lead que está na lista por um motivo diferente do outro. São três camadas.

## 1. Requisito elimina

O score soma pontos: sem Instagram, a empresa perde 15 e continua na lista. Requisito é outra coisa:
**quem não passa, sai** — com o motivo escrito ao lado.

Moram no JSON do nicho:

```json
"requisitos": {
  "avaliacoes_min": 16,
  "avaliacoes_max": 349,
  "exige_celular": true,
  "exige_site": false
}
```

| Requisito | Por quê |
|---|---|
| **mínimo de avaliações** | abaixo disso a empresa mal existe no Google — pouco movimento, pouco dinheiro para investir |
| **máximo de avaliações** | acima disso ela provavelmente já tem marketing funcionando, ou é rede. É a venda mais difícil |
| **celular** | cold call e WhatsApp pedem celular. Fixo, 0800, 0300, 3003 e 4004 não passam |
| **site** | desligado nos exemplos, de propósito — ver a camada 2 |

O celular é procurado em três lugares, nesta ordem: o link de WhatsApp do site, o telefone do Google
Maps e os números escritos no site. Muita empresa põe o fixo da recepção no Maps e o WhatsApp só no
site — olhar só o Maps descartaria essa empresa à toa.

**Celular repetido em várias empresas** também reprova: é número de central, de agência ou de rede,
não do dono.

Os números 16 e 349 não são lei. **O lead que se quer é o do meio**: já entende de digital, mas o
marketing ainda não funciona. Quem não tem nada ainda não sabe que precisa; quem tem centenas de
avaliações e anúncio rodando já tem alguém cuidando. Ajuste a faixa ao seu nicho — clínica
odontológica acumula avaliação mais rápido que integradora solar, porque dentista pede para o paciente.

Quem reprovou some do `listar` e do `exportar`. `--todos` mostra, e `validar` imprime o motivo de cada um.

## 2. A tag de site separa as vendas

Todo lead ganha uma de três tags:

| Tag | O que é | A venda que cabe |
|---|---|---|
| `com_site` | tem site próprio no ar | tráfego, gestão, automação |
| `sem_site` | não divulga site (ou divulga só Instagram, Linktree ou WhatsApp) | **o site** |
| `site_morto` | divulga site, e ele não abre | o site, com o argumento pronto: "o seu está fora do ar" |

Por isso `exige_site` vem desligado: **não ter site não é lead ruim, é outra venda.** Filtre na hora
de trabalhar a lista:

```bash
node prospectar.mjs listar --nicho <nicho> --site sem     # quem compra site
node prospectar.mjs listar --nicho <nicho> --site morto   # quem compra site e já tem a dor
node prospectar.mjs listar --nicho <nicho> --site com     # o resto
```

Se o seu serviço só faz sentido para quem já tem site, ligue `exige_site: true` no JSON do nicho.

## 3. Oportunidade: o marketing do site está fraco?

Para quem tem site no ar, a página inicial é lida atrás de quatro sinais. Nenhum custa nada, é
expressão regular no HTML:

| Sinal | Como é detectado |
|---|---|
| **pixel de anúncio** | pixel da Meta (`fbq(`) ou tag de conversão do Google Ads (`AW-…`) |
| **versão para celular** | a tag `<meta name="viewport">` |
| **site abandonado** | ano do copyright no rodapé de dois anos atrás ou mais |
| **botão de WhatsApp** | link `wa.me` ou `api.whatsapp.com` |

Com isso:

| Oportunidade | Quando |
|---|---|
| **alta** | não anuncia **e** o site tem problema (abandonado, sem versão para celular ou sem WhatsApp) |
| **média** | não anuncia, mas o site está em ordem |
| **baixa** | já tem pixel de anúncio — alguém já cuida do marketing |

```bash
node prospectar.mjs listar --nicho <nicho> --oportunidade alta
```

No CSV, a coluna `sinais_marketing` explica em português: *"sem pixel de anúncio, copyright 2021,
sem botão de WhatsApp"*. É a primeira frase da sua abordagem.

⚠️ **Google Analytics não conta como anúncio.** Wix, WordPress e afins instalam o Analytics de
fábrica. Na primeira versão ele contava, e 37 de 46 clínicas saíram como "já anuncia" — a lista de
oportunidade ficou inútil. Só pixel de anúncio prova que alguém está pagando por clique.

## Juntando tudo

```bash
node prospectar.mjs listar --nicho clinica-odontologica --classe A --oportunidade alta
```

Clínica que passou nos requisitos, se deixa encontrar e não está anunciando. É a lista da ligação de amanhã.
