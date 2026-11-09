import type { Cartao, Categoria, Conta, Transacao } from './types'
import { addMeses, iso, partes } from './dates'
import { soma } from './format'

/**
 * Em qual fatura (mês de vencimento) cai uma compra feita em `data`.
 * Compra no dia do fechamento ou depois vai para a fatura seguinte.
 * Se o vencimento é antes do fechamento (ex.: fecha 28, vence 5),
 * a fatura vence no mês seguinte ao fechamento.
 */
export function competenciaFatura(
  cartao: Pick<Cartao, 'dia_fechamento' | 'dia_vencimento'>,
  data: string,
): string {
  const { ano, mes, dia } = partes(data)
  let mesFechamento = iso(ano, mes, 1)
  if (dia >= cartao.dia_fechamento) mesFechamento = addMeses(mesFechamento, 1)
  return cartao.dia_vencimento > cartao.dia_fechamento ? mesFechamento : addMeses(mesFechamento, 1)
}

/** divide um valor em N parcelas com centavos corretos (a diferença vai na 1ª) */
export function dividirParcelas(total: number, n: number): number[] {
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / n)
  const resto = centavos - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? resto : 0)) / 100)
}

/** saldo atual de uma conta (considera apenas lançamentos pagos) */
export function saldoConta(conta: Conta, transacoes: Transacao[]): number {
  const mov = transacoes.filter((t) => t.conta_id === conta.id && t.pago)
  return Number(conta.saldo_inicial) +
    soma(mov, (t) => (t.tipo === 'receita' ? Number(t.valor) : -Number(t.valor)))
}

export interface ResumoMes {
  receitas: number
  despesas: number
  saldo: number
  pendentesPagar: number
  pendentesReceber: number
  cartao: number
  fixas: number
  parcelas: number
}

export function resumoMes(ts: Transacao[]): ResumoMes {
  const v = (t: Transacao) => Number(t.valor)
  const rec = ts.filter((t) => t.tipo === 'receita')
  const desp = ts.filter((t) => t.tipo === 'despesa')
  return {
    receitas: soma(rec, v),
    despesas: soma(desp, v),
    saldo: soma(rec, v) - soma(desp, v),
    pendentesPagar: soma(desp.filter((t) => !t.pago), v),
    pendentesReceber: soma(rec.filter((t) => !t.pago), v),
    cartao: soma(desp.filter((t) => t.cartao_id), v),
    fixas: soma(desp.filter((t) => t.recorrencia_id), v),
    parcelas: soma(desp.filter((t) => (t.parcelas_total ?? 1) > 1), v),
  }
}

export interface FatiaCategoria {
  id: string
  nome: string
  cor: string
  valor: number
  pct: number
}

export function porCategoria(
  ts: Transacao[],
  cats: Categoria[],
  tipo: 'receita' | 'despesa' = 'despesa',
): FatiaCategoria[] {
  const mapa = new Map<string, number>()
  for (const t of ts) {
    if (t.tipo !== tipo) continue
    const k = t.categoria_id ?? 'sem'
    mapa.set(k, (mapa.get(k) ?? 0) + Number(t.valor))
  }
  const total = [...mapa.values()].reduce((a, b) => a + b, 0)
  return [...mapa.entries()]
    .map(([id, valor]) => {
      const c = cats.find((x) => x.id === id)
      return {
        id,
        nome: c?.nome ?? 'Sem categoria',
        cor: c?.cor ?? '#94a3b8',
        valor,
        pct: total ? valor / total : 0,
      }
    })
    .sort((a, b) => b.valor - a.valor)
}

/** agrupa transações por competência ('YYYY-MM-01') */
export function porMes(ts: Transacao[]): Map<string, Transacao[]> {
  const m = new Map<string, Transacao[]>()
  for (const t of ts) {
    const k = t.competencia.slice(0, 10)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(t)
  }
  return m
}
