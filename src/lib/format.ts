const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCurto = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
})
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

export const moeda = (v: number) => brl.format(v || 0)
export const moedaCurta = (v: number) => brlCurto.format(v || 0)
export const percentual = (v: number) => (Number.isFinite(v) ? pct.format(v) : '—')

/** "1.234,56" | "1234.56" | "1234,5" -> 1234.56 */
export function parseValor(txt: string): number {
  const limpo = txt.replace(/[^\d,.-]/g, '')
  if (limpo.includes(',')) return Number(limpo.replace(/\./g, '').replace(',', '.')) || 0
  return Number(limpo) || 0
}

/** 1234.5 -> "1234,50" (para preencher inputs) */
export const valorInput = (v: number) => (v ? v.toFixed(2).replace('.', ',') : '')

export function soma<T>(lista: T[], f: (x: T) => number): number {
  return lista.reduce((a, x) => a + f(x), 0)
}
