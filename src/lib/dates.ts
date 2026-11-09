// Datas sempre como string 'YYYY-MM-DD' (sem fuso) para evitar bugs de timezone.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function hoje(): string {
  const d = new Date()
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function partes(data: string) {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  return { ano: a, mes: m, dia: d }
}

export function ultimoDia(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate()
}

/** primeiro dia do mês: '2026-11-01' */
export function inicioMes(data: string): string {
  const { ano, mes } = partes(data)
  return iso(ano, mes, 1)
}

export function fimMes(data: string): string {
  const { ano, mes } = partes(data)
  return iso(ano, mes, ultimoDia(ano, mes))
}

export function addMeses(data: string, n: number): string {
  const { ano, mes, dia } = partes(data)
  const total = ano * 12 + (mes - 1) + n
  const na = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return iso(na, nm, Math.min(dia, ultimoDia(na, nm)))
}

/** data no mês da competência, com o dia limitado ao último dia do mês */
export function diaNoMes(competencia: string, dia: number): string {
  const { ano, mes } = partes(competencia)
  return iso(ano, mes, Math.min(dia, ultimoDia(ano, mes)))
}

export function nomeMes(data: string): string {
  const { ano, mes } = partes(data)
  return `${MESES[mes - 1]} de ${ano}`
}

export function mesCurto(data: string): string {
  const { ano, mes } = partes(data)
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`
}

export function dataBR(data: string): string {
  const { ano, mes, dia } = partes(data)
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}

/** diferença em meses entre duas datas (b - a) */
export function difMeses(a: string, b: string): number {
  const pa = partes(a)
  const pb = partes(b)
  return (pb.ano - pa.ano) * 12 + (pb.mes - pa.mes)
}
