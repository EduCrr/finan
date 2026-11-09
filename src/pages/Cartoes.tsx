import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useData } from '../context/DataContext'
import { useTransacoes } from '../lib/hooks'
import * as api from '../lib/api'
import type { Cartao, Transacao } from '../lib/types'
import { addMeses, dataBR, diaNoMes, hoje, inicioMes, mesCurto } from '../lib/dates'
import { competenciaFatura } from '../lib/finance'
import { moeda, soma } from '../lib/format'
import { Barra, Bolinha, CampoValor, Card, Modal, SeletorCor, SeletorMes, Vazio } from '../components/ui'
import { LancamentoForm } from '../components/LancamentoForm'

export function Cartoes() {
  const { cartoes, contas, executar, categoria, versao, notificar } = useData()
  const ativos = cartoes.filter((c) => c.ativo)
  const [selId, setSelId] = useState(ativos[0]?.id ?? '')
  const sel = cartoes.find((c) => c.id === selId) ?? ativos[0]
  const [mes, setMes] = useState(() => (sel ? competenciaFatura(sel, hoje()) : inicioMes(hoje())))
  const { dados } = useTransacoes(mes, mes)
  const [emAberto, setEmAberto] = useState<Transacao[]>([])
  const [form, setForm] = useState<Partial<Cartao> | null>(null)
  const [compra, setCompra] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [contaPag, setContaPag] = useState('')

  useEffect(() => {
    api.comprasCartaoEmAberto().then(setEmAberto).catch((e) => notificar(e.message, 'erro'))
  }, [versao, notificar])

  const fatura = useMemo(() => dados.filter((t) => t.cartao_id === sel?.id)
    .sort((a, b) => a.data.localeCompare(b.data)), [dados, sel])
  const total = soma(fatura, (t) => Number(t.valor))
  const aberta = fatura.some((t) => !t.pago)
  const usado = (c: Cartao) => soma(emAberto.filter((t) => t.cartao_id === c.id), (t) => Number(t.valor))

  const proximas = sel ? Array.from({ length: 8 }, (_, i) => {
    const m = addMeses(competenciaFatura(sel, hoje()), i)
    return { mes: mesCurto(m), valor: soma(emAberto.filter((t) => t.cartao_id === sel.id && t.competencia.slice(0, 10) === m), (t) => Number(t.valor)) }
  }) : []

  async function salvarCartao(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const ok = await executar(() => api.salvar('cartoes', {
      id: form.id, nome: form.nome, limite: form.limite ?? 0,
      dia_fechamento: form.dia_fechamento, dia_vencimento: form.dia_vencimento,
      conta_pagamento_id: form.conta_pagamento_id || null, cor: form.cor ?? '#7c3aed', ativo: form.ativo ?? true,
    }), 'Cartão salvo')
    if (ok) setForm(null)
  }

  if (!cartoes.length) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><h1>Cartões</h1></header>
        <Vazio>
          <CreditCard size={36} />
          <p>Cadastre seus cartões para controlar faturas, parcelas e limite.</p>
          <button className="btn btn-primario" onClick={() => setForm({ dia_fechamento: 1, dia_vencimento: 10 })}>
            <Plus size={16} /> Cadastrar cartão
          </button>
        </Vazio>
        {renderForm()}
      </div>
    )
  }

  function renderForm() {
    return (
      <Modal titulo={form?.id ? 'Editar cartão' : 'Novo cartão'} aberto={!!form} onFechar={() => setForm(null)}>
        {form && (
          <form className="form" onSubmit={salvarCartao}>
            <label>Nome<input required value={form.nome ?? ''} placeholder="Ex.: Nubank" onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
            <label>Limite<CampoValor valor={Number(form.limite ?? 0)} onChange={(v) => setForm({ ...form, limite: v })} /></label>
            <div className="linha">
              <label>Dia do fechamento<input type="number" min={1} max={31} required value={form.dia_fechamento ?? ''}
                onChange={(e) => setForm({ ...form, dia_fechamento: Number(e.target.value) })} /></label>
              <label>Dia do vencimento<input type="number" min={1} max={31} required value={form.dia_vencimento ?? ''}
                onChange={(e) => setForm({ ...form, dia_vencimento: Number(e.target.value) })} /></label>
            </div>
            <label>Conta que paga a fatura
              <select value={form.conta_pagamento_id ?? ''} onChange={(e) => setForm({ ...form, conta_pagamento_id: e.target.value })}>
                <option value="">Escolher na hora</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Cor<SeletorCor valor={form.cor ?? '#7c3aed'} onChange={(cor) => setForm({ ...form, cor })} /></label>
            {form.id && (
              <label className="check"><input type="checkbox" checked={form.ativo ?? true}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Cartão ativo</label>
            )}
            <footer className="form-acoes">
              {form.id && (
                <button type="button" className="btn btn-perigo" onClick={async () => {
                  if (!confirm('Excluir o cartão? As compras continuam, mas ficam sem cartão. Prefira desativar.')) return
                  if (await executar(() => api.excluir('cartoes', form.id!), 'Cartão excluído')) setForm(null)
                }}><Trash2 size={16} /></button>
              )}
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primario">Salvar</button>
            </footer>
          </form>
        )}
      </Modal>
    )
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Cartões</h1>
        <button className="btn" onClick={() => setForm({ dia_fechamento: 1, dia_vencimento: 10 })}><Plus size={16} /> Cartão</button>
      </header>

      <div className="cartoes-lista">
        {cartoes.map((c) => {
          const u = usado(c)
          return (
            <button key={c.id} className={`cartao-mini ${c.id === sel?.id ? 'ativo' : ''} ${!c.ativo ? 'inativo' : ''}`}
              style={{ ['--cor' as string]: c.cor }}
              onClick={() => { setSelId(c.id); setMes(competenciaFatura(c, hoje())) }}>
              <div className="cm-topo"><span>{c.nome}</span>
                <span className="btn-icone" role="button" onClick={(e) => { e.stopPropagation(); setForm(c) }}><Pencil size={14} /></span>
              </div>
              <small>Limite usado</small>
              <b>{moeda(u)}</b>
              {Number(c.limite) > 0 && <>
                <Barra valor={u} max={Number(c.limite)} />
                <small>Disponível {moeda(Number(c.limite) - u)} de {moeda(Number(c.limite))}</small>
              </>}
            </button>
          )
        })}
      </div>

      {sel && (
        <div className="grade-2 larga-esq">
          <Card titulo={<>Fatura · {sel.nome}</>} acao={<SeletorMes valor={mes} onChange={setMes} />}>
            <div className="fatura-topo">
              <div>
                <small>Total da fatura</small>
                <div className="stat-valor tom-neg">{moeda(total)}</div>
                <small>Vence em {dataBR(diaNoMes(mes, sel.dia_vencimento))} · {fatura.length ? (aberta ? 'em aberto' : 'paga ✔') : 'sem compras'}</small>
              </div>
              <div className="fatura-acoes">
                <button className="btn" onClick={() => setCompra(true)}><Plus size={16} /> Compra</button>
                {aberta ? (
                  <button className="btn btn-primario" onClick={() => { setContaPag(sel.conta_pagamento_id ?? contas[0]?.id ?? ''); setPagando(true) }}>
                    Pagar fatura
                  </button>
                ) : fatura.length > 0 && (
                  <button className="btn" onClick={() => executar(() => api.reabrirFatura(sel.id, mes), 'Fatura reaberta')}>Reabrir</button>
                )}
              </div>
            </div>
            {fatura.length ? (
              <ul className="lista-simples">
                {fatura.map((t) => (
                  <li key={t.id}>
                    <div>
                      <span>{t.descricao} {t.parcelas_total && <span className="tag">{t.parcela_atual}/{t.parcelas_total}</span>}</span>
                      <small><Bolinha cor={categoria(t.categoria_id)?.cor ?? '#94a3b8'} /> {categoria(t.categoria_id)?.nome ?? 'Sem categoria'} · {dataBR(t.data)}</small>
                    </div>
                    <b>{moeda(Number(t.valor))}</b>
                  </li>
                ))}
              </ul>
            ) : <Vazio>Nenhuma compra nesta fatura.</Vazio>}
          </Card>

          <Card titulo="Próximas faturas (já comprometido)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={proximas}>
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => moeda(v)} cursor={{ fill: 'var(--hover)' }} />
                <Bar dataKey="valor" name="Fatura" fill={sel.cor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="dica">Parcelas e assinaturas já lançadas que vão cair nas próximas faturas.
              Fecha dia {sel.dia_fechamento}, vence dia {sel.dia_vencimento}.</p>
          </Card>
        </div>
      )}

      {renderForm()}
      <LancamentoForm aberto={compra} onFechar={() => setCompra(false)} cartaoInicial={sel?.id} />

      <Modal titulo="Pagar fatura" aberto={pagando} onFechar={() => setPagando(false)}>
        <div className="form">
          <p>Pagar <b>{moeda(soma(fatura.filter((t) => !t.pago), (t) => Number(t.valor)))}</b> da fatura {sel?.nome} ({mesCurto(mes)}).</p>
          <label>Debitar da conta
            <select value={contaPag} onChange={(e) => setContaPag(e.target.value)}>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          {!contas.length && <p className="erro">Cadastre uma conta em Cadastros primeiro.</p>}
          <footer className="form-acoes">
            <button className="btn" onClick={() => setPagando(false)}>Cancelar</button>
            <button className="btn btn-primario" disabled={!contaPag} onClick={async () => {
              if (await executar(() => api.pagarFatura(sel!.id, mes, contaPag), 'Fatura paga')) setPagando(false)
            }}>Confirmar pagamento</button>
          </footer>
        </div>
      </Modal>
    </div>
  )
}
