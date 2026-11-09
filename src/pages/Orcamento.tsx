import { useMemo, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTransacoes } from '../lib/hooks'
import * as api from '../lib/api'
import { addMeses, hoje, inicioMes, partes, ultimoDia } from '../lib/dates'
import { porMes, resumoMes } from '../lib/finance'
import { moeda, percentual, soma } from '../lib/format'
import { Barra, Bolinha, CampoValor, Card, SeletorMes, Stat } from '../components/ui'
import { GRUPO_LABEL, type Grupo } from '../lib/types'

export function Orcamento() {
  const { categorias, orcamentos, executar } = useData()
  const [mes, setMes] = useState(inicioMes(hoje()))
  const { dados } = useTransacoes(addMeses(mes, -3), mes)
  const [editando, setEditando] = useState<Record<string, number>>({})

  const meses = useMemo(() => porMes(dados), [dados])
  const doMes = meses.get(mes) ?? []
  const anteriores = [1, 2, 3].map((i) => meses.get(addMeses(mes, -i)) ?? [])
  const renda = resumoMes(doMes).receitas

  const gastoCat = (ts: typeof doMes, id: string) =>
    soma(ts.filter((t) => t.tipo === 'despesa' && t.categoria_id === id), (t) => Number(t.valor))
  const media3 = (id: string) => soma(anteriores, (ts) => gastoCat(ts, id)) / 3

  const despesas = categorias.filter((c) => c.tipo === 'despesa' && c.ativo)
  const linhas = despesas.map((c) => ({
    c,
    gasto: gastoCat(doMes, c.id),
    media: media3(c.id),
    orc: orcamentos.find((o) => o.categoria_id === c.id),
  })).sort((a, b) => (b.orc ? 1 : 0) - (a.orc ? 1 : 0) || b.gasto - a.gasto)

  const totalOrcado = soma(orcamentos, (o) => Number(o.valor))
  const totalGastoOrcado = soma(linhas.filter((l) => l.orc), (l) => l.gasto)

  // ritmo: no mês corrente, projeta o gasto variável até o fim do mês
  const ehMesAtual = mes === inicioMes(hoje())
  const { ano, mes: m, dia } = partes(hoje())
  const fracao = ehMesAtual ? dia / ultimoDia(ano, m) : 1

  async function salvarLimite(categoriaId: string, valor: number) {
    const orc = orcamentos.find((o) => o.categoria_id === categoriaId)
    await executar(async () => {
      if (valor <= 0 && orc) await api.excluir('orcamentos', orc.id)
      else if (valor > 0) await api.salvar('orcamentos', { id: orc?.id, categoria_id: categoriaId, valor })
    })
    setEditando((e) => { const n = { ...e }; delete n[categoriaId]; return n })
  }

  async function sugerir() {
    const sem = linhas.filter((l) => !l.orc && l.media > 0)
    if (!sem.length) return
    if (!confirm(`Criar limite para ${sem.length} categoria(s) usando a média dos últimos 3 meses com 10% de corte?`)) return
    await executar(async () => {
      for (const l of sem) {
        await api.salvar('orcamentos', { categoria_id: l.c.id, valor: Math.ceil((l.media * 0.9) / 10) * 10 })
      }
    }, 'Orçamento sugerido criado')
  }

  const grupos: Grupo[] = ['essencial', 'estilo', 'investimento']

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Orçamento</h1>
        <div className="botoes">
          <button className="btn" onClick={sugerir} title="Usa a média dos últimos 3 meses com 10% de redução">
            <Wand2 size={16} /> Sugerir limites
          </button>
          <SeletorMes valor={mes} onChange={setMes} />
        </div>
      </header>

      <div className="grade-stats tres">
        <Stat rotulo="Total orçado" valor={totalOrcado}
          detalhe={renda > 0 ? `${percentual(totalOrcado / renda)} da renda do mês` : 'limite mensal somado'} />
        <Stat rotulo="Gasto nas categorias orçadas" valor={totalGastoOrcado} tom={totalGastoOrcado > totalOrcado ? 'neg' : 'neutro'}
          detalhe={<Barra valor={totalGastoOrcado} max={totalOrcado} />} />
        <Stat rotulo="Ainda pode gastar" valor={Math.max(0, totalOrcado - totalGastoOrcado)} tom="pos"
          detalhe={ehMesAtual ? `${ultimoDia(ano, m) - dia} dias até o fim do mês` : undefined} />
      </div>

      {grupos.map((g) => {
        const ls = linhas.filter((l) => l.c.grupo === g)
        if (!ls.length) return null
        return (
          <Card key={g} titulo={GRUPO_LABEL[g]}>
            <ul className="lista-orc">
              {ls.map(({ c, gasto, media, orc }) => {
                const lim = Number(orc?.valor ?? 0)
                const projetado = ehMesAtual && fracao > 0.15 ? gasto / fracao : gasto
                return (
                  <li key={c.id}>
                    <div className="orc-topo">
                      <span><Bolinha cor={c.cor} /> {c.nome}</span>
                      <span className="orc-valores">
                        <b className={lim && gasto > lim ? 'tom-neg' : ''}>{moeda(gasto)}</b>
                        {c.id in editando ? (
                          <span className="orc-edit">
                            <CampoValor valor={editando[c.id]} autoFocus onChange={(v) => setEditando({ ...editando, [c.id]: v })} />
                            <button className="btn btn-primario btn-p" onClick={() => salvarLimite(c.id, editando[c.id])}>OK</button>
                          </span>
                        ) : (
                          <button className="btn-link" onClick={() => setEditando({ ...editando, [c.id]: lim })}>
                            {lim ? `de ${moeda(lim)}` : 'definir limite'}
                          </button>
                        )}
                      </span>
                    </div>
                    {lim > 0 && <Barra valor={gasto} max={lim} cor={c.cor} />}
                    <small className="orc-info">
                      Média 3 meses: {moeda(media)}
                      {media > 0 && gasto > media * 1.2 && <span className="tom-neg"> · {percentual(gasto / media - 1)} acima da média</span>}
                      {lim > 0 && ehMesAtual && projetado > lim && gasto <= lim &&
                        <span className="tom-alerta"> · no ritmo atual deve fechar em {moeda(projetado)}</span>}
                      {lim > 0 && gasto <= lim && <> · resta {moeda(lim - gasto)}</>}
                    </small>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}
