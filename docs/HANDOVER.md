# Handover do projeto

Documento de passagem: o que existe, o que está no ar, o que falta e o que
doeu no caminho. Escrito para quem pega o projeto depois — seja outra pessoa,
seja você mesmo daqui a seis meses.

Última atualização: 23/09/2026.

---

## 1. O que é

Sistema financeiro de um consultório odontológico. Três frentes:

| Frente | Estado |
|---|---|
| Contas a receber | ✅ no ar e em uso |
| Contratos com geração de PDF | ✅ no ar, modelos incompletos |
| Notas fiscais (NFS-e Nacional) | ⚠️ código pronto, serviço não publicado |

Roda inteiramente em planos gratuitos.

---

## 2. Onde está no ar

| Item | Endereço |
|---|---|
| Sistema | https://babi-financeiro.vercel.app |
| Painel Vercel | https://vercel.com/julianjantsch-9148/babi-financeiro |
| Painel Supabase | https://supabase.com/dashboard/project/blcyhvvyyffgccfyakvo |
| Repositório | https://github.com/julianjantsch-star/babi |
| Branch | `claude/dentist-receivables-system-cpkkh6` |

O domínio `financeirodental.com.br` está registrado e já ligado ao projeto na
Vercel, mas **a zona de DNS está vazia** — ver a seção 7.

---

## 3. Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| Banco, autenticação | Supabase (Postgres) | RLS no banco, plano gratuito generoso |
| Aplicação | Next.js 14 App Router na Vercel | Server Actions mantêm a chave secreta fora do navegador |
| E-mail | Resend | O SMTP nativo do Supabase entrega ~2/hora, insuficiente para 2FA |
| PDF | pdf-lib | Sem dependência nativa, roda em serverless |
| NFS-e | Serviço Node à parte | mTLS não roda em Edge Functions nem no serverless da Vercel |

---

## 4. Mapa do repositório

```
apps/web/                     Next.js — interface e regras de aplicação
  app/actions/                Server Actions: auth, recebíveis, clientes,
                              usuários, contratos, NFS-e, relatórios
  app/(painel)/               Telas autenticadas
  app/api/                    Rotas: CSV, PDF de contrato, logout
  components/                 Design system e telas
  lib/
    auth/                     2FA, sessão, dispositivos confiáveis
    contratos/                Campos, valor por extenso, geração de PDF
    email/                    Resend e a trava de remetente
    supabase/                 Clientes de navegador, servidor e admin
  middleware.ts               Sessão + porteiro do segundo fator

services/nfse/                Microserviço com o certificado A1 e mTLS
supabase/migrations/          5 migrations — schema, RLS, views, funções
scripts/                      Automação de infraestrutura (seção 6)
docs/                         Instalação, arquitetura, este handover
```

---

## 5. Banco de dados

**13 tabelas, 5 views, 26 policies de RLS, 5 migrations.**

Principais: `profiles`, `clientes`, `recebiveis`, `parcelas`, `notas_fiscais`,
`contratos`, `emitentes`, `modelos_contrato`, `configuracoes`, `auth_otp`,
`trusted_devices`, `audit_log`.

### A autorização mora no banco, não na tela

Toda regra de acesso é policy de RLS no Postgres. As checagens em
`lib/auth/session.ts` existem só para dar mensagem decente — se falhassem, o
banco ainda recusaria. Isso importa porque o cliente Supabase é acessível
pelo navegador com o token do usuário: regra que vivesse só no React seria
contornável com o console aberto.

Três papéis:

| | Admin | Financeiro | Balcão |
|---|:---:|:---:|:---:|
| Contas a receber — todas as origens | ✅ | ✅ | ❌ |
| Contas a receber — origem Clínica | ✅ | ✅ | ✅ |
| Estornar quitação | ✅ | ✅ | ❌ |
| Contratos | ✅ | ✅ | ❌ |
| Emitir NFS-e | ✅ | ❌ | ❌ |
| Usuários e modelos | ✅ | ❌ | ❌ |

O Balcão é confinado por `and origem = 'CLINICA'` nas próprias policies, no
`using` e no `with check`. Em `parcelas`, onde a origem não está na tabela, a
checagem usa `exists` contra `recebiveis`.

As funções auxiliares (`is_admin()`, `is_financeiro()`, `is_balcao()`) são
`SECURITY DEFINER` para que a consulta a `profiles` dentro da policy não
dispare o RLS da própria `profiles` e cause recursão.

### Regras que o banco garante sozinho

- Parcela `PAGA` exige `data_pagamento` e `valor_pago`; parcela não paga não
  pode tê-los. Estado inconsistente não é representável.
- `criar_recebivel()` gera recebível e parcelas numa transação; o resto da
  divisão em centavos vai para a primeira parcela, então a soma fecha exata.
- `emitir_contrato()` cria contrato e recebível juntos, com a origem do
  recebível acompanhando o tipo do emitente (PF ou PJ).
- `contratos_sem_marcador_aberto` recusa corpo com `{{CAMPO}}` não
  substituído, para o caso de a função ser chamada fora da aplicação.

---

## 6. Scripts de automação

Tudo que é infraestrutura passa por script, e os três são idempotentes.

### `scripts/configurar-supabase.mjs`
Cria o projeto, aplica migrations com controle de versão próprio, lê as
chaves, fecha o cadastro aberto, registra redirecionamentos, liga o SMTP do
Resend, cria o primeiro admin e grava `apps/web/.env.local`.

```bash
node scripts/configurar-supabase.mjs --token sbp_... --projeto blcyhvvyyffgccfyakvo \
  --admin-email pessoa@exemplo.com --site-url https://babi-financeiro.vercel.app
```

Rodar de novo é seguro: migrations aplicadas são puladas e o `AUTH_SECRET`
existente é preservado — trocá-lo invalidaria todas as sessões.

### `scripts/publicar-vercel.mjs`
Cria o projeto, envia as variáveis (cifrando as secretas), publica em
produção e aponta o Supabase para o endereço certo.

```bash
node scripts/publicar-vercel.mjs --token vcp_... --supabase-token sbp_...
```

### `scripts/configurar-dominio.mjs`
Publica DNS, liga o domínio ao site, troca o remetente e republica. Aceita
`--cloudflare-token` para gerenciar o DNS por API.

```bash
node scripts/configurar-dominio.mjs --dominio financeirodental.com.br \
  --token vcp_... --supabase-token sbp_...
```

---

## 7. O que falta

### 7.1 DNS do domínio — travado, esperando uma ação humana

`financeirodental.com.br` está registrado e pago. Nameservers em
`d.sec.dns.br` / `e.sec.dns.br` (DNS gratuito do Registro.br). **A zona está
vazia**: sem registro A, sem DKIM.

O Registro.br **não tem API de DNS** para o titular — só RDAP (leitura) e EPP
(provedores certificados). O "Token" deles é o app de dois fatores, não uma
chave de API. Então essa etapa é manual por decisão do serviço.

Dois caminhos:

**A)** Colar as 7 linhas de `docs/dns-financeirodental.com.br.txt` no editor
de zona do Registro.br.

**B)** Mover o DNS para a Cloudflare (gratuita, API completa) e rodar o
script com `--cloudflare-token`. A partir daí o DNS vira automatizável.

Depois que a zona subir, `scripts/configurar-dominio.mjs` faz o resto: troca
o remetente para `financeiro@financeirodental.com.br`, muda o endereço do
sistema e republica.

### 7.2 Texto dos contratos — incompleto

Os PDFs recebidos tinham **1 página cada**, embora o rodapé dissesse "página
1 de 4" e "1 de 3": foram impressos com o visualizador do Office ainda
carregando. O texto estava como imagem, não como texto selecionável.

As cláusulas 1 a 5 foram transcritas e estão cadastradas. **Faltam prazo,
rescisão, multa, foro e o bloco de assinaturas.**

Enquanto o modelo não for marcado como completo em **Contratos → Modelos**,
todo PDF gerado sai carimbado como `RASCUNHO`. Isso é proposital.

### 7.3 NFS-e — código pronto, serviço não publicado

`services/nfse` monta a DPS, assina com XMLDSig e transmite por mTLS. Falta
publicar (Fly.io, gratuito) com o certificado A1 em base64 e a senha, e
preencher `NFSE_SERVICE_URL` e `NFSE_SERVICE_TOKEN`.

⚠️ O layout da DPS segue a versão 1.00 do padrão nacional, mas **precisa ser
validado contra o XSD vigente** antes do primeiro envio real. Comece em
`AMBIENTE=HOMOLOGACAO`.

### 7.4 Pendências menores

- Emitente **PJ** não cadastrado (só a PF existe). Configurações → Emitentes.
- Só existe 1 usuário (admin). Balcão e financeiro ainda não foram criados —
  e só vão conseguir receber o código de acesso depois do DNS (7.1).
- O `proximo=` que o middleware põe na URL de login não é honrado: o login
  sempre volta para a raiz. Inofensivo, mas é ponta solta.

---

## 8. Credenciais

Nenhum segredo está versionado. O `.gitignore` bloqueia `.env*.local`,
`*.pfx`, `*.p12`, `*.pem`, `*.key`.

| Credencial | Onde vive | Como trocar |
|---|---|---|
| Chaves do Supabase | `apps/web/.env.local` e variáveis da Vercel | Painel do Supabase → API |
| `AUTH_SECRET` | idem | Gerar com `openssl rand -base64 48`. **Trocar desloga todo mundo** |
| Chave do Resend | idem (cifrada na Vercel) | resend.com/api-keys |
| Token do Supabase | só no histórico da conversa | supabase.com/dashboard/account/tokens |
| Token da Vercel | idem | vercel.com/account/tokens |
| Certificado A1 | ainda não instalado | Variável do serviço de NFS-e, nunca em arquivo |

**Os tokens do Supabase e da Vercel usados na configuração ficaram no
histórico da conversa.** Ambos podem ser revogados: o sistema segue
funcionando, porque no dia a dia ele usa outras chaves. Só serão necessários
de novo para uma mudança de infraestrutura.

### Conta Resend compartilhada

A conta atende outros projetos do dono. `villabilac.com.br` é **proibido**
como remetente aqui, inclusive subdomínios — a trava está em
`apps/web/lib/email/remetente.ts`, com testes. Chaves deste projeto usam
`sending_access` e levam prefixo `babi-`.

---

## 9. Desenvolvimento

```bash
cd apps/web
npm install
cp ../../.env.example .env.local   # ou peça o .env.local pronto
npm run dev        # http://localhost:3000
npm test           # 57 testes, runner nativo do Node
npm run lint
npm run build
```

Os testes não precisam de banco: cobrem a lógica pura — filtros de período,
divisão de parcelas, valor por extenso, montagem do PDF, trava de remetente.

Para conferir a interface de verdade há um roteiro de navegador em
`/tmp/.../verificacao/` (efêmero): cria um usuário temporário, entra pelo link
de recuperação, exercita a tela e tira as telas. Vale reconstruir se for
mexer em layout.

---

## 10. Armadilhas que já custaram tempo

Registradas para não se repetirem.

**Next.js exige literal no `matcher` do middleware.** Concatenar strings faz
a configuração ser ignorada **sem aviso nenhum**. Sintoma: a exceção que você
acabou de adicionar não tem efeito.

**Servidor local que não morre.** `pkill -f "next start"` casa com a própria
linha de comando do shell e derruba o shell. Pior: se o servidor antigo
segurar a porta, o novo falha com `EADDRINUSE` em silêncio e você fica
testando o build velho. Matar por PID via `ps -eo pid=,cmd= | awk '$2 ~ /^next-server/'`.

**Breakpoint de janela engana em layout com barra lateral.** O conteúdo é
limitado a `max-w-6xl` (~1152px) mesmo em tela de 1440px, então `xl:` não
significa "cabe mais".

**Token do Resend vem colado na palavra seguinte.** A resposta da API gruda o
token em "IMPORTANT", e um caractere a mais dá 401 que parece erro de
configuração. Formato: `re_` + 8 + `_` + 24.

**A Vercel não hospeda DNS de domínio registrado fora dela.** `GET` de
registros devolve 200 com lista vazia mesmo sem zona — só a escrita revela a
verdade. E domínio adicionado antes de existir no registro fica preso em
`serviceType: "na"`; a saída é apagar e recriar a entrada.

**Domínio na Vercel ≠ domínio no ar.** Adotá-lo como endereço do sistema
antes de ele resolver aponta os links de e-mail para um endereço morto. O
script agora só promove depois de confirmar no DNS.

**`.br` recém-registrado não resolve sem nameservers**, porque o Registro.br
só publica na zona `.br` depois de checar que os servidores respondem. E há
uma janela de transição (~2h) em que nem a zona nem a delegação podem ser
mexidas.

**Intl em pt-BR usa espaço não separável** depois de `R$`. Comparar com
espaço comum falha por um caractere invisível.

**pdf-lib usa WinAnsi**, que cobre o português mas não o que o Word cola
junto. Aspas curvas, travessões e espaços especiais são normalizados antes;
o resto vira `?` visível em vez de derrubar a geração.

---

## 11. Custos

| Serviço | Plano | Limite | Risco |
|---|---|---|---|
| Supabase | Free | 500 MB | Pausa após 7 dias sem uso |
| Vercel | Hobby | 100 GB/mês | Nenhum no uso previsto |
| Resend | Pago (compartilhado) | 50.000/mês | Este projeto usa ~165/mês |
| Registro.br | — | R$ 40/ano | Renovação anual |
| Fly.io (NFS-e) | Free | 3 VMs | Quando for publicado |

O ponto de atenção real é a **pausa do Supabase por inatividade**. Com uso
diário do consultório não acontece.
