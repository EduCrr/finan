import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { Cartao, Categoria, Conta, Meta, Orcamento, Recorrencia, Transacao } from '../lib/types'
import { addMeses, hoje, inicioMes } from '../lib/dates'
import { saldoConta } from '../lib/finance'

interface Toast { id: number; msg: string; tipo: 'ok' | 'erro' }

interface DataCtx {
  pronto: boolean
  contas: Conta[]
  categorias: Categoria[]
  cartoes: Cartao[]
  recorrencias: Recorrencia[]
  orcamentos: Orcamento[]
  metas: Meta[]
  saldos: Map<string, number>
  saldoTotal: number
  /** muda sempre que algo é gravado; páginas usam para recarregar lançamentos */
  versao: number
  recarregar: () => Promise<void>
  /** executa uma gravação, mostra erro/sucesso e recarrega tudo */
  executar: (fn: () => Promise<unknown>, sucesso?: string) => Promise<boolean>
  notificar: (msg: string, tipo?: 'ok' | 'erro') => void
  categoria: (id: string | null) => Categoria | undefined
}

const Ctx = createContext<DataCtx>(null!)

export function DataProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [movs, setMovs] = useState<Transacao[]>([])
  const [versao, setVersao] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])

  const notificar = useCallback((msg: string, tipo: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3000)
  }, [])

  const recarregar = useCallback(async () => {
    const [co, ca, cr, re, or, me, mv] = await Promise.all([
      api.listar<Conta>('contas', 'nome'),
      api.listar<Categoria>('categorias', 'nome'),
      api.listar<Cartao>('cartoes', 'nome'),
      api.listar<Recorrencia>('recorrencias', 'dia'),
      api.listar<Orcamento>('orcamentos'),
      api.listar<Meta>('metas'),
      api.movimentosDeContas(),
    ])
    setContas(co); setCategorias(ca); setCartoes(cr); setRecorrencias(re)
    setOrcamentos(or); setMetas(me); setMovs(mv)
    setVersao((v) => v + 1)
  }, [])

  // carga inicial: cria categorias padrão no 1º acesso e gera contas fixas até o mês que vem.
  // O ref impede rodar 2x em paralelo (o StrictMode do React executa efeitos duas vezes em dev).
  const iniciou = useRef(false)
  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    ;(async () => {
      try {
        const cats = await api.listar<Categoria>('categorias')
        if (!cats.length) await api.criarCategoriasPadrao()
        const [recs, carts] = await Promise.all([
          api.listar<Recorrencia>('recorrencias'),
          api.listar<Cartao>('cartoes'),
        ])
        await api.gerarContasFixasAte(addMeses(inicioMes(hoje()), 1), recs, carts)
        await recarregar()
      } catch (e) {
        notificar(`Erro ao carregar dados: ${(e as Error).message}`, 'erro')
      } finally {
        setPronto(true)
      }
    })()
  }, [recarregar, notificar])

  // ignora cliques repetidos enquanto uma gravação está em andamento (evita registros duplicados)
  const gravando = useRef(false)
  const executar = useCallback(async (fn: () => Promise<unknown>, sucesso?: string) => {
    if (gravando.current) return false
    gravando.current = true
    try {
      await fn()
      await recarregar()
      if (sucesso) notificar(sucesso)
      return true
    } catch (e) {
      notificar((e as Error).message, 'erro')
      return false
    } finally {
      gravando.current = false
    }
  }, [recarregar, notificar])

  const saldos = useMemo(() => new Map(contas.map((c) => [c.id, saldoConta(c, movs)])), [contas, movs])
  const saldoTotal = useMemo(
    () => contas.filter((c) => c.ativo).reduce((a, c) => a + (saldos.get(c.id) ?? 0), 0),
    [contas, saldos],
  )
  const categoria = useCallback((id: string | null) => categorias.find((c) => c.id === id), [categorias])

  return (
    <Ctx.Provider value={{
      pronto, contas, categorias, cartoes, recorrencias, orcamentos, metas, saldos, saldoTotal,
      versao, recarregar, executar, notificar, categoria,
    }}>
      {children}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tipo}`}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  )
}

export const useData = () => useContext(Ctx)
