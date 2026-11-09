import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, CreditCard, Pencil, Repeat, Search, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTransacoes } from '../lib/hooks'
import * as api from '../lib/api'
import type { Transacao } from '../lib/types'
import { addMeses, dataBR, hoje, inicioMes } from '../lib/dates'
import { resumoMes } from '../lib/finance'
import { moeda } from '../lib/format'
import { Bolinha, Modal, SeletorMes, Vazio } from '../components/ui'
import { LancamentoForm } from '../components/LancamentoForm'
import { PreencherContas } from '../components/PreencherContas'

export function Lancamentos() {
  const { categorias, contas, cartoes, recorrencias, executar, categoria, recarregar } = useData()
  const [mes, setMes] = useState(inicioMes(hoje()))
  const { dados, carregando } = useTransacoes(mes, mes)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [cat, setCat] = useState('')
  const [origem, setOrigem] = useState('')
  const [status, setStatus] = useState('')
  const [editar, setEditar] = useState<Transacao | null>(null)
  const [excluindo, setExcluindo] = useState<Transacao | null>(null)

  // ao navegar para meses futuros (até 12), já cria as contas fixas daquele mês
  useEffect(() => {
    const limite = addMeses(inicioMes(hoje()), 12)
    if (mes > addMeses(inicioMes(hoje()), 1) && mes <= limite) {
      api.gerarContasFixas(mes, recorrencias, cartoes).then((n) => { if (n) recarregar() })
    }
  }, [mes, recorrencias, cartoes, recarregar])

  const filtrados = useMemo(() => dados.filter((t) => {
    if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false
    if (tipo && t.tipo !== tipo) return false
    if (cat && t.categoria_id !== cat) return false
    if (origem && t.conta_id !== origem && t.cartao_id !== origem) return false
    if (status === 'pendente' && t.pago) return false
    if (status === 'pago' && !t.pago) return false
    return true
  }), [dados, busca, tipo, cat, origem, status])

  const r = resumoMes(filtrados)
  const porDia = useMemo(() => {
    const m = new Map<string, Transacao[]>()
    for (const t of filtrados) {
      if (!m.has(t.data)) m.set(t.data, [])
      m.get(t.data)!.push(t)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtrados])

  const nomeOrigem = (t: Transacao) =>
    t.cartao_id ? cartoes.find((c) => c.id === t.cartao_id)?.nome : contas.find((c) => c.id === t.conta_id)?.nome

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Lançamentos</h1>
        <SeletorMes valor={mes} onChange={setMes} />
      </header>

      <div className="resumo-linha">
        <span>Receitas <b className="tom-pos">{moeda(r.receitas)}</b></span>
        <span>Despesas <b className="tom-neg">{moeda(r.despesas)}</b></span>
        <span>Resultado <b className={r.saldo >= 0 ? 'tom-pos' : 'tom-neg'}>{moeda(r.saldo)}</b></span>
        <span>Em aberto <b>{moeda(r.pendentesPagar)}</b></span>
      </div>

      <PreencherContas transacoes={dados} />

      <div className="filtros">
        <div className="busca"><Search size={16} />
          <input placeholder="Buscar descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Receitas e despesas</option>
          <option value="receita">Só receitas</option>
          <option value="despesa">Só despesas</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as contas e cartões</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          {cartoes.map((c) => <option key={c.id} value={c.id}>💳 {c.nome}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Qualquer situação</option>
          <option value="pendente">Em aberto</option>
          <option value="pago">Pagos / recebidos</option>
        </select>
      </div>

      {carregando ? <div className="carregando">Carregando…</div> : !porDia.length ? (
        <Vazio>Nenhum lançamento encontrado. Use o botão <b>+ Novo lançamento</b> para começar.</Vazio>
      ) : (
        <div className="lista-dias">
          {porDia.map(([dia, ts]) => (
            <section key={dia}>
              <h4>{dataBR(dia)}</h4>
              <ul className="lista-lanc">
                {ts.map((t) => {
                  const c = categoria(t.categoria_id)
                  return (
                    <li key={t.id} className={!t.pago ? 'pendente' : ''}>
                      <button className="btn-icone status"
                        title={t.cartao_id ? 'Pago junto com a fatura' : t.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                        disabled={!!t.cartao_id}
                        onClick={() => executar(() => api.atualizarTransacao(t.id, { pago: !t.pago }))}>
                        {t.pago ? <CheckCircle2 size={20} className="tom-pos" /> : <Circle size={20} />}
                      </button>
                      <div className="lanc-info">
                        <span className="lanc-desc">
                          {t.descricao}
                          {t.parcelas_total && <span className="tag">{t.parcela_atual}/{t.parcelas_total}</span>}
                          {t.recorrencia_id && <span className="tag" title="Conta fixa"><Repeat size={11} /> fixa</span>}
                          {t.a_preencher && <span className="tag tag-alerta" title="Valor estimado: informe o valor real">estimado</span>}
                        </span>
                        <small>
                          <Bolinha cor={c?.cor ?? '#94a3b8'} /> {c?.nome ?? 'Sem categoria'}
                          {nomeOrigem(t) && <> · {t.cartao_id && <CreditCard size={12} />} {nomeOrigem(t)}</>}
                        </small>
                      </div>
                      <b className={t.tipo === 'receita' ? 'tom-pos' : 'tom-neg'}>
                        {t.tipo === 'receita' ? '+' : '−'} {moeda(Number(t.valor))}
                      </b>
                      <div className="lanc-acoes">
                        <button className="btn-icone" onClick={() => setEditar(t)} aria-label="Editar"><Pencil size={16} /></button>
                        <button className="btn-icone" onClick={() => setExcluindo(t)} aria-label="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <LancamentoForm aberto={!!editar} editar={editar} onFechar={() => setEditar(null)} />

      <Modal titulo="Excluir lançamento" aberto={!!excluindo} onFechar={() => setExcluindo(null)}>
        {excluindo && (
          <div className="form">
            <p>Excluir <b>{excluindo.descricao}</b> ({moeda(Number(excluindo.valor))})?</p>
            {excluindo.recorrencia_id && (
              <p className="dica">É uma conta fixa: só este mês será excluído (e não volta a ser gerado).
                Para parar de vez, exclua ou pause em Contas fixas.</p>
            )}
            <footer className="form-acoes">
              <button className="btn" onClick={() => setExcluindo(null)}>Cancelar</button>
              {excluindo.grupo_parcela && (
                <button className="btn btn-perigo" onClick={async () => {
                  await executar(() => api.excluirParcelasFuturas(excluindo.grupo_parcela!, excluindo.parcela_atual ?? 1), 'Parcelas excluídas')
                  setExcluindo(null)
                }}>Esta e as próximas parcelas</button>
              )}
              <button className="btn btn-perigo" onClick={async () => {
                await executar(() => api.excluirTransacao(excluindo), 'Lançamento excluído')
                setExcluindo(null)
              }}>{excluindo.grupo_parcela ? 'Só esta parcela' : 'Excluir'}</button>
            </footer>
          </div>
        )}
      </Modal>
    </div>
  )
}
