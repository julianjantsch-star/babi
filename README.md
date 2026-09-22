# Sistema Financeiro Odontológico

Contas a receber, emissão de NFS-e Nacional e relatórios para consultório
odontológico. Construído para rodar inteiramente em planos gratuitos.

| Camada | Serviço | Plano |
|---|---|---|
| Banco, Auth, Storage | Supabase | gratuito |
| Aplicação web | Next.js 14 na Vercel | gratuito |
| E-mail (2FA e relatórios) | Resend | gratuito — 3.000/mês |
| Emissor de NFS-e | Node + Fastify no Fly.io | gratuito |

---

## O que o sistema faz

**Contas a receber**
- Lançamento com valor total dividido em *N* parcelas, com prévia antes de gravar
- Toggle de **origem do faturamento**: Pessoa Física, Pessoa Jurídica ou Clínica
- Filtros por origem, por tipo de pagador (PF/PJ), por mês e por situação
- Quitação por parcela informando **data** e forma de pagamento; estorno auditado
- Totais sempre visíveis: **a receber no mês, recebido, pendente, vencido e total geral**

**Notas fiscais**
- Emissão de NFS-e pelo Ambiente Nacional (SEFIN), com certificado digital A1
- Apenas contas de origem **PJ** emitem nota; PF é RPA e Clínica é faturada por ela
- A nota pode cobrir o contrato inteiro ou uma parcela específica

**Usuários e segurança**
- Três perfis: **Administrador**, **Financeiro** e **Balcão**
- 2FA por e-mail em todo login, com opção de confiar no dispositivo por 30 dias
- Isolamento no banco por Row Level Security, não apenas na interface

**Relatórios**
- Quebra por origem, por forma de pagamento e evolução dos últimos 12 meses
- Exportação em CSV (abre direto no Excel em português) e envio por e-mail

---

## Perfis de acesso

| | Administrador | Financeiro | Balcão |
|---|:---:|:---:|:---:|
| Lançar contas — todas as origens | ✅ | ✅ | — |
| Lançar contas — origem Clínica | ✅ | ✅ | ✅ |
| Ver contas de PF e PJ | ✅ | ✅ | ❌ |
| Quitar parcelas | ✅ | ✅ | ✅ (só Clínica) |
| Estornar quitação | ✅ | ✅ | ❌ |
| Emitir/cancelar NFS-e | ✅ | ❌ | ❌ |
| Relatórios consolidados | ✅ | ✅ | ❌ |
| Cadastrar usuários | ✅ | ❌ | ❌ |

O perfil Balcão enxerga **exclusivamente** recebíveis de origem `CLINICA`. Isso é
garantido por policies de RLS no PostgreSQL: mesmo que alguém chame a API
diretamente com o token daquele usuário, o banco não devolve as outras origens.

---

## Estrutura

```
apps/web/               Next.js 14 (App Router) — interface e regras de aplicação
  app/actions/          Server Actions: auth, recebíveis, clientes, usuários, NFS-e
  app/(painel)/         Telas autenticadas
  components/           Design system e componentes de tela
  lib/                  Supabase, 2FA, e-mail, formatação, filtros
  middleware.ts         Sessão + porteiro do 2FA

services/nfse/          Microserviço Node com o certificado A1 e mTLS
  src/dps.ts            Montagem do XML da DPS
  src/assinatura.ts     Assinatura XMLDSig
  src/sefin.ts          Comunicação com o Ambiente de Dados Nacional

supabase/migrations/    Schema, RLS, views e funções
supabase/seed.sql       Dados de exemplo para desenvolvimento
docs/                   Guia de instalação e decisões de arquitetura
```

---

## Por que o emissor de NFS-e é um serviço separado

A API do Ambiente Nacional exige **mTLS**: o certificado A1 do prestador é
apresentado no handshake TLS. As Edge Functions do Supabase rodam em Deno
Deploy, que não permite apresentar certificado de cliente — e a Vercel também
não expõe isso de forma confiável no runtime serverless.

Por isso o `.pfx` vive em um único lugar: o `services/nfse`, um serviço Node
minúsculo que cabe folgado no plano gratuito do Fly.io ou do Render. O app
conversa com ele por HTTPS com um token compartilhado, e o certificado nunca
toca o banco, o navegador ou o repositório.

---

## Instalação

O passo a passo completo está em **[docs/INSTALACAO.md](docs/INSTALACAO.md)**.
Em resumo:

```bash
# 1. Banco
supabase link --project-ref SEU_PROJETO
supabase db push

# 2. Aplicação
cd apps/web
cp .env.example .env.local     # preencha as variáveis
npm install
npm run dev

# 3. Emissor de NFS-e (opcional no início)
cd services/nfse
cp .env.example .env           # inclui o certificado A1 em base64
npm install && npm run dev
```

O app funciona normalmente sem o serviço de NFS-e; apenas o botão de emissão
fica indisponível, com aviso na tela.

---

## Antes de emitir nota em produção

O layout da DPS implementado em `services/nfse/src/dps.ts` segue a versão 1.00
do padrão nacional, mas **precisa ser validado contra o XSD vigente** e contra
as regras do seu município antes do primeiro envio real. Campos obrigatórios
variam conforme regime tributário e item da lista de serviços.

Rode primeiro em `AMBIENTE=HOMOLOGACAO`, confira o XML gerado e só então
troque para produção em Configurações.
