# Guia de instalação

Tempo estimado: 40 minutos, sem contar a espera pela verificação de domínio
do e-mail.

---

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (plano Free).
   Escolha a região **South America (São Paulo)** para reduzir a latência.
2. Guarde a senha do banco — ela não é exibida de novo.
3. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secreta, só no servidor)

### Aplicar o schema

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Alternativa sem CLI: abra o **SQL Editor** do painel e cole, em ordem, os três
arquivos de `supabase/migrations/`.

### Desligar o cadastro aberto

Em **Authentication → Providers → Email**, desative *Enable signup*. Usuários
entram apenas por convite do administrador.

### Criar o primeiro administrador

O primeiro usuário precisa ser criado à mão, já que só um admin convida outros.

1. **Authentication → Users → Add user**, com e-mail e senha.
2. No **SQL Editor**:

```sql
update public.profiles
   set role = 'ADMIN', nome = 'Nome da Dentista'
 where email = 'email-do-admin@exemplo.com';
```

---

## 2. E-mail (Resend)

O SMTP nativo do Supabase no plano gratuito entrega cerca de 2 e-mails por
hora — insuficiente para 2FA. Por isso o envio passa pelo Resend.

1. Crie a conta em [resend.com](https://resend.com).
2. **Domains → Add Domain**: cadastre o domínio do consultório e publique os
   registros SPF/DKIM no DNS. Sem domínio próprio dá para começar com
   `onboarding@resend.dev`, mas a entrega cai muito em caixas corporativas.
3. **API Keys → Create**: copie para `RESEND_API_KEY`.
4. Defina `EMAIL_FROM`, por exemplo:
   `EMAIL_FROM="Consultório <financeiro@seudominio.com.br>"`

O limite gratuito é de 3.000 e-mails por mês e 100 por dia — muito acima do
consumo de um consultório (códigos de 2FA + relatórios).

---

## 3. Aplicação na Vercel

```bash
cd apps/web
cp .env.example .env.local
# preencha as variáveis e gere o AUTH_SECRET:
openssl rand -base64 48
npm install
npm run dev
```

Para publicar:

1. Importe o repositório em [vercel.com](https://vercel.com).
2. **Root Directory**: `apps/web`.
3. Cadastre todas as variáveis de `.env.example` em *Environment Variables*.
4. Depois do primeiro deploy, ajuste `NEXT_PUBLIC_SITE_URL` para a URL real
   e adicione essa URL em **Supabase → Authentication → URL Configuration**,
   tanto em *Site URL* quanto em *Redirect URLs* (inclua `/definir-senha`).

---

## 4. Emissor de NFS-e

### Preparar o certificado

```bash
# Linux
base64 -w0 certificado.pfx > certificado.b64
# macOS
base64 -i certificado.pfx -o certificado.b64
```

O conteúdo do arquivo vai em `CERT_PFX_BASE64`. **Nunca** faça commit do
`.pfx` nem do `.b64` — o `.gitignore` já bloqueia os dois.

### Publicar no Fly.io

```bash
cd services/nfse
fly launch --no-deploy            # ajuste o nome do app no fly.toml
fly secrets set \
  SERVICE_TOKEN="$(openssl rand -hex 32)" \
  CERT_PFX_BASE64="$(cat certificado.b64)" \
  CERT_SENHA="senha-do-certificado" \
  AMBIENTE=HOMOLOGACAO
fly deploy
```

Confira a saúde do serviço — a resposta inclui os dias restantes do
certificado:

```bash
curl https://SEU-APP.fly.dev/saude
```

Por fim, informe ao app `NFSE_SERVICE_URL` e `NFSE_SERVICE_TOKEN` (o mesmo
valor de `SERVICE_TOKEN`).

### Dados fiscais

Entre no sistema como administrador, vá em **Configurações** e preencha CNPJ,
inscrição municipal, código IBGE do município, item da lista de serviços e
alíquota do ISS. Confirme o item da lista com a contabilidade: odontologia
costuma ser **04.12**, mas alguns municípios classificam diferente.

---

## 5. Homologação antes de produção

1. Mantenha `AMBIENTE=HOMOLOGACAO` no serviço e em Configurações.
2. Emita uma nota de teste a partir de uma conta de origem PJ.
3. Se houver rejeição, a mensagem da SEFIN aparece na tela de Notas fiscais.
4. Valide o XML gerado contra o XSD oficial do padrão nacional.
5. Só então troque para `PRODUCAO` nos dois lugares.

---

## Limites do plano gratuito

| Recurso | Limite | Observação |
|---|---|---|
| Supabase — banco | 500 MB | comporta anos de lançamentos |
| Supabase — projeto | pausa após 7 dias sem uso | uso diário não pausa |
| Resend | 3.000/mês, 100/dia | 2FA + relatórios cabem folgados |
| Vercel | 100 GB de banda/mês | sobra para uso interno |
| Fly.io | 3 VMs compartilhadas | o serviço dorme e acorda sozinho |

O ponto de atenção real é a **pausa do Supabase por inatividade**: um projeto
sem nenhuma requisição por 7 dias é suspenso e precisa ser reativado pelo
painel. Com uso diário do consultório isso não acontece.
