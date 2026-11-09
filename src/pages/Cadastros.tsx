import { useState, type FormEvent } from 'react'
import { Download, Pencil, Plus } from 'lucide-react'
import { useData } from '../context/DataContext'
import * as api from '../lib/api'
import { GRUPO_LABEL, TIPO_CONTA_LABEL, type Categoria, type Conta, type Grupo } from '../lib/types'
import { moeda } from '../lib/format'
import { Bolinha, CampoValor, Card, Modal, SeletorCor, Vazio } from '../components/ui'

export function Cadastros() {
  const { contas, categorias, cartoes, saldos, executar, notificar } = useData()
  const [conta, setConta] = useState<Partial<Conta> | null>(null)
  const [cat, setCat] = useState<Partial<Categoria> | null>(null)
  const [exportando, setExportando] = useState(false)

  async function salvarConta(e: FormEvent) {
    e.preventDefault()
    if (!conta) return
    const ok = await executar(() => api.salvar('contas', {
      id: conta.id, nome: conta.nome, tipo: conta.tipo ?? 'corrente',
      saldo_inicial: conta.saldo_inicial ?? 0, cor: conta.cor ?? '#0f766e', ativo: conta.ativo ?? true,
    }), 'Conta salva')
    if (ok) setConta(null)
  }

  async function salvarCat(e: FormEvent) {
    e.preventDefault()
    if (!cat) return
    const tipo = cat.tipo ?? 'despesa'
    const ok = await executar(() => api.salvar('categorias', {
      id: cat.id, nome: cat.nome, tipo, grupo: tipo === 'receita' ? 'receita' : cat.grupo ?? 'essencial',
      cor: cat.cor ?? '#64748b', icone: cat.icone ?? 'tag', ativo: cat.ativo ?? true,
    }), 'Categoria salva')
    if (ok) setCat(null)
  }

  async function exportar() {
    setExportando(true)
    try {
      const ts = await api.transacoesPorCompetencia('2000-01-01', '2100-12-01')
      const nome = (id: string | null, lista: { id: string; nome: string }[]) => lista.find((x) => x.id === id)?.nome ?? ''
      const linhas = [
        ['Data', 'Competência', 'Tipo', 'Descrição', 'Valor', 'Categoria', 'Conta', 'Cartão', 'Pago', 'Parcela', 'Observação'],
        ...ts.map((t) => [
          t.data, t.competencia.slice(0, 7), t.tipo, t.descricao, String(t.valor).replace('.', ','),
          nome(t.categoria_id, categorias), nome(t.conta_id, contas), nome(t.cartao_id, cartoes),
          t.pago ? 'sim' : 'não', t.parcelas_total ? `${t.parcela_atual}/${t.parcelas_total}` : '', t.observacao ?? '',
        ]),
      ]
      const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `finan-lancamentos-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      notificar((e as Error).message, 'erro')
    }
    setExportando(false)
  }

  const listaCats = (tipo: 'receita' | 'despesa') => (
    <ul className="lista-simples">
      {categorias.filter((c) => c.tipo === tipo).map((c) => (
        <li key={c.id} className={!c.ativo ? 'inativo' : ''}>
          <div><span><Bolinha cor={c.cor} /> {c.nome}</span>
            {tipo === 'despesa' && <small>{GRUPO_LABEL[c.grupo]}</small>}</div>
          <button className="btn-icone" onClick={() => setCat(c)} aria-label="Editar"><Pencil size={16} /></button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Cadastros</h1>
        <button className="btn" onClick={exportar} disabled={exportando}><Download size={16} /> {exportando ? 'Gerando…' : 'Exportar CSV'}</button>
      </header>

      <Card titulo="Contas e carteiras" acao={<button className="btn" onClick={() => setConta({ tipo: 'corrente', cor: '#0f766e' })}><Plus size={16} /> Conta</button>}>
        {contas.length ? (
          <ul className="lista-simples">
            {contas.map((c) => (
              <li key={c.id} className={!c.ativo ? 'inativo' : ''}>
                <div><span><Bolinha cor={c.cor} /> {c.nome}</span><small>{TIPO_CONTA_LABEL[c.tipo]}</small></div>
                <b className={(saldos.get(c.id) ?? 0) < 0 ? 'tom-neg' : ''}>{moeda(saldos.get(c.id) ?? 0)}</b>
                <button className="btn-icone" onClick={() => setConta(c)} aria-label="Editar"><Pencil size={16} /></button>
              </li>
            ))}
          </ul>
        ) : <Vazio>Cadastre suas contas (banco, poupança, dinheiro) para acompanhar o saldo.</Vazio>}
      </Card>

      <div className="grade-2">
        <Card titulo="Categorias de despesa" acao={<button className="btn" onClick={() => setCat({ tipo: 'despesa', grupo: 'essencial' })}><Plus size={16} /></button>}>
          {listaCats('despesa')}
        </Card>
        <Card titulo="Categorias de receita" acao={<button className="btn" onClick={() => setCat({ tipo: 'receita', grupo: 'receita', cor: '#16a34a' })}><Plus size={16} /></button>}>
          {listaCats('receita')}
        </Card>
      </div>

      <Modal titulo={conta?.id ? 'Editar conta' : 'Nova conta'} aberto={!!conta} onFechar={() => setConta(null)}>
        {conta && (
          <form className="form" onSubmit={salvarConta}>
            <label>Nome<input required autoFocus value={conta.nome ?? ''} placeholder="Ex.: Itaú, Carteira"
              onChange={(e) => setConta({ ...conta, nome: e.target.value })} /></label>
            <label>Tipo
              <select value={conta.tipo} onChange={(e) => setConta({ ...conta, tipo: e.target.value as Conta['tipo'] })}>
                {Object.entries(TIPO_CONTA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Saldo inicial<CampoValor valor={Number(conta.saldo_inicial ?? 0)} onChange={(v) => setConta({ ...conta, saldo_inicial: v })} /></label>
            <p className="dica">Informe o saldo do dia em que começou a usar o Finan. Depois, o saldo é calculado pelos lançamentos pagos.</p>
            <label>Cor<SeletorCor valor={conta.cor ?? '#0f766e'} onChange={(cor) => setConta({ ...conta, cor })} /></label>
            {conta.id && <label className="check"><input type="checkbox" checked={conta.ativo ?? true}
              onChange={(e) => setConta({ ...conta, ativo: e.target.checked })} /> Conta ativa</label>}
            <footer className="form-acoes">
              {conta.id && <button type="button" className="btn btn-perigo" onClick={async () => {
                if (confirm('Excluir a conta? Os lançamentos ficam sem conta. Prefira desativar.') &&
                  await executar(() => api.excluir('contas', conta.id!), 'Conta excluída')) setConta(null)
              }}>Excluir</button>}
              <button type="button" className="btn" onClick={() => setConta(null)}>Cancelar</button>
              <button className="btn btn-primario">Salvar</button>
            </footer>
          </form>
        )}
      </Modal>

      <Modal titulo={cat?.id ? 'Editar categoria' : 'Nova categoria'} aberto={!!cat} onFechar={() => setCat(null)}>
        {cat && (
          <form className="form" onSubmit={salvarCat}>
            <label>Nome<input required autoFocus value={cat.nome ?? ''} onChange={(e) => setCat({ ...cat, nome: e.target.value })} /></label>
            {cat.tipo === 'despesa' && (
              <label>Grupo (para a análise 50/30/20)
                <select value={cat.grupo} onChange={(e) => setCat({ ...cat, grupo: e.target.value as Grupo })}>
                  <option value="essencial">Essencial (necessidades)</option>
                  <option value="estilo">Estilo de vida (desejos)</option>
                  <option value="investimento">Poupança / investimento</option>
                </select>
              </label>
            )}
            <label>Cor<SeletorCor valor={cat.cor ?? '#64748b'} onChange={(cor) => setCat({ ...cat, cor })} /></label>
            {cat.id && <label className="check"><input type="checkbox" checked={cat.ativo ?? true}
              onChange={(e) => setCat({ ...cat, ativo: e.target.checked })} /> Ativa (aparece nos formulários)</label>}
            <footer className="form-acoes">
              {cat.id && <button type="button" className="btn btn-perigo" onClick={async () => {
                if (confirm('Excluir a categoria? Os lançamentos ficam "sem categoria". Prefira desativar.') &&
                  await executar(() => api.excluir('categorias', cat.id!), 'Categoria excluída')) setCat(null)
              }}>Excluir</button>}
              <button type="button" className="btn" onClick={() => setCat(null)}>Cancelar</button>
              <button className="btn btn-primario">Salvar</button>
            </footer>
          </form>
        )}
      </Modal>
    </div>
  )
}
