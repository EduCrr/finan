import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useData } from '../context/DataContext'
import * as api from '../lib/api'
import type { Transacao } from '../lib/types'
import { moeda } from '../lib/format'
import { CampoValor, Card } from './ui'

/**
 * Lista as contas de valor variável do mês (luz, água, gás…) que ainda estão
 * com valor estimado, para preencher todas de uma vez na virada do mês.
 */
export function PreencherContas({ transacoes }: { transacoes: Transacao[] }) {
  const { executar } = useData()
  const pendentes = transacoes.filter((t) => t.a_preencher).sort((a, b) => a.data.localeCompare(b.data))
  const [valores, setValores] = useState<Record<string, number>>({})
  const [salvando, setSalvando] = useState(false)

  if (!pendentes.length) return null
  const preenchidos = pendentes.filter((t) => (valores[t.id] ?? 0) > 0)

  async function salvar() {
    setSalvando(true)
    const ok = await executar(
      () => api.preencherValores(preenchidos.map((t) => ({ id: t.id, valor: valores[t.id] }))),
      `${preenchidos.length} conta(s) atualizada(s)`,
    )
    setSalvando(false)
    if (ok) setValores({})
  }

  return (
    <Card className="preencher" titulo={<><Zap size={16} /> Preencha os valores deste mês</>}>
      <p className="dica">Contas que mudam de valor todo mês. O valor sugerido é o do mês passado;
        digite o valor real da conta quando ela chegar.</p>
      <ul className="lista-preencher">
        {pendentes.map((t) => (
          <li key={t.id}>
            <div>
              <span>{t.descricao}</span>
              <small>estimado: {moeda(Number(t.valor))}</small>
            </div>
            <CampoValor valor={valores[t.id] ?? 0} onChange={(v) => setValores({ ...valores, [t.id]: v })} />
          </li>
        ))}
      </ul>
      <div className="form-acoes">
        <button className="btn btn-primario" disabled={!preenchidos.length || salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : `Salvar ${preenchidos.length || ''} valor(es)`}
        </button>
      </div>
    </Card>
  )
}
