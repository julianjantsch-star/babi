# Diretrizes do projeto

## Quem é o usuário

O responsável por este projeto é a pessoa que vai **usar** o sistema, não
quem vai mantê-lo. Conhecimento técnico inicial. Pedir que ele execute
configuração de infraestrutura trava o projeto.

## Regra principal: eu configuro, ele não

Quando algo precisa ser configurado — Supabase, Vercel, Resend, Fly.io, DNS,
variáveis de ambiente, migrations, criação de usuários — **eu faço**, via API,
CLI ou script automatizado. Não devolvo ao usuário um passo a passo de painel
para ele seguir.

Ordem de preferência, sempre:

1. **Executar eu mesmo** pela API de gerenciamento ou CLI do serviço.
2. **Escrever um script** que faça tudo de uma vez, e rodá-lo.
3. Só se 1 e 2 forem impossíveis: pedir a ação ao usuário — e aí em
   linguagem simples, com o caminho exato de cliques, um passo por vez.

## A única coisa que posso pedir: credenciais

Não consigo criar uma credencial da conta dele no lugar dele. Então posso
pedir **token de acesso, chave de API ou senha de serviço** — e nada além
disso. Ao pedir:

- Peço **uma credencial por vez**, dizendo exatamente onde clicar para gerá-la.
- Explico o que vou fazer com ela.
- Aviso que ela fica no histórico da conversa e oriento a revogar depois,
  quando o serviço permitir.
- Guardo em `.env.local` / secrets do serviço, **nunca** em arquivo versionado.

## Como comunicar

- Português do Brasil, direto, sem jargão desnecessário.
- Quando usar um termo técnico inevitável (RLS, migration, mTLS), explico em
  meia linha na primeira vez.
- Relato o que **eu fiz**, não o que ele precisa fazer.
- Se algo falhar, digo o que falhou e o que já tentei — não repasso o
  problema para ele resolver.

## Decisões técnicas

Decido sozinho o que for reversível e de baixo impacto (nomes, estrutura de
pasta, biblioteca, layout). Pergunto apenas quando a escolha muda o custo, o
comportamento fiscal/legal, ou é irreversível — e aí ofereço uma recomendação
clara em vez de uma lista de opções.

## Conta Resend compartilhada

A conta Resend do usuário atende vários projetos dele. Regras deste projeto:

- **`villabilac.com.br` é proibido como remetente**, inclusive subdomínios.
  Aquele domínio pertence a outro negócio, e este sistema não envia em nome
  dele. A trava está em `apps/web/lib/email/remetente.ts`, com testes.
- Chaves de API deste projeto usam **`sending_access`**, nunca acesso total,
  e levam o prefixo `babi-`. Não encostar nas chaves dos outros projetos
  (`webloc-*`, `villabilac-*`, `lfmontagens`, `RESEND_API_KEY full`,
  `Onboarding`) nem nos domínios deles.
- Ao ler um token recém-criado da API do Resend, conferir o comprimento: a
  resposta cola o token na palavra seguinte, e um caractere a mais invalida
  a chave silenciosamente. O formato é `re_` + 8 + `_` + 24 caracteres.

## Segurança que não se negocia

- Certificado digital (`.pfx`), chaves `service_role` e tokens **nunca** entram
  em commit. O `.gitignore` já bloqueia; conferir antes de cada commit.
- Ambiente de NFS-e começa em `HOMOLOGACAO`. A troca para `PRODUCAO` é sempre
  uma decisão explícita do usuário, porque gera obrigação tributária real.
