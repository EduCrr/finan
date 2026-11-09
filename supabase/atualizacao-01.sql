-- =====================================================================
-- Atualização 01 — contas de valor variável e exclusão de contas fixas
-- Rode uma vez no SQL Editor do Supabase (pode repetir sem problema).
-- =====================================================================

-- conta fixa cujo valor muda todo mês (luz, água, gás): o sistema lança
-- uma estimativa e pede para você preencher o valor real
alter table recorrencias add column if not exists valor_variavel boolean not null default false;

-- meses em que o lançamento da conta fixa foi excluído de propósito
-- (para o sistema não gerar de novo)
alter table recorrencias add column if not exists meses_pulados date[] not null default '{}';

-- lançamento com valor estimado, esperando o valor real
alter table transacoes add column if not exists a_preencher boolean not null default false;
