# OralVitta Fortaleza — Sistema de agendamento

Site com agendamento online, acompanhamento da consulta pelo paciente e painel administrativo para a dona da clínica.

## Como rodar

Requer **Node.js 22.13 ou superior** (usa o SQLite embutido do Node, então o único pacote externo é o Express).

```bash
cd ORALVITTA
npm install
npm start          # http://localhost:3000
npm test           # testes automatizados da agenda e da API
```

Na **primeira execução** o terminal mostra o usuário (`admin`) e uma senha gerada. Anote e troque em *Painel → Configurações → Segurança*.
Esqueceu a senha? Inicie uma vez com `RESET_ADMIN_PASSWORD="nova-senha-longa" npm start` (mínimo 10 caracteres) e depois volte a usar `npm start`.
Para definir a senha inicial você mesmo: `ADMIN_PASSWORD="sua-senha-longa" npm start`.

Variáveis opcionais: `BRAND` (qual clínica, veja abaixo), `PORT`, `DB_FILE` (caminho do banco, padrão `data/<marca>.db`), `TRUST_PROXY=true` (atrás de proxy/HTTPS, para cookie `Secure` e IP correto).

> **Modelo para criar qualquer site** (clínica, academia, restaurante…): veja `docs/MODELO.md` e `brands/_modelo/LEIA-ME.md`. Novo projeto: `npm run novo -- <id> "Nome" "Cidade"`.

## Várias clínicas (marcas)

O mesmo código atende clínicas diferentes. Cada clínica é uma pasta em `brands/<id>/` com:

- `brand.json`: nome, cores, telefone/WhatsApp/Instagram/endereço, convênios, horário padrão e serviços iniciais;
- `img/`: logo (`logo-mark.png` ou `logo-wide.png`) e `favicon.png`.

```bash
npm start                       # OralVitta (padrão)
BRAND=dra-dentista npm start    # Dra. Dentista, com banco de dados próprio (data/dra-dentista.db)
```

Cada marca tem **banco e senha de admin separados** — rode uma instância por clínica (portas/domínios diferentes). Os dados de `brand.json` só valem na criação do banco; depois, tudo é editado no painel. Para uma clínica nova, copie uma pasta de `brands/`.

**Entrega separada:** as clínicas são independentes. Para entregar o sistema a uma delas **sem os dados das outras**, gere um pacote só dela:

```bash
npm run export -- dra-dentista ../entrega-dra-dentista
```

> A marca **dra-dentista** foi montada com o que aparece no Instagram dela: o WhatsApp, o endereço, os serviços citados nos posts e as cores azuis. A **logo** é um recorte de baixa resolução de um print (troque `brands/dra-dentista/img/logo-wide.png` pelo original). **Horário de atendimento, durações e convênios são suposições** — ajuste no painel.

## Páginas

| Rota | O que é |
|---|---|
| `/` | Apresentação, serviços, horário de atendimento, convênios (se a clínica usar) e endereço com link do mapa |
| `/agendar` | Agendamento: serviço → data/horário → dados → código de confirmação |
| `/consulta` | Paciente acompanha/cancela com **código + telefone** |
| `/admin` | Painel da clínica (login) |

## Como o sistema evita conflito de horário

- Cada serviço tem uma **duração**; uma consulta ocupa `início → início + duração`.
- Um horário só aparece livre se **não sobrepõe** nenhuma consulta ativa, nenhum bloqueio da dona e nem a pausa (almoço).
  Horários ocupados aparecem riscados ("Ocupado") para o paciente.
- Na hora de gravar, o servidor **verifica de novo dentro de uma transação exclusiva** (`BEGIN IMMEDIATE`). Se dois pacientes clicam no mesmo horário ao mesmo tempo, só um é gravado; o outro recebe "este horário acabou de ser ocupado" e volta para a escolha com a lista atualizada. Há um teste com 50 requisições simultâneas.
- Consulta cancelada libera o horário imediatamente.
- Hoje o sistema assume **um profissional/cadeira** (uma consulta por vez).

## Painel da dona

- **Visão geral**: consultas de hoje, próximos 7 dias, pendentes de confirmação.
- **Agenda**: linha do tempo do dia com navegação por semana; clique numa consulta para confirmar, concluir, marcar falta, remarcar, cancelar ou chamar o paciente no WhatsApp; clique num horário vazio para marcar uma consulta (telefone/presencial).
- **Disponibilidade**: bloqueie um **dia inteiro, um intervalo de horas ou vários dias** (doença, folga, curso…). Se já houver pacientes nesse período, o painel lista quem são, com botões **Avisar (WhatsApp)** e **Cancelar**. Também define o **horário de funcionamento semanal** e pausas.
- **Serviços**: nome, descrição, duração e visibilidade no site.
- **Configurações**: dados da clínica, intervalo entre horários, antecedência mínima, até quantos dias à frente o site aceita agendamentos, troca de senha.

## Pontos a revisar com a clínica

- As **durações dos serviços** (30/60/90 min) e as **descrições curtas** são sugestões iniciais — ajuste em *Painel → Serviços*.
- Horário inicial segue as artes: seg–sex 8h30–17h30, sáb 8h30–12h, domingo fechado. Altere em *Disponibilidade*.
- As imagens da OralVitta ficam em `brands/oralvitta/img/` (`logo.png` é a logo completa; `logo-mark.png` e `favicon.png` são recortes). Para trocar, substitua mantendo os nomes.
- O **endereço** da OralVitta ainda não foi informado: preencha em *Painel → Configurações* e a seção "Onde estamos" aparece no site.
- Não há envio automático de WhatsApp/SMS/e-mail: os botões abrem o WhatsApp com a mensagem pronta. Integração automática (API do WhatsApp Business) é uma evolução possível.

## Segurança

Senhas com scrypt, sessão em cookie `HttpOnly` + `SameSite=Strict`, limitação de tentativas (login, agendamento, consulta), validação no servidor, SQL parametrizado, textos inseridos via `textContent` (sem XSS) e CSP restritiva. Coloque atrás de HTTPS em produção.

## Estrutura

```
server.js            app Express
src/schedule.js      regras de agenda (livre/ocupado/bloqueado)
src/appointments.js  criação de consultas (transação + conflito)
src/routes-*.js      API pública e do painel
src/db.js            esquema SQLite e dados iniciais
src/brand.js         carrega a marca escolhida
views/               páginas HTML (com marcadores da marca)
public/              CSS e JS do site e do painel
brands/              uma pasta por clínica (dados, cores, logo)
test/                testes (node --test)
```
