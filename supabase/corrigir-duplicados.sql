-- =====================================================================
-- Corrige registros duplicados (categorias e contas fixas).
-- Rode UMA vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Nada que já foi pago é apagado: os lançamentos são reapontados para o registro mantido.
-- =====================================================================
begin;

-- ---------- 1. Categorias com o mesmo nome e tipo: mantém a mais antiga
create temp table dup_cat on commit drop as
select id, manter from (
  select id,
         first_value(id) over (partition by user_id, tipo, lower(trim(nome)) order by created_at, id) as manter
  from categorias
) x
where id <> manter;

update transacoes  t set categoria_id = d.manter from dup_cat d where t.categoria_id = d.id;
update recorrencias r set categoria_id = d.manter from dup_cat d where r.categoria_id = d.id;
-- orçamento: se a categoria mantida já tem limite, descarta o da duplicada
delete from orcamentos o using dup_cat d
 where o.categoria_id = d.id
   and exists (select 1 from orcamentos o2 where o2.categoria_id = d.manter);
update orcamentos o set categoria_id = d.manter from dup_cat d where o.categoria_id = d.id;
delete from categorias c using dup_cat d where c.id = d.id;

-- ---------- 2. Contas fixas idênticas (criadas por duplo clique): mantém a mais antiga
create temp table dup_rec on commit drop as
select id, manter from (
  select id,
         first_value(id) over (
           partition by user_id, tipo, lower(trim(descricao)), valor, dia,
                        coalesce(categoria_id::text, ''), coalesce(conta_id::text, ''), coalesce(cartao_id::text, '')
           order by created_at, id) as manter
  from recorrencias
) x
where id <> manter;

-- lançamentos em aberto gerados pela duplicada: apaga (a mantida já gera o seu)
delete from transacoes t using dup_rec d where t.recorrencia_id = d.id and not t.pago;
-- lançamentos já pagos: mantém, só desvincula da duplicada
update transacoes t set recorrencia_id = null from dup_rec d where t.recorrencia_id = d.id;
delete from recorrencias r using dup_rec d where r.id = d.id;

-- ---------- 3. Trava para não duplicar categorias de novo
create unique index if not exists categorias_nome_uq
  on categorias (user_id, tipo, lower(trim(nome)));

commit;

-- Conferência: deve voltar vazio
select tipo, nome, count(*) from categorias group by user_id, tipo, nome having count(*) > 1;
