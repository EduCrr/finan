-- =====================================================================
-- Finan — schema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- É idempotente: pode rodar de novo sem perder dados.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Contas bancárias / carteiras
-- ---------------------------------------------------------------------
create table if not exists contas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null,
  tipo          text not null default 'corrente'
                check (tipo in ('corrente','poupanca','carteira','investimento')),
  saldo_inicial numeric(14,2) not null default 0,
  cor           text not null default '#0f766e',
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Categorias
--   grupo: usado na análise 50/30/20
--     essencial   = moradia, mercado, saúde, transporte...
--     estilo      = lazer, restaurantes, compras, assinaturas...
--     investimento= reserva, investimentos, metas
--     receita     = categorias de entrada
-- ---------------------------------------------------------------------
create table if not exists categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  tipo       text not null check (tipo in ('receita','despesa')),
  grupo      text not null default 'essencial'
             check (grupo in ('essencial','estilo','investimento','receita')),
  cor        text not null default '#64748b',
  icone      text not null default 'tag',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- não permite duas categorias com o mesmo nome e tipo.
-- Se já houver duplicadas no banco, pula com um aviso: rode o corrigir-duplicados.sql.
do $$
begin
  if exists (select 1 from categorias group by user_id, tipo, lower(trim(nome)) having count(*) > 1) then
    raise notice 'Há categorias duplicadas: rode supabase/corrigir-duplicados.sql';
  else
    create unique index if not exists categorias_nome_uq
      on categorias (user_id, tipo, lower(trim(nome)));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Cartões de crédito
-- ---------------------------------------------------------------------
create table if not exists cartoes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome            text not null,
  limite          numeric(14,2) not null default 0,
  dia_fechamento  int not null check (dia_fechamento between 1 and 31),
  dia_vencimento  int not null check (dia_vencimento between 1 and 31),
  conta_pagamento_id uuid references contas(id) on delete set null,
  cor             text not null default '#7c3aed',
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Contas fixas / recorrências (salário, aluguel, internet, assinaturas)
-- ---------------------------------------------------------------------
create table if not exists recorrencias (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  descricao    text not null,
  tipo         text not null check (tipo in ('receita','despesa')),
  valor        numeric(14,2) not null check (valor > 0),
  dia          int not null check (dia between 1 and 31),
  categoria_id uuid references categorias(id) on delete set null,
  conta_id     uuid references contas(id) on delete set null,
  cartao_id    uuid references cartoes(id) on delete set null,
  inicio       date not null default date_trunc('month', now())::date,
  fim          date,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Lançamentos
--   competencia: 1º dia do mês em que o valor "pesa" no orçamento.
--     - lançamento comum: mês da data
--     - cartão: mês de vencimento da fatura (cada parcela num mês)
-- ---------------------------------------------------------------------
create table if not exists transacoes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo            text not null check (tipo in ('receita','despesa')),
  descricao       text not null,
  valor           numeric(14,2) not null check (valor > 0),
  data            date not null,
  competencia     date not null,
  categoria_id    uuid references categorias(id) on delete set null,
  conta_id        uuid references contas(id) on delete set null,
  cartao_id       uuid references cartoes(id) on delete set null,
  pago            boolean not null default true,
  parcela_atual   int,
  parcelas_total  int,
  grupo_parcela   uuid,
  recorrencia_id  uuid references recorrencias(id) on delete set null,
  observacao      text,
  created_at      timestamptz not null default now()
);

create index if not exists transacoes_user_comp_idx on transacoes (user_id, competencia);
create index if not exists transacoes_cartao_idx    on transacoes (cartao_id, competencia);
create index if not exists transacoes_grupo_idx     on transacoes (grupo_parcela);
-- impede gerar a mesma conta fixa duas vezes no mesmo mês
create unique index if not exists transacoes_recorrencia_mes_uq
  on transacoes (recorrencia_id, competencia) where recorrencia_id is not null;

-- ---------------------------------------------------------------------
-- Orçamento mensal por categoria (vale para todos os meses)
-- ---------------------------------------------------------------------
create table if not exists orcamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  valor        numeric(14,2) not null check (valor > 0),
  created_at   timestamptz not null default now(),
  unique (user_id, categoria_id)
);

-- ---------------------------------------------------------------------
-- Metas de economia
-- ---------------------------------------------------------------------
create table if not exists metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  valor_alvo  numeric(14,2) not null check (valor_alvo > 0),
  valor_atual numeric(14,2) not null default 0,
  prazo       date,
  cor         text not null default '#0ea5e9',
  concluida   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists meta_aportes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meta_id    uuid not null references metas(id) on delete cascade,
  valor      numeric(14,2) not null,
  data       date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Atualização 01: contas de valor variável e exclusão de contas fixas
-- ---------------------------------------------------------------------
alter table recorrencias add column if not exists valor_variavel boolean not null default false;
alter table recorrencias add column if not exists meses_pulados date[] not null default '{}';
alter table transacoes  add column if not exists a_preencher boolean not null default false;

-- ---------------------------------------------------------------------
-- Row Level Security: cada usuário só enxerga os próprios dados
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contas','categorias','cartoes','recorrencias',
                           'transacoes','orcamentos','metas','meta_aportes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dono" on %I', t);
    execute format(
      'create policy "dono" on %I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
