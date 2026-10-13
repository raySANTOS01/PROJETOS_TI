---
name: novo-site
description: Cria um site profissional com sistema por trás (painel admin) para um novo cliente/categoria (clínica, academia, restaurante, salão, loja…) usando o modelo em ORALVITTA/. Use quando o usuário enviar nome, logo, imagens, produtos ou serviços de um negócio e pedir um site, ou pedir um novo tipo de site.
---

# Criar um site novo a partir do modelo

Contexto: o repositório tem um modelo multi-projeto em `ORALVITTA/` (leia `ORALVITTA/docs/MODELO.md` e `ORALVITTA/brands/_modelo/LEIA-ME.md` primeiro). O usuário é brasileiro, fala português, quer resultado **profissional e com visual único para cada projeto**, e **pede para receber apenas os arquivos específicos**, nunca a pasta toda, a menos que peça.

## 1. Entrada (o que o usuário manda)
Nome, logo, imagens, produtos/serviços (e a categoria). Confira o que falta e peça **numa só mensagem**: telefone/WhatsApp, endereço, horário de funcionamento, Instagram, preços (se quiserem exibir), diferenciais, e se há logo em alta resolução. Se não responderem, use padrões editáveis e **liste o que foi suposição** no final. Nunca invente preços, prêmios, números ou depoimentos.

## 2. Criar o projeto
```bash
cd ORALVITTA
npm run novo -- <id> "Nome do Negócio" "Cidade"
```
- Salve as imagens em `brands/<id>/img/` (logo, `favicon.png` 64px, `hero.jpg` ≤2000px, `sobre.jpg`, fotos da galeria ≤1200px). Redimensione com Pillow; recorte um ícone quadrado da logo para `logo-mark.png` (ou use `logo.style: "wide"`).
- Imagens recebidas em `/tmp/.../images/` são só leitura: copie, não mova.

## 3. Direção de design (diferente de todos os outros projetos)
1. Rode `grep -h '"design"' -A8 ORALVITTA/brands/*/brand.json` e **não repita** a combinação fonte + tema + hero + forma.
2. Extraia a paleta da logo (amostre as cores dominantes com Pillow) e monte `colors` (`teal-*` = marca; `navy-*` = títulos/faixas; `mist-*`, `line`, `ink*` = neutros). Tema escuro: defina todos os neutros e `band`, `on-band`, `btn-hover`.
3. Escolha fontes (pares em `docs/MODELO.md`), `hero` (use `image` quando houver uma boa foto), `radius` e `buttons` que combinem com o setor: academia = condensada/escura/reta; restaurante = serifada quente; clínica = limpa/clara; salão = elegante.
4. Escreva `copy`, `about`, `gallery` com textos curtos, concretos, em pt-BR e sem exageros.

## 4. Sistema por trás (vertical)
- `vertical: "clinica"` já funciona (agendamento). Para outro tipo (restaurante, academia, salão, loja), a tabela de verticais em `docs/MODELO.md` define o que construir. **Antes de codar um vertical novo, mostre ao usuário o escopo em poucas linhas e confirme.**
- Construa como módulo reutilizável (esquema no `src/db.js`, rotas em `src/routes-*.js`, seção no painel `public/js/admin.js`, testes em `test/`), nunca copie código específico de um cliente. Reaproveite o motor `src/schedule.js` e acrescente capacidade/recursos/preços onde faltar.
- Painel admin é sempre claro e neutro; edição do dia a dia (serviços, horários, bloqueios, cardápio, planos) vai no painel, identidade e visual ficam no `brand.json`.

## 5. Conferir antes de entregar
- `cd ORALVITTA && npm test` passando (adicione testes do que construir).
- Rodar `BRAND=<id> npm start` e tirar capturas (Playwright + `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `--no-sandbox`) da home, do fluxo de reserva e do painel, em desktop **e** celular (390px); olhar as imagens, checar contraste, erros de console e quebras.
- Nenhuma menção a outro cliente nos arquivos: `npm run export -- <id> <pasta>` e `grep -ri` pelos nomes dos outros.
- Textos, números, preços e horários só com o que o cliente informou; o resto marcado como suposição.

## 6. Entrega
- Commit na branch designada da sessão e `git push -u origin <branch>`; não abra PR sem pedido.
- Para entregar ao cliente/usuário: `npm run export -- <id> <pasta>` + zip da pasta gerada (sem `node_modules` e `data`). Quando o usuário pedir só uma mudança (ex.: nova logo), envie **apenas os arquivos alterados**.
- Termine com: o que foi feito, como rodar, e a lista curta de suposições a confirmar com o cliente.
