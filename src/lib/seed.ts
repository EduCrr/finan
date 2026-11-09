import type { Grupo, TipoMov } from './types'

export const CATEGORIAS_PADRAO: { nome: string; tipo: TipoMov; grupo: Grupo; cor: string }[] = [
  { nome: 'Salário', tipo: 'receita', grupo: 'receita', cor: '#16a34a' },
  { nome: 'Renda extra', tipo: 'receita', grupo: 'receita', cor: '#22c55e' },
  { nome: 'Rendimentos', tipo: 'receita', grupo: 'receita', cor: '#15803d' },
  { nome: 'Outras receitas', tipo: 'receita', grupo: 'receita', cor: '#4ade80' },
  { nome: 'Moradia', tipo: 'despesa', grupo: 'essencial', cor: '#0f766e' },
  { nome: 'Contas da casa', tipo: 'despesa', grupo: 'essencial', cor: '#0891b2' },
  { nome: 'Mercado', tipo: 'despesa', grupo: 'essencial', cor: '#2563eb' },
  { nome: 'Transporte', tipo: 'despesa', grupo: 'essencial', cor: '#4f46e5' },
  { nome: 'Saúde', tipo: 'despesa', grupo: 'essencial', cor: '#dc2626' },
  { nome: 'Educação', tipo: 'despesa', grupo: 'essencial', cor: '#9333ea' },
  { nome: 'Filhos / Pets', tipo: 'despesa', grupo: 'essencial', cor: '#c026d3' },
  { nome: 'Impostos e taxas', tipo: 'despesa', grupo: 'essencial', cor: '#57534e' },
  { nome: 'Restaurantes / Delivery', tipo: 'despesa', grupo: 'estilo', cor: '#ea580c' },
  { nome: 'Lazer', tipo: 'despesa', grupo: 'estilo', cor: '#f59e0b' },
  { nome: 'Compras', tipo: 'despesa', grupo: 'estilo', cor: '#db2777' },
  { nome: 'Assinaturas', tipo: 'despesa', grupo: 'estilo', cor: '#e11d48' },
  { nome: 'Viagens', tipo: 'despesa', grupo: 'estilo', cor: '#0284c7' },
  { nome: 'Cuidados pessoais', tipo: 'despesa', grupo: 'estilo', cor: '#a855f7' },
  { nome: 'Investimentos', tipo: 'despesa', grupo: 'investimento', cor: '#059669' },
  { nome: 'Outros', tipo: 'despesa', grupo: 'estilo', cor: '#64748b' },
]
