import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, ShieldCheck, Target } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTransacoes } from '../lib/hooks'
import * as api from '../lib/api'
import type { Meta } from '../lib/types'
import { addMeses, dataBR, difMeses, hoje, inicioMes } from '../lib/dates'
import { porMes, resumoMes } from '../lib/finance'
import { moeda, percentual } from '../lib/format'
import { Barra, CampoValor, Card, Modal, SeletorCor, Vazio } from '../components/ui'

export function Metas() {
  const { metas, contas, categorias, executar } = useData()
  const mesAtual = inicioMes(hoje())
  const { dados } = useTransacoes(addMeses(mesAtual, -6), addMeses(mesAtual, -1))
  const [form, setForm] = useState<Partial<Meta> | null>(null)
  const [aporte, setAporte] = useState<{ meta: Meta; valor: number; conta: string; retirada: boolean } | null>(null)

  // reserva de emergência = 6x a média de despesas dos últimos 6 meses fechados
  const mediaDespesas = useMemo(() => {
    const ms = [...porMes(dados).values()]
    if (!ms.length) return 0
    return ms.reduce((a, ts) => a + resumoMes(ts).despesas, 0) / ms.length
  }, [dados])
  const reservaIdeal = Math.ceil((mediaDespesas * 6) / 100) * 100
  const temReserva = metas.some((m) => /reserva|emerg/i.test(m.nome))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const ok = await executar(() => api.salvar('metas', {
      id: form.id, nome: form.nome, valor_alvo: form.valor_alvo, valor_atual: form.valor_atual ?? 0,
      prazo: form.prazo || null, cor: form.cor ?? '#0ea5e9', concluida: form.concluida ?? false,
    }), 'Meta salva')
    if (ok) setForm(null)
  }

  async function registrarAporte(e: FormEvent) {
    e.preventDefault()
    if (!aporte || aporte.valor <= 0) return
    const { meta, valor, conta, retirada } = aporte
    const delta = retirada ? -valor : valor
    const catInvest = categorias.find((c) => c.grupo === 'investimento' && c.tipo === 'despesa')
    const ok = await executar(async () => {
      const novo = Math.max(0, Number(meta.valor_atual) + delta)
      await api.salvar('metas', { id: meta.id, valor_atual: novo, concluida: novo >= Number(meta.valor_alvo) })
      await api.salvar('meta_aportes', { meta_id: meta.id, valor: delta, data: hoje() })
      if (conta) {
        await api.criarLancamento({
          tipo: retirada ? 'receita' : 'despesa',
          descricao: `${retirada ? 'Resgate' : 'Aporte'} — ${meta.nome}`,
          valor, data: hoje(), categoria_id: retirada ? null : catInvest?.id ?? null,
          conta_id: conta, cartao: null, parcelas: 1, pago: true, observacao: null,
        })
      }
    }, retirada ? 'Resgate registrado' : 'Aporte registrado 💪')
    if (ok) setAporte(null)
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Metas</h1>
        <button className="btn btn-primario" onClick={() => setForm({ cor: '#0ea5e9' })}><Plus size={16} /> Nova meta</button>
      </header>

      {!temReserva && reservaIdeal > 0 && (
        <Card className="destaque">
          <div className="destaque-linha">
            <ShieldCheck size={28} />
            <div>
              <b>Comece pela reserva de emergência</b>
              <p>Vocês gastam em média {moeda(mediaDespesas)} por mês. O recomendado é ter 6 meses guardados:
                <b> {moeda(reservaIdeal)}</b>, num investimento de resgate rápido.</p>
            </div>
            <button className="btn btn-primario" onClick={() => setForm({ nome: 'Reserva de emergência', valor_alvo: reservaIdeal, cor: '#059669' })}>
              Criar meta
            </button>
          </div>
        </Card>
      )}

      {!metas.length ? (
        <Vazio><Target size={36} /><p>Defina objetivos (viagem, carro, reserva, quitar dívida) e acompanhe quanto falta.</p></Vazio>
      ) : (
        <div className="grade-metas">
          {metas.map((m) => {
            const atual = Number(m.valor_atual)
            const alvo = Number(m.valor_alvo)
            const falta = Math.max(0, alvo - atual)
            const mesesRest = m.prazo ? Math.max(1, difMeses(mesAtual, inicioMes(m.prazo))) : 0
            return (
              <Card key={m.id} className="meta" titulo={<><span className="bolinha" style={{ background: m.cor }} /> {m.nome}</>}
                acao={<button className="btn-icone" onClick={() => setForm(m)} aria-label="Editar"><Pencil size={16} /></button>}>
                <div className="meta-valores">
                  <b>{moeda(atual)}</b><span>de {moeda(alvo)}</span>
                </div>
                <Barra valor={atual} max={alvo} cor={m.cor} alerta={false} />
                <div className="meta-info">
                  <span>{percentual(alvo ? atual / alvo : 0)} concluído</span>
                  {falta > 0 ? <span>faltam {moeda(falta)}</span> : <span className="tom-pos">Meta atingida! 🎉</span>}
                </div>
                {m.prazo && falta > 0 && (
                  <p className="dica">Prazo {dataBR(m.prazo)}: guarde <b>{moeda(falta / mesesRest)}</b> por mês ({mesesRest} meses).</p>
                )}
                <div className="botoes">
                  <button className="btn btn-primario" onClick={() => setAporte({ meta: m, valor: 0, conta: '', retirada: false })}>Guardar</button>
                  <button className="btn" onClick={() => setAporte({ meta: m, valor: 0, conta: '', retirada: true })}>Resgatar</button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal titulo={form?.id ? 'Editar meta' : 'Nova meta'} aberto={!!form} onFechar={() => setForm(null)}>
        {form && (
          <form className="form" onSubmit={salvar}>
            <label>Nome<input required autoFocus value={form.nome ?? ''} placeholder="Ex.: Viagem de férias"
              onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
            <div className="linha">
              <label>Valor alvo<CampoValor valor={Number(form.valor_alvo ?? 0)} onChange={(v) => setForm({ ...form, valor_alvo: v })} /></label>
              <label>Já guardado<CampoValor valor={Number(form.valor_atual ?? 0)} onChange={(v) => setForm({ ...form, valor_atual: v })} /></label>
            </div>
            <label>Prazo (opcional)<input type="date" value={form.prazo ?? ''} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></label>
            <label>Cor<SeletorCor valor={form.cor ?? '#0ea5e9'} onChange={(cor) => setForm({ ...form, cor })} /></label>
            <footer className="form-acoes">
              {form.id && <button type="button" className="btn btn-perigo" onClick={async () => {
                if (confirm('Excluir esta meta?') && await executar(() => api.excluir('metas', form.id!), 'Meta excluída')) setForm(null)
              }}>Excluir</button>}
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primario" disabled={!form.valor_alvo}>Salvar</button>
            </footer>
          </form>
        )}
      </Modal>

      <Modal titulo={aporte?.retirada ? `Resgatar de ${aporte.meta.nome}` : `Guardar em ${aporte?.meta.nome}`}
        aberto={!!aporte} onFechar={() => setAporte(null)}>
        {aporte && (
          <form className="form" onSubmit={registrarAporte}>
            <label>Valor<CampoValor valor={aporte.valor} autoFocus onChange={(v) => setAporte({ ...aporte, valor: v })} /></label>
            <label>{aporte.retirada ? 'Creditar na conta (opcional)' : 'Sair de qual conta? (opcional)'}
              <select value={aporte.conta} onChange={(e) => setAporte({ ...aporte, conta: e.target.value })}>
                <option value="">Não lançar movimento</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <p className="dica">Escolhendo uma conta, o valor também vira um lançamento (e entra no relatório de quanto vocês guardam).</p>
            <footer className="form-acoes">
              <button type="button" className="btn" onClick={() => setAporte(null)}>Cancelar</button>
              <button className="btn btn-primario" disabled={aporte.valor <= 0}>Confirmar</button>
            </footer>
          </form>
        )}
      </Modal>
    </div>
  )
}
