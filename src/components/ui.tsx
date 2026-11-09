import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { addMeses, nomeMes } from '../lib/dates'
import { moeda, parseValor, valorInput } from '../lib/format'

export function Modal({ titulo, aberto, onFechar, children, largo }: {
  titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode; largo?: boolean
}) {
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={`modal ${largo ? 'modal-largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-topo">
          <h2>{titulo}</h2>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  )
}

export function SeletorMes({ valor, onChange }: { valor: string; onChange: (m: string) => void }) {
  return (
    <div className="seletor-mes">
      <button className="btn-icone" onClick={() => onChange(addMeses(valor, -1))} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </button>
      <span>{nomeMes(valor)}</span>
      <button className="btn-icone" onClick={() => onChange(addMeses(valor, 1))} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

export function CampoValor({ valor, onChange, autoFocus, id }: {
  valor: number; onChange: (v: number) => void; autoFocus?: boolean; id?: string
}) {
  const [txt, setTxt] = useState(valorInput(valor))
  useEffect(() => {
    if (parseValor(txt) !== valor) setTxt(valorInput(valor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])
  return (
    <div className="campo-valor">
      <span>R$</span>
      <input id={id} inputMode="decimal" placeholder="0,00" value={txt} autoFocus={autoFocus}
        onChange={(e) => { setTxt(e.target.value); onChange(parseValor(e.target.value)) }}
        onBlur={() => setTxt(valorInput(parseValor(txt)))} />
    </div>
  )
}

export function Barra({ valor, max, cor, alerta = true }: { valor: number; max: number; cor?: string; alerta?: boolean }) {
  const pct = max > 0 ? valor / max : 0
  const c = alerta ? (pct > 1 ? 'var(--negativo)' : pct > 0.85 ? 'var(--alerta)' : cor ?? 'var(--primaria)') : cor
  return (
    <div className="barra" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.min(pct, 1) * 100}%`, background: c }} />
    </div>
  )
}

export function Card({ titulo, acao, children, className = '' }: {
  titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(titulo || acao) && <header className="card-topo"><h3>{titulo}</h3>{acao}</header>}
      {children}
    </section>
  )
}

export function Stat({ rotulo, valor, detalhe, tom, icone }: {
  rotulo: string; valor: number; detalhe?: ReactNode; tom?: 'pos' | 'neg' | 'neutro'; icone?: ReactNode
}) {
  return (
    <div className="stat">
      <div className="stat-rotulo">{icone}{rotulo}</div>
      <div className={`stat-valor ${tom ? `tom-${tom}` : ''}`}>{moeda(valor)}</div>
      {detalhe && <div className="stat-detalhe">{detalhe}</div>}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>
}

export function Bolinha({ cor }: { cor: string }) {
  return <span className="bolinha" style={{ background: cor }} />
}

export const CORES = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#f59e0b',
  '#16a34a', '#0891b2', '#dc2626', '#64748b', '#9333ea', '#0ea5e9']

export function SeletorCor({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="cores">
      {CORES.map((c) => (
        <button type="button" key={c} className={`cor ${c === valor ? 'ativa' : ''}`}
          style={{ background: c }} onClick={() => onChange(c)} aria-label={`Cor ${c}`} />
      ))}
    </div>
  )
}
