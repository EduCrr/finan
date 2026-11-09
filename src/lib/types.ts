export type TipoMov = 'receita' | 'despesa'
export type Grupo = 'essencial' | 'estilo' | 'investimento' | 'receita'

export interface Conta {
  id: string
  nome: string
  tipo: 'corrente' | 'poupanca' | 'carteira' | 'investimento'
  saldo_inicial: number
  cor: string
  ativo: boolean
}

export interface Categoria {
  id: string
  nome: string
  tipo: TipoMov
  grupo: Grupo
  cor: string
  icone: string
  ativo: boolean
}

export interface Cartao {
  id: string
  nome: string
  limite: number
  dia_fechamento: number
  dia_vencimento: number
  conta_pagamento_id: string | null
  cor: string
  ativo: boolean
}

export interface Recorrencia {
  id: string
  descricao: string
  tipo: TipoMov
  valor: number
  dia: number
  categoria_id: string | null
  conta_id: string | null
  cartao_id: string | null
  inicio: string
  fim: string | null
  ativo: boolean
  /** valor muda todo mês (luz, água, gás): `valor` é só a estimativa inicial */
  valor_variavel: boolean
  /** meses (YYYY-MM-01) em que o lançamento foi excluído de propósito */
  meses_pulados: string[]
}

export interface Transacao {
  id: string
  tipo: TipoMov
  descricao: string
  valor: number
  data: string
  competencia: string
  categoria_id: string | null
  conta_id: string | null
  cartao_id: string | null
  pago: boolean
  parcela_atual: number | null
  parcelas_total: number | null
  grupo_parcela: string | null
  recorrencia_id: string | null
  observacao: string | null
  /** valor estimado de conta variável, esperando o valor real */
  a_preencher: boolean
}

export interface Orcamento {
  id: string
  categoria_id: string
  valor: number
}

export interface Meta {
  id: string
  nome: string
  valor_alvo: number
  valor_atual: number
  prazo: string | null
  cor: string
  concluida: boolean
}

export const GRUPO_LABEL: Record<Grupo, string> = {
  essencial: 'Essencial',
  estilo: 'Estilo de vida',
  investimento: 'Poupança / investimento',
  receita: 'Receita',
}

export const TIPO_CONTA_LABEL: Record<Conta['tipo'], string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Dinheiro / carteira',
  investimento: 'Investimento',
}
