import { supabase } from './supabase'
import type { Cartao, Recorrencia, TipoMov, Transacao } from './types'
import { addMeses, diaNoMes, fimMes, inicioMes } from './dates'
import { competenciaFatura, dividirParcelas } from './finance'
import { CATEGORIAS_PADRAO } from './seed'

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** O Supabase limita 1000 linhas por consulta: busca em páginas. */
async function buscarTudo<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tam = 1000
  const todos: T[] = []
  for (let de = 0; ; de += tam) {
    const lote = ok(await montar(de, de + tam - 1))
    todos.push(...lote)
    if (lote.length < tam) break
  }
  return todos
}

// ---------------------------------------------------------------- leitura

export function transacoesPorCompetencia(inicio: string, fim: string) {
  return buscarTudo<Transacao>((de, ate) =>
    supabase.from('transacoes').select('*')
      .gte('competencia', inicioMes(inicio)).lte('competencia', inicioMes(fim))
      .order('data', { ascending: false }).order('created_at', { ascending: false })
      .range(de, ate))
}

/** lançamentos pagos que movimentam contas (para calcular saldos) */
export function movimentosDeContas() {
  return buscarTudo<Transacao>((de, ate) =>
    supabase.from('transacoes').select('id,tipo,valor,conta_id,pago')
      .not('conta_id', 'is', null).eq('pago', true)
      .range(de, ate) as unknown as PromiseLike<{ data: Transacao[] | null; error: { message: string } | null }>)
}

/** compras de cartão ainda não pagas (todas as faturas futuras) — usado para o limite */
export function comprasCartaoEmAberto() {
  return buscarTudo<Transacao>((de, ate) =>
    supabase.from('transacoes').select('*')
      .not('cartao_id', 'is', null).eq('pago', false)
      .order('competencia').range(de, ate))
}

export async function parcelasDoGrupo(grupo: string) {
  return ok(await supabase.from('transacoes').select('*').eq('grupo_parcela', grupo)
    .order('parcela_atual')) as Transacao[]
}

// ---------------------------------------------------------------- escrita

export interface NovoLancamento {
  tipo: TipoMov
  descricao: string
  valor: number          // valor total (se parcelado, é dividido)
  data: string
  categoria_id: string | null
  conta_id: string | null
  cartao: Cartao | null
  parcelas: number
  pago: boolean
  observacao: string | null
}

export async function criarLancamento(l: NovoLancamento) {
  const n = Math.max(1, l.parcelas)
  const valores = dividirParcelas(l.valor, n)
  const grupo = n > 1 ? crypto.randomUUID() : null
  const compBase = l.cartao ? competenciaFatura(l.cartao, l.data) : inicioMes(l.data)

  const linhas = valores.map((valor, i) => ({
    tipo: l.tipo,
    descricao: l.descricao,
    valor,
    data: i === 0 ? l.data : addMeses(l.data, i),
    competencia: addMeses(compBase, i),
    categoria_id: l.categoria_id,
    conta_id: l.cartao ? null : l.conta_id,
    cartao_id: l.cartao?.id ?? null,
    // compras no cartão ficam "em aberto" até a fatura ser paga
    pago: l.cartao ? false : (i === 0 ? l.pago : false),
    parcela_atual: n > 1 ? i + 1 : null,
    parcelas_total: n > 1 ? n : null,
    grupo_parcela: grupo,
    observacao: l.observacao,
  }))
  ok(await supabase.from('transacoes').insert(linhas))
}

export async function atualizarTransacao(id: string, campos: Partial<Transacao>) {
  ok(await supabase.from('transacoes').update(campos).eq('id', id))
}

/** apaga e confere se apagou mesmo (o banco não dá erro quando nenhuma linha é afetada) */
async function apagar(q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const linhas = ok(await q)
  if (!linhas?.length) throw new Error('Nada foi excluído. Recarregue a página e tente de novo.')
}

/**
 * Exclui um lançamento. Se veio de uma conta fixa, marca o mês como "pulado"
 * para o sistema não gerar de novo na próxima vez que abrir.
 */
export async function excluirTransacao(t: Pick<Transacao, 'id' | 'data' | 'recorrencia_id'>) {
  if (t.recorrencia_id) {
    const rec = ok(await supabase.from('recorrencias').select('meses_pulados')
      .eq('id', t.recorrencia_id).maybeSingle()) as { meses_pulados: string[] } | null
    if (rec) {
      const mes = inicioMes(t.data)
      const pulados = [...new Set([...(rec.meses_pulados ?? []), mes])]
      ok(await supabase.from('recorrencias').update({ meses_pulados: pulados }).eq('id', t.recorrencia_id))
    }
  }
  await apagar(supabase.from('transacoes').delete().eq('id', t.id).select('id'))
}

/** grava o valor real das contas variáveis (luz, água, gás…) */
export async function preencherValores(itens: { id: string; valor: number }[]) {
  for (const i of itens) {
    ok(await supabase.from('transacoes').update({ valor: i.valor, a_preencher: false }).eq('id', i.id))
  }
}

/** exclui esta parcela e as seguintes do mesmo parcelamento */
export async function excluirParcelasFuturas(grupo: string, aPartirDe: number) {
  await apagar(supabase.from('transacoes').delete()
    .eq('grupo_parcela', grupo).gte('parcela_atual', aPartirDe).select('id'))
}

/** Paga a fatura: marca as compras como pagas e debita da conta escolhida. */
export async function pagarFatura(cartaoId: string, competencia: string, contaId: string) {
  ok(await supabase.from('transacoes')
    .update({ pago: true, conta_id: contaId })
    .eq('cartao_id', cartaoId).eq('competencia', inicioMes(competencia)).eq('pago', false))
}

export async function reabrirFatura(cartaoId: string, competencia: string) {
  ok(await supabase.from('transacoes').update({ pago: false, conta_id: null })
    .eq('cartao_id', cartaoId).eq('competencia', inicioMes(competencia)))
}

/**
 * Cria os lançamentos das contas fixas que ainda não existem no mês.
 * Usa o índice único (recorrencia_id, competencia) para nunca duplicar.
 */
export async function gerarContasFixas(competencia: string, recs: Recorrencia[], cartoes: Cartao[]) {
  const comp = inicioMes(competencia)
  const ativas = recs.filter((r) => r.ativo && inicioMes(r.inicio) <= comp && (!r.fim || inicioMes(r.fim) >= comp)
    && !(r.meses_pulados ?? []).some((m) => inicioMes(m) === comp))
  if (!ativas.length) return 0

  // procura pela DATA (sempre dentro do mês), não pela competência: no cartão a competência
  // é o mês da fatura, que pode ser o mês seguinte
  const existentes = ok(await supabase.from('transacoes').select('recorrencia_id')
    .gte('data', comp).lte('data', fimMes(comp))
    .in('recorrencia_id', ativas.map((r) => r.id))) as { recorrencia_id: string }[]
  const ja = new Set(existentes.map((e) => e.recorrencia_id))

  const faltando = ativas.filter((r) => !ja.has(r.id))
  if (!faltando.length) return 0

  // contas de valor variável: estima pelo último valor real informado
  const variaveis = faltando.filter((r) => r.valor_variavel)
  const ultimoValor = new Map<string, number>()
  if (variaveis.length) {
    const hist = ok(await supabase.from('transacoes').select('recorrencia_id,valor')
      .in('recorrencia_id', variaveis.map((r) => r.id)).eq('a_preencher', false)
      .lt('data', comp).order('data', { ascending: false }).limit(200)) as { recorrencia_id: string; valor: number }[]
    for (const h of hist) if (!ultimoValor.has(h.recorrencia_id)) ultimoValor.set(h.recorrencia_id, Number(h.valor))
  }

  const novas = faltando.map((r) => {
    const cartao = r.cartao_id ? cartoes.find((c) => c.id === r.cartao_id) : undefined
    // assinatura no cartão: a cobrança de um mês cai na fatura correspondente
    const data = diaNoMes(comp, r.dia)
    return {
      tipo: r.tipo,
      descricao: r.descricao,
      valor: r.valor_variavel ? ultimoValor.get(r.id) ?? r.valor : r.valor,
      a_preencher: r.valor_variavel,
      data,
      competencia: cartao ? competenciaFatura(cartao, data) : comp,
      categoria_id: r.categoria_id,
      conta_id: cartao ? null : r.conta_id,
      cartao_id: cartao?.id ?? null,
      pago: false,
      recorrencia_id: r.id,
    }
  })
  if (!novas.length) return 0
  const { error } = await supabase.from('transacoes').insert(novas)
  // 23505 = já foi gerado em outra aba/aparelho; pode ignorar
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)
  return novas.length
}

/** Gera as contas fixas de todos os meses desde o início até `ate` (inclusive). */
export async function gerarContasFixasAte(ate: string, recs: Recorrencia[], cartoes: Cartao[]) {
  if (!recs.length) return 0
  const inicio = recs.map((r) => inicioMes(r.inicio)).sort()[0]
  let total = 0
  // limita a 24 meses para trás para não gerar histórico gigante por engano
  let mes = inicio
  const limite = addMeses(inicioMes(ate), -24)
  if (mes < limite) mes = limite
  while (mes <= inicioMes(ate)) {
    total += await gerarContasFixas(mes, recs, cartoes)
    mes = addMeses(mes, 1)
  }
  return total
}

/** ao editar uma conta fixa, atualiza os lançamentos dela ainda em aberto a partir de `desde` */
export async function propagarRecorrencia(r: Recorrencia, desde: string) {
  ok(await supabase.from('transacoes').update({ descricao: r.descricao, categoria_id: r.categoria_id })
    .eq('recorrencia_id', r.id).eq('pago', false).gte('competencia', inicioMes(desde)))
  // valor: nas variáveis só troca a estimativa (não mexe no que você já preencheu)
  let q = supabase.from('transacoes').update({ valor: r.valor, a_preencher: r.valor_variavel })
    .eq('recorrencia_id', r.id).eq('pago', false).gte('competencia', inicioMes(desde))
  if (r.valor_variavel) q = q.eq('a_preencher', true)
  ok(await q)
}

/** remove lançamentos em aberto de uma conta fixa a partir de `desde` (ao desativar/excluir) */
export async function limparRecorrenciaFutura(id: string, desde: string) {
  ok(await supabase.from('transacoes').delete()
    .eq('recorrencia_id', id).eq('pago', false).gte('competencia', inicioMes(desde)))
}

export async function criarCategoriasPadrao() {
  const { error } = await supabase.from('categorias').insert(CATEGORIAS_PADRAO.map((c) => ({ ...c, icone: 'tag' })))
  // índice único de nome: se outra aba já criou, tudo bem
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)
}

// CRUD genérico para os cadastros simples
type Tabela = 'contas' | 'categorias' | 'cartoes' | 'recorrencias' | 'orcamentos' | 'metas' | 'meta_aportes'

export async function listar<T>(tabela: Tabela, ordem = 'created_at'): Promise<T[]> {
  return ok(await supabase.from(tabela).select('*').order(ordem)) as T[]
}

export async function salvar(tabela: Tabela, registro: Record<string, unknown>) {
  const { id, ...resto } = registro
  if (id) ok(await supabase.from(tabela).update(resto).eq('id', id as string))
  else ok(await supabase.from(tabela).insert(resto))
}

export async function excluir(tabela: Tabela, id: string) {
  await apagar(supabase.from(tabela).delete().eq('id', id).select('id'))
}
