import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useData } from '../context/DataContext'
import { useTransacoes } from '../lib/hooks'
import { addMeses, dataBR, hoje, inicioMes, mesCurto } from '../lib/dates'
import { porCategoria, porMes, resumoMes } from '../lib/finance'
import { moeda, moedaCurta, percentual, soma } from '../lib/format'
import type { Transacao } from '../lib/types'
import { Barra, Bolinha, Card, SeletorMes, Vazio } from '../components/ui'

interface Dica { tipo: 'bom' | 'alerta' | 'ruim' | 'ideia'; texto: ReactNode; impacto?: number }

export function Analise() {
  const { categorias, recorrencias, categoria } = useData()
  const [mes, setMes] = useState(inicioMes(hoje()))
  const { dados, carregando } = useTransacoes(addMeses(mes, -11), addMeses(mes, 12))

  const meses = useMemo(() => porMes(dados), [dados])
  const doMes = meses.get(mes) ?? []
  const ant = [1, 2, 3].map((i) => meses.get(addMeses(mes, -i)) ?? [])
  const r = resumoMes(doMes)
  const rendaMedia = soma([doMes, ...ant], (ts) => resumoMes(ts).receitas) / Math.max(1, [doMes, ...ant].filter((ts) => ts.length).length)
  const renda = r.receitas || rendaMedia

  const despCat = (ts: Transacao[], id: string) =>
    soma(ts.filter((t) => t.tipo === 'despesa' && (t.categoria_id ?? 'sem') === id), (t) => Number(t.valor))

  // ---- 50/30/20
  const grupoDe = (t: Transacao) => categoria(t.categoria_id)?.grupo ?? 'estilo'
  const desp = doMes.filter((t) => t.tipo === 'despesa')
  const essencial = soma(desp.filter((t) => grupoDe(t) === 'essencial'), (t) => Number(t.valor))
  const estilo = soma(desp.filter((t) => grupoDe(t) === 'estilo'), (t) => Number(t.valor))
  const investido = soma(desp.filter((t) => grupoDe(t) === 'investimento'), (t) => Number(t.valor))
  const guardado = investido + Math.max(0, r.saldo)

  // ---- comparação por categoria
  const comparacao = categorias.filter((c) => c.tipo === 'despesa').map((c) => {
    const atual = despCat(doMes, c.id)
    const media = soma(ant, (ts) => despCat(ts, c.id)) / 3
    return { c, atual, media, dif: atual - media }
  }).filter((x) => x.atual > 0 || x.media > 0).sort((a, b) => b.dif - a.dif)

  // ---- evolução por categoria (top 6 dos 12 meses)
  const ultimos12 = Array.from({ length: 12 }, (_, i) => addMeses(mes, i - 11))
  const tops = porCategoria(ultimos12.flatMap((m) => meses.get(m) ?? []), categorias).slice(0, 6)
  const evolucao = ultimos12.map((m) => {
    const ts = meses.get(m) ?? []
    const linha: Record<string, number | string> = { mes: mesCurto(m) }
    for (const t of tops) linha[t.nome] = despCat(ts, t.id)
    linha['Outras'] = resumoMes(ts).despesas - tops.reduce((a, t) => a + (linha[t.nome] as number), 0)
    return linha
  })

  // ---- mês a mês: receitas, despesas, sobra e a categoria que mais pesou
  const mesAMes = ultimos12.map((m) => {
    const ts = meses.get(m) ?? []
    const rr = resumoMes(ts)
    const maior = porCategoria(ts, categorias)[0]
    return { m, mes: mesCurto(m), Receitas: rr.receitas, Despesas: rr.despesas, Sobra: rr.saldo, maior, tem: ts.length > 0 }
  })
  const comDados = mesAMes.filter((x) => x.tem)
  const piorDespesa = comDados.reduce<typeof comDados[0] | null>((a, x) => (!a || x.Despesas > a.Despesas ? x : a), null)
  const melhorSobra = comDados.reduce<typeof comDados[0] | null>((a, x) => (!a || x.Sobra > a.Sobra ? x : a), null)
  const piorSobra = comDados.reduce<typeof comDados[0] | null>((a, x) => (!a || x.Sobra < a.Sobra ? x : a), null)
  const mediaDesp = comDados.length ? soma(comDados, (x) => x.Despesas) / comDados.length : 0

  // ---- ranking de categorias nos 12 meses
  const ranking = porCategoria(ultimos12.flatMap((m) => meses.get(m) ?? []), categorias).map((f) => {
    const porMesCat = ultimos12.map((m) => ({ m, v: despCat(meses.get(m) ?? [], f.id) }))
    const pico = porMesCat.reduce((a, x) => (x.v > a.v ? x : a))
    return { ...f, media: f.valor / Math.max(1, comDados.length), pico }
  })

  // ---- sobra acumulada
  let acumulado = 0
  const sobra = ultimos12.map((m) => {
    const rr = resumoMes(meses.get(m) ?? [])
    acumulado += rr.saldo
    return { mes: mesCurto(m), Sobra: rr.saldo, Acumulado: acumulado }
  })

  // ---- parcelas futuras
  const futuros = Array.from({ length: 12 }, (_, i) => addMeses(mes, i + 1))
  const compromissos = futuros.map((m) => {
    const ts = (meses.get(m) ?? []).filter((t) => t.tipo === 'despesa')
    return {
      mes: mesCurto(m),
      Parcelas: soma(ts.filter((t) => (t.parcelas_total ?? 1) > 1), (t) => Number(t.valor)),
      Fixas: soma(ts.filter((t) => t.recorrencia_id), (t) => Number(t.valor)),
    }
  })
  const parcelamentos = useMemo(() => {
    const g = new Map<string, Transacao[]>()
    for (const t of dados) if (t.grupo_parcela && t.competencia.slice(0, 10) > mes) {
      if (!g.has(t.grupo_parcela)) g.set(t.grupo_parcela, [])
      g.get(t.grupo_parcela)!.push(t)
    }
    return [...g.values()].map((ts) => ({
      desc: ts[0].descricao,
      restantes: ts.length,
      total: ts[0].parcelas_total ?? ts.length,
      parcela: Number(ts[0].valor),
      falta: soma(ts, (t) => Number(t.valor)),
      ultima: ts.map((t) => t.competencia).sort().at(-1)!,
    })).sort((a, b) => b.falta - a.falta)
  }, [dados, mes])

  // ---- maiores gastos
  const maiores = [...desp].sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 10)
  const pequenos = desp.filter((t) => Number(t.valor) < 50)

  // ---- dicas
  const dicas: Dica[] = []
  if (renda > 0) {
    const taxa = guardado / renda
    if (r.saldo < 0) dicas.push({ tipo: 'ruim', texto: <>O mês está fechando <b>no vermelho em {moeda(-r.saldo)}</b>. Priorize cortar nas categorias de estilo de vida abaixo.</> })
    else if (taxa < 0.1) dicas.push({ tipo: 'alerta', texto: <>Vocês estão guardando <b>{percentual(taxa)}</b> da renda. O ideal é chegar a 20% ({moeda(renda * 0.2)}/mês).</> })
    else if (taxa >= 0.2) dicas.push({ tipo: 'bom', texto: <>Ótimo! Vocês estão guardando <b>{percentual(taxa)}</b> da renda — acima dos 20% recomendados.</> })
    else dicas.push({ tipo: 'ideia', texto: <>Vocês guardam <b>{percentual(taxa)}</b> da renda. Faltam {moeda(renda * 0.2 - guardado)}/mês para chegar a 20%.</> })

    if (estilo / renda > 0.3) dicas.push({
      tipo: 'alerta', impacto: estilo - renda * 0.3,
      texto: <>Gastos de <b>estilo de vida</b> (lazer, restaurantes, compras…) estão em {percentual(estilo / renda)} da renda. Reduzir {moeda(estilo - renda * 0.3)} traria para os 30% recomendados.</>,
    })
    if (essencial / renda > 0.5) dicas.push({
      tipo: 'alerta',
      texto: <>Os <b>gastos essenciais</b> consomem {percentual(essencial / renda)} da renda (ideal até 50%). Vale renegociar aluguel, planos de celular/internet, seguro e tarifas.</>,
    })
    const parcProx = compromissos[0]?.Parcelas ?? 0
    if (parcProx / renda > 0.2) dicas.push({
      tipo: 'ruim',
      texto: <>Já há <b>{moeda(parcProx)} em parcelas</b> para o próximo mês ({percentual(parcProx / renda)} da renda). Evite novos parcelamentos até isso baixar de 15%.</>,
    })
  }
  for (const x of comparacao.slice(0, 3)) {
    if (x.media > 50 && x.dif > x.media * 0.2) dicas.push({
      tipo: 'alerta', impacto: x.dif,
      texto: <><b>{x.c.nome}</b> subiu {percentual(x.dif / x.media)} em relação à média dos 3 meses anteriores (+{moeda(x.dif)}).</>,
    })
  }
  const melhorou = comparacao.filter((x) => x.media > 50 && x.dif < -x.media * 0.2).sort((a, b) => a.dif - b.dif)[0]
  if (melhorou) dicas.push({ tipo: 'bom', texto: <>Vocês gastaram <b>{moeda(-melhorou.dif)} a menos</b> com {melhorou.c.nome} do que a média. Continue assim!</> })

  const assinaturas = recorrencias.filter((rc) => rc.ativo && rc.tipo === 'despesa' && categoria(rc.categoria_id)?.grupo === 'estilo')
  if (assinaturas.length >= 2) {
    const v = soma(assinaturas, (a) => Number(a.valor))
    dicas.push({ tipo: 'ideia', texto: <>São <b>{assinaturas.length} despesas fixas de estilo de vida</b> (assinaturas, academia…) somando {moeda(v)}/mês, ou <b>{moeda(v * 12)} por ano</b>. Cancele as que ninguém usa.</> })
  }
  if (pequenos.length >= 10) {
    dicas.push({ tipo: 'ideia', texto: <><b>{pequenos.length} gastos pequenos</b> (abaixo de R$ 50) somaram {moeda(soma(pequenos, (t) => Number(t.valor)))} neste mês. Os "cafezinhos" pesam no total.</> })
  }
  const delivery = categorias.find((c) => /restaurante|delivery/i.test(c.nome))
  const mercado = categorias.find((c) => /mercado/i.test(c.nome))
  if (delivery && mercado) {
    const d = despCat(doMes, delivery.id), m = despCat(doMes, mercado.id)
    if (d > 0 && m > 0 && d > m * 0.6) dicas.push({ tipo: 'ideia', texto: <>Restaurantes/delivery ({moeda(d)}) já equivalem a {percentual(d / m)} do mercado. Cozinhar mais em casa 2× por semana pode economizar bastante.</> })
  }

  const icone = { bom: <CheckCircle2 size={18} />, alerta: <AlertTriangle size={18} />, ruim: <AlertTriangle size={18} />, ideia: <Lightbulb size={18} /> }
  const cores = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#f59e0b', '#94a3b8']

  if (carregando && !dados.length) return <div className="pagina"><div className="carregando">Analisando…</div></div>

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Análise</h1>
        <SeletorMes valor={mes} onChange={setMes} />
      </header>

      <Card titulo="Diagnóstico e dicas">
        {dicas.length ? (
          <ul className="dicas">
            {dicas.map((d, i) => <li key={i} className={`dica-${d.tipo}`}>{icone[d.tipo]}<span>{d.texto}</span></li>)}
          </ul>
        ) : <Vazio>Lance receitas e despesas para receber dicas personalizadas.</Vazio>}
      </Card>

      <Card titulo="Mês a mês — últimos 12 meses">
        {comDados.length ? (<>
          <div className="destaques-mes">
            {piorDespesa && <div><small>Mês com mais despesas</small><b className="tom-neg">{mesCurto(piorDespesa.m)}</b>
              <span>{moeda(piorDespesa.Despesas)}{mediaDesp > 0 && ` · ${percentual(piorDespesa.Despesas / mediaDesp - 1)} acima da média`}</span></div>}
            {melhorSobra && <div><small>Mês que mais sobrou</small><b className="tom-pos">{mesCurto(melhorSobra.m)}</b>
              <span>{moeda(melhorSobra.Sobra)}</span></div>}
            {piorSobra && <div><small>Pior resultado</small><b className={piorSobra.Sobra < 0 ? 'tom-neg' : ''}>{mesCurto(piorSobra.m)}</b>
              <span>{piorSobra.Sobra < 0 ? `prejuízo de ${moeda(-piorSobra.Sobra)}` : `sobra de ${moeda(piorSobra.Sobra)}`}</span></div>}
            <div><small>Média de despesas</small><b>{moeda(mediaDesp)}</b><span>por mês</span></div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={mesAMes} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => moeda(v)} cursor={{ fill: 'var(--hover)' }} />
              <Legend iconType="circle" />
              <ReferenceLine y={0} stroke="var(--texto-2)" />
              <Bar dataKey="Receitas" fill="var(--positivo)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" radius={[4, 4, 0, 0]}>
                {mesAMes.map((x) => <Cell key={x.m} fill={x.m === piorDespesa?.m ? '#991b1b' : 'var(--negativo)'} />)}
              </Bar>
              <Line type="monotone" dataKey="Sobra" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Sobra</th><th>Onde mais gastou</th></tr></thead>
              <tbody>
                {[...mesAMes].reverse().filter((x) => x.tem).map((x) => (
                  <tr key={x.m} className={x.m === mes ? 'linha-atual' : ''}>
                    <td>{mesCurto(x.m)}</td>
                    <td className="tom-pos">{moeda(x.Receitas)}</td>
                    <td className="tom-neg">{moeda(x.Despesas)}</td>
                    <td className={x.Sobra >= 0 ? 'tom-pos' : 'tom-neg'}><b>{moeda(x.Sobra)}</b></td>
                    <td>{x.maior ? <><Bolinha cor={x.maior.cor} /> {x.maior.nome} <span className="suave">({moeda(x.maior.valor)})</span></> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>) : <Vazio>Sem lançamentos nos últimos 12 meses.</Vazio>}
      </Card>

      <Card titulo="Onde vocês mais gastam — 12 meses">
        {ranking.length ? (
          <ul className="lista-barras">
            {ranking.slice(0, 10).map((f, i) => (
              <li key={f.id}>
                <div className="lb-topo">
                  <span><b className="suave">{i + 1}º</b> <Bolinha cor={f.cor} /> {f.nome}</span>
                  <b>{moeda(f.valor)}</b>
                </div>
                <Barra valor={f.valor} max={ranking[0].valor} cor={f.cor} alerta={false} />
                <small>{percentual(f.pct)} de tudo que foi gasto · média {moeda(f.media)}/mês
                  {f.pico.v > 0 && ` · pico em ${mesCurto(f.pico.m)} (${moeda(f.pico.v)})`}</small>
              </li>
            ))}
          </ul>
        ) : <Vazio>Sem despesas no período.</Vazio>}
      </Card>

      <div className="grade-2">
        <Card titulo="Regra 50 / 30 / 20">
          {renda > 0 ? (
            <ul className="lista-barras">
              {[
                { nome: 'Essenciais', valor: essencial, ideal: 0.5, cor: '#2563eb', desc: 'moradia, mercado, saúde, transporte' },
                { nome: 'Estilo de vida', valor: estilo, ideal: 0.3, cor: '#ea580c', desc: 'lazer, restaurantes, compras' },
                { nome: 'Guardado / investido', valor: guardado, ideal: 0.2, cor: '#059669', desc: 'investimentos + sobra do mês', minimo: true },
              ].map((g) => {
                const p = g.valor / renda
                const ruim = g.minimo ? p < g.ideal : p > g.ideal
                return (
                  <li key={g.nome}>
                    <div className="lb-topo"><span>{g.nome} <small>({g.desc})</small></span>
                      <b className={ruim ? 'tom-neg' : 'tom-pos'}>{percentual(p)}</b></div>
                    <div className="barra-ideal">
                      <Barra valor={g.valor} max={renda} cor={g.cor} alerta={false} />
                      <span className="marca-ideal" style={{ left: `${g.ideal * 100}%` }} title={`ideal ${percentual(g.ideal)}`} />
                    </div>
                    <small>{moeda(g.valor)} · ideal {g.minimo ? 'pelo menos' : 'até'} {percentual(g.ideal)} ({moeda(renda * g.ideal)})</small>
                  </li>
                )
              })}
            </ul>
          ) : <Vazio>Cadastre as receitas do mês para ver a distribuição.</Vazio>}
          <p className="dica">O grupo de cada categoria pode ser ajustado em Cadastros.</p>
        </Card>

        <Card titulo="Este mês x média dos 3 anteriores">
          {comparacao.length ? (
            <table className="tabela">
              <thead><tr><th>Categoria</th><th>Este mês</th><th>Média</th><th>Diferença</th></tr></thead>
              <tbody>
                {comparacao.slice(0, 10).map(({ c, atual, media, dif }) => (
                  <tr key={c.id}>
                    <td><Bolinha cor={c.cor} /> {c.nome}</td>
                    <td>{moeda(atual)}</td>
                    <td className="suave">{moeda(media)}</td>
                    <td className={dif > 0 ? 'tom-neg' : 'tom-pos'}>
                      {dif > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {moeda(Math.abs(dif))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Vazio>Sem dados suficientes.</Vazio>}
        </Card>
      </div>

      <Card titulo="Para onde o dinheiro vai — 12 meses">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={evolucao} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda)" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={70} />
            <Tooltip formatter={(v: number) => moeda(v)} cursor={{ fill: 'var(--hover)' }} />
            <Legend iconType="circle" />
            {[...tops.map((t) => t.nome), 'Outras'].map((n, i) => (
              <Bar key={n} dataKey={n} stackId="a" fill={tops[i]?.cor ?? cores[6]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grade-2">
        <Card titulo="Sobra mensal e acumulada">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={sobra} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => moeda(v)} />
              <Legend iconType="circle" />
              <Area type="monotone" dataKey="Acumulado" stroke="var(--primaria)" fill="var(--primaria)" fillOpacity={0.15} />
              <Area type="monotone" dataKey="Sobra" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card titulo="Já comprometido nos próximos meses">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={compromissos} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => moeda(v)} cursor={{ fill: 'var(--hover)' }} />
              <Legend iconType="circle" />
              <Bar dataKey="Fixas" stackId="a" fill="#0f766e" />
              <Bar dataKey="Parcelas" stackId="a" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="dica">Contas fixas aparecem conforme os meses vão sendo gerados (até o mês que vem, ou ao navegar em Lançamentos).</p>
        </Card>
      </div>

      <div className="grade-2">
        <Card titulo="Parcelamentos em andamento">
          {parcelamentos.length ? (
            <table className="tabela">
              <thead><tr><th>Compra</th><th>Parcela</th><th>Restam</th><th>Falta pagar</th></tr></thead>
              <tbody>
                {parcelamentos.map((p, i) => (
                  <tr key={i}>
                    <td>{p.desc}<br /><small className="suave">termina {mesCurto(p.ultima)}</small></td>
                    <td>{moeda(p.parcela)}</td>
                    <td>{p.restantes} de {p.total}</td>
                    <td className="tom-neg">{moeda(p.falta)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="tom-neg">{moeda(soma(parcelamentos, (p) => p.falta))}</td></tr></tfoot>
            </table>
          ) : <Vazio>Nenhuma parcela futura. 👏</Vazio>}
        </Card>

        <Card titulo="Maiores gastos do mês">
          {maiores.length ? (
            <ul className="lista-simples">
              {maiores.map((t) => (
                <li key={t.id}>
                  <div><span>{t.descricao}</span>
                    <small><Bolinha cor={categoria(t.categoria_id)?.cor ?? '#94a3b8'} /> {categoria(t.categoria_id)?.nome ?? 'Sem categoria'} · {dataBR(t.data)}</small></div>
                  <b className="tom-neg">{moeda(Number(t.valor))}</b>
                </li>
              ))}
            </ul>
          ) : <Vazio>Sem despesas.</Vazio>}
        </Card>
      </div>
    </div>
  )
}
