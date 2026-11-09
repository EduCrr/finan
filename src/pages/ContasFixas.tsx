import { useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useData } from '../context/DataContext'
import * as api from '../lib/api'
import type { Recorrencia, TipoMov } from '../lib/types'
import { addMeses, hoje, inicioMes } from '../lib/dates'
import { moeda, percentual, soma } from '../lib/format'
import { Barra, Bolinha, CampoValor, Card, Modal, Stat, Vazio } from '../components/ui'

type Form = Partial<Recorrencia> & { tipo: TipoMov }

export function ContasFixas() {
  const { recorrencias, categorias, contas, cartoes, executar, categoria } = useData()
  const [form, setForm] = useState<Form | null>(null)

  const ativas = recorrencias.filter((r) => r.ativo)
  const rendaFixa = soma(ativas.filter((r) => r.tipo === 'receita'), (r) => Number(r.valor))
  const despFixa = soma(ativas.filter((r) => r.tipo === 'despesa'), (r) => Number(r.valor))
  const comprometido = rendaFixa ? despFixa / rendaFixa : 0

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form || !form.valor) return
    const mesAtual = inicioMes(hoje())
    const ok = await executar(async () => {
      const reg = {
        id: form.id, descricao: form.descricao, tipo: form.tipo, valor: form.valor, dia: form.dia ?? 1,
        categoria_id: form.categoria_id || null,
        conta_id: form.cartao_id ? null : form.conta_id || null,
        cartao_id: form.tipo === 'despesa' ? form.cartao_id || null : null,
        inicio: form.inicio ?? mesAtual, fim: form.fim || null, ativo: form.ativo ?? true,
        valor_variavel: form.valor_variavel ?? false,
      }
      await api.salvar('recorrencias', reg)
      if (form.id) {
        if (reg.ativo) await api.propagarRecorrencia(reg as Recorrencia, mesAtual)
        else await api.limparRecorrenciaFutura(form.id, mesAtual)
      }
      const recs = await api.listar<Recorrencia>('recorrencias')
      await api.gerarContasFixasAte(addMeses(mesAtual, 1), recs, cartoes)
    }, 'Conta fixa salva')
    if (ok) setForm(null)
  }

  async function excluir() {
    if (!form?.id) return
    if (!confirm('Excluir esta conta fixa? Os lançamentos já pagos são mantidos; os em aberto deste mês em diante são removidos.')) return
    const ok = await executar(async () => {
      await api.limparRecorrenciaFutura(form.id!, inicioMes(hoje()))
      await api.excluir('recorrencias', form.id!)
    }, 'Conta fixa excluída')
    if (ok) setForm(null)
  }

  const lista = (tipo: TipoMov) => {
    const itens = recorrencias.filter((r) => r.tipo === tipo).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.dia - b.dia)
    if (!itens.length) return <Vazio>Nenhuma {tipo === 'receita' ? 'receita' : 'despesa'} fixa cadastrada.</Vazio>
    return (
      <ul className="lista-simples">
        {itens.map((r) => {
          const c = categoria(r.categoria_id)
          const origem = r.cartao_id ? `💳 ${cartoes.find((x) => x.id === r.cartao_id)?.nome ?? ''}` : contas.find((x) => x.id === r.conta_id)?.nome
          return (
            <li key={r.id} className={!r.ativo ? 'inativo' : ''}>
              <div>
                <span>{r.descricao} {r.valor_variavel && <span className="tag">valor variável</span>}
                  {!r.ativo && <span className="tag">pausada</span>}</span>
                <small><Bolinha cor={c?.cor ?? '#94a3b8'} /> {c?.nome ?? 'Sem categoria'} · todo dia {r.dia}{origem && ` · ${origem}`}</small>
              </div>
              <b className={tipo === 'receita' ? 'tom-pos' : 'tom-neg'}>{r.valor_variavel && '~ '}{moeda(Number(r.valor))}</b>
              <button className="btn-icone" onClick={() => setForm(r)} aria-label="Editar"><Pencil size={16} /></button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Contas fixas</h1>
        <div className="botoes">
          <button className="btn" onClick={() => setForm({ tipo: 'receita', dia: 5 })}><Plus size={16} /> Receita fixa</button>
          <button className="btn btn-primario" onClick={() => setForm({ tipo: 'despesa', dia: 10 })}><Plus size={16} /> Despesa fixa</button>
        </div>
      </header>

      <p className="dica">Cadastre aqui o que se repete todo mês. Cada mês ganha um lançamento novo com o valor
        cadastrado, então nada acumula de um mês para o outro. Precisa de outro valor só em um mês (hora extra,
        conta mais cara)? Edite o lançamento daquele mês em Lançamentos. Para luz, água e gás, marque
        <b> "o valor muda todo mês"</b> e preencha o valor real na virada do mês.</p>

      <div className="grade-stats tres">
        <Stat rotulo="Renda fixa mensal" valor={rendaFixa} tom="pos" />
        <Stat rotulo="Despesas fixas mensais" valor={despFixa} tom="neg" />
        <Stat rotulo="Sobra depois das fixas" valor={rendaFixa - despFixa} tom={rendaFixa - despFixa >= 0 ? 'pos' : 'neg'}
          detalhe={rendaFixa > 0 && <>
            <Barra valor={despFixa} max={rendaFixa} />
            {percentual(comprometido)} da renda já está comprometida com contas fixas
            {comprometido > 0.6 && ' — acima de 60% deixa pouca margem para imprevistos'}
          </>} />
      </div>

      <div className="grade-2">
        <Card titulo="Receitas fixas">{lista('receita')}</Card>
        <Card titulo="Despesas fixas">{lista('despesa')}</Card>
      </div>

      <Modal titulo={form?.id ? 'Editar conta fixa' : form?.tipo === 'receita' ? 'Nova receita fixa' : 'Nova despesa fixa'}
        aberto={!!form} onFechar={() => setForm(null)}>
        {form && (
          <form className="form" onSubmit={salvar}>
            <label>Descrição<input required autoFocus value={form.descricao ?? ''}
              placeholder={form.tipo === 'receita' ? 'Ex.: Salário João' : 'Ex.: Aluguel'}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={form.valor_variavel ?? false}
              onChange={(e) => setForm({ ...form, valor_variavel: e.target.checked })} />
              O valor muda todo mês (luz, água, gás…)</label>
            {form.valor_variavel && (
              <p className="dica">Todo mês ela é lançada com o valor do mês anterior como estimativa, e aparece
                no quadro "Preencha os valores deste mês" para você digitar o valor real.</p>
            )}
            <div className="linha">
              <label>{form.valor_variavel ? 'Valor médio (estimativa)' : 'Valor mensal'}<CampoValor valor={Number(form.valor ?? 0)} onChange={(v) => setForm({ ...form, valor: v })} /></label>
              <label>Dia do mês<input type="number" min={1} max={31} required value={form.dia ?? ''}
                onChange={(e) => setForm({ ...form, dia: Number(e.target.value) })} /></label>
            </div>
            <label>Categoria
              <select required value={form.categoria_id ?? ''} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                <option value="">Selecione…</option>
                {categorias.filter((c) => c.tipo === form.tipo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            {form.tipo === 'despesa' && cartoes.length > 0 && (
              <label>Cobrado no cartão?
                <select value={form.cartao_id ?? ''} onChange={(e) => setForm({ ...form, cartao_id: e.target.value })}>
                  <option value="">Não (débito/boleto/pix)</option>
                  {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
            {!form.cartao_id && (
              <label>Conta
                <select value={form.conta_id ?? ''} onChange={(e) => setForm({ ...form, conta_id: e.target.value })}>
                  <option value="">Sem conta</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
            <div className="linha">
              <label>Começa em<input type="month" value={(form.inicio ?? inicioMes(hoje())).slice(0, 7)}
                onChange={(e) => setForm({ ...form, inicio: `${e.target.value}-01` })} /></label>
              <label>Termina em (opcional)<input type="month" value={form.fim?.slice(0, 7) ?? ''}
                onChange={(e) => setForm({ ...form, fim: e.target.value ? `${e.target.value}-01` : null })} /></label>
            </div>
            {form.id && (
              <label className="check"><input type="checkbox" checked={form.ativo ?? true}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa (desmarque para pausar)</label>
            )}
            {form.id && <p className="dica">Mudanças de valor são aplicadas nos lançamentos em aberto deste mês em diante.</p>}
            <footer className="form-acoes">
              {form.id && <button type="button" className="btn btn-perigo" onClick={excluir}>Excluir</button>}
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primario" disabled={!form.valor}>Salvar</button>
            </footer>
          </form>
        )}
      </Modal>
    </div>
  )
}
