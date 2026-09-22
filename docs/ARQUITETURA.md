# Decisões de arquitetura

## Autorização mora no banco, não na interface

Toda regra de acesso é uma policy de Row Level Security no PostgreSQL. As
verificações em `lib/auth/session.ts` existem só para dar uma mensagem
decente ao usuário — se falhassem, o banco ainda recusaria.

Isso importa porque o cliente Supabase é acessível pelo navegador com o token
do usuário. Uma regra que vivesse apenas no React seria contornável com o
console aberto.

As funções auxiliares (`is_admin()`, `is_financeiro()`, `is_balcao()`) são
`SECURITY DEFINER` para que a consulta a `profiles` dentro da policy não
dispare o RLS da própria `profiles` e cause recursão.

## O balcão é confinado por origem

As policies do perfil `BALCAO` carregam `and origem = 'CLINICA'` tanto no
`using` quanto no `with check`. Em `parcelas`, onde a origem não está na
tabela, a checagem usa `exists` contra `recebiveis`. Resultado: o balcão não
lê, não insere e não altera nada de PF ou PJ.

## Parcelas são geradas no banco

`criar_recebivel()` insere o recebível e as parcelas numa transação só. O
resto da divisão em centavos vai para a primeira parcela, de forma que a soma
das parcelas seja sempre exatamente o valor total — sem os centavos perdidos
que aparecem quando se arredonda parcela a parcela.

A prévia no formulário reproduz a mesma regra em JavaScript, para o operador
conferir antes de gravar.

## Quitação é integral, com data obrigatória

Uma constraint garante que parcela `PAGA` tenha `data_pagamento` e
`valor_pago` preenchidos, e que parcela não paga não os tenha. O estado
inconsistente simplesmente não é representável.

Pagamento parcial foi deliberadamente deixado de fora: cobre poucos casos e
dobraria a complexidade dos relatórios. Se um dia for necessário, o caminho é
uma tabela `pagamentos` filha de `parcelas`.

## 2FA fora do Supabase Auth

O Supabase oferece MFA por TOTP (aplicativo autenticador), não por e-mail. Como
o requisito era e-mail, o segundo fator é próprio:

- código de 6 dígitos guardado só como `sha256(código + AUTH_SECRET)`
- validade de 10 minutos, 5 tentativas, código anterior invalidado a cada novo
- no máximo 5 códigos por 15 minutos por usuário
- após a validação, um cookie HttpOnly assinado com HMAC marca a sessão por 12h
- "confiar neste dispositivo" grava um token aleatório de 30 dias, também só
  como hash

O cookie é verificado no middleware com Web Crypto, que roda no runtime edge.
Trocar o perfil de alguém ou desativar a conta revoga os dispositivos
lembrados.

## Emissor de NFS-e isolado

Ver a seção correspondente no README. O resumo: mTLS não roda em Deno Deploy
nem no serverless da Vercel, então o certificado A1 fica em um serviço Node
dedicado, acessado por token compartilhado.

Isso tem um efeito colateral bom: o `.pfx` existe em um lugar só, e esse lugar
não tem acesso ao banco.

## Duas interfaces, não uma responsiva por acidente

Listagens usam tabela no desktop e cartões empilhados no celular — componentes
diferentes, não uma tabela com rolagem lateral. Os formulários abrem em
`<dialog>` centralizado no desktop e como folha no rodapé no celular, onde o
polegar alcança.

Detalhes que evitam atrito no aparelho: campos com no mínimo 16px (o Safari dá
zoom em fontes menores), alvos de toque de 44px, `env(safe-area-inset-bottom)`
respeitado na barra inferior e `inputMode` adequado em cada campo numérico.
