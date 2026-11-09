# Finan — finanças da família

Sistema web para controlar receitas, despesas, cartões, contas fixas, orçamento e metas,
com uma análise automática de onde o dinheiro está indo e o que dá para melhorar.

**Stack:** React + TypeScript (Vite) · Supabase (Postgres + login) · Recharts.
**Hospedagem gratuita:** Vercel (site) + Supabase (banco).

## O que tem

| Tela | Para que serve |
|---|---|
| **Painel** | Saldo das contas, receitas e despesas do mês, sobra, alertas (contas vencidas, orçamento estourado), gastos por categoria, últimos 6 meses, contas a pagar e faturas |
| **Lançamentos** | Receitas e despesas do mês, com filtros, baixa com 1 clique, edição e exclusão (inclusive "esta e as próximas parcelas") |
| **Cartões** | Fatura de cada mês, limite usado e disponível, pagamento da fatura (debita da conta), parcelas que vão cair nas próximas faturas |
| **Contas fixas** | Salário, aluguel, luz, internet, assinaturas… são lançadas sozinhas todo mês como pendentes. Mostra quanto da renda já está comprometido |
| **Orçamento** | Limite mensal por categoria, média dos últimos 3 meses, projeção pelo ritmo de gasto, botão "Sugerir limites" |
| **Metas** | Objetivos com prazo e quanto guardar por mês; sugestão automática de reserva de emergência (6× o gasto médio) |
| **Análise** | Dicas personalizadas, regra 50/30/20, comparação de cada categoria com a média, evolução em 12 meses, sobra acumulada, parcelamentos em andamento e o que já está comprometido nos próximos meses |
| **Cadastros** | Contas bancárias, categorias (com o grupo usado na regra 50/30/20) e exportação de tudo em CSV (abre no Excel) |

### Regras importantes

- **Compra no cartão** entra no mês da **fatura** em que será paga, não no mês da compra.
  Compra feita no dia do fechamento ou depois vai para a fatura seguinte.
  Parcelado em N vezes gera N lançamentos, um em cada fatura.
- **Saldo das contas** = saldo inicial + tudo que foi pago/recebido naquela conta.
  Compras no cartão só saem da conta quando você clica em **Pagar fatura**.
- **Contas fixas** são geradas automaticamente até o mês seguinte ao atual
  (e para meses futuros, quando você navega até eles em Lançamentos).
  Alterar o valor de uma conta fixa atualiza os lançamentos em aberto daquele mês em diante.

---

## 1. Criar o banco (Supabase, grátis)

1. Crie uma conta em <https://supabase.com> e clique em **New project**
   (região sugerida: *South America (São Paulo)*). Guarde a senha do banco.
2. No menu do projeto, abra **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Crie o usuário administrador em **Authentication → Users → Add user → Create new user**:
   informe e-mail e senha e marque **Auto Confirm User**.
4. Bloqueie novos cadastros: **Authentication → Sign In / Providers** →
   desligue **Allow new users to sign up**. Assim só o seu usuário consegue entrar.
5. Copie as chaves em **Project Settings → API**: *Project URL* e *anon public key*.

> A `anon key` pode ficar no front-end sem problema: os dados são protegidos
> pelas regras de segurança por linha (RLS) do `schema.sql`, e cada usuário só vê o que é dele.

## 2. Rodar no computador

```bash
cd C:\Sistemas\finan
copy .env.example .env.local    # e preencha as duas variáveis
npm install
npm run dev
```

Abra <http://localhost:5173> e entre com o usuário criado no passo 1.3.
No primeiro acesso as categorias padrão são criadas automaticamente.

**Por onde começar:** Cadastros (contas com o saldo de hoje) → Cartões → Contas fixas
(salários e contas do mês) → lance o dia a dia em **+ Novo lançamento**.

## 3. Publicar (Vercel, grátis)

1. Suba esta pasta para um repositório no GitHub (pode ser privado).
   O `.env.local` **não** vai junto (está no `.gitignore`).
2. Em <https://vercel.com>, entre com o GitHub, clique em **Add New → Project** e importe o repositório.
   A Vercel detecta o Vite sozinha.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. Você recebe um endereço do tipo `https://finan-xxxx.vercel.app`.
5. No Supabase, em **Authentication → URL Configuration**, coloque esse endereço em **Site URL**.

A cada `git push` a Vercel publica a nova versão sozinha.
No celular, abra o site e use **Adicionar à tela inicial** para usar como um app.

## Limites do plano gratuito

- **Supabase:** 500 MB de banco (dá para décadas de lançamentos de uma família).
  Projetos **sem nenhum acesso por 7 dias são pausados**. Para reativar, basta entrar no painel
  do Supabase e clicar em *Restore*; nenhum dado é perdido. Usando o Finan toda semana, isso não acontece.
- **Vercel (Hobby):** gratuito para uso pessoal e não comercial.
- **Backup:** use **Cadastros → Exportar CSV** de vez em quando.
