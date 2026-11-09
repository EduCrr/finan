import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Landmark, PiggyBank } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData } from '../context/DataContext'
import { useTransacoes } from '../lib/hooks'
import { addMeses, dataBR, hoje, inicioMes, mesCurto } from '../lib/dates'
import { porCategoria, porMes, resumoMes } from '../lib/finance'
import { moeda, moedaCurta, percentual, soma } from '../lib/format'
import { Barra, Bolinha, Card, SeletorMes, Stat, Vazio } from '../components/ui'
import * as api from '../lib/api'
import { PreencherContas } from '../components/PreencherContas'

export function Painel() {
  const { categorias, cartoes, orcamentos, saldoTotal, executar, categoria } = useData()
  const [mes, setMes] = useState(inicioMes(hoje()))
  const { dados } = useTransacoes(addMeses(mes, -5), mes)

  const meses = useMemo(() => porMes(dados), [dados])
  const doMes = meses.get(mes) ?? []
  const r = resumoMes(doMes)
  const fatias = porCategoria(doMes, categorias)
  const taxaPoupanca = r.receitas ? r.saldo / r.receitas : 0

  const historico = Array.from({ length: 6 }, (_, i) => {
    const m = addMeses(mes, i - 5)
    const rr = resumoMes(meses.get(m) ?? [])
    return { mes: mesCurto(m), Receitas: rr.receitas, Despesas: rr.despesas }
  })

  // alertas
  const d = hoje()
  const vencidas = doMes.filter((t) => !t.pago && !t.cartao_id && t.data < d)
  const em7 = addDias(d, 7)
  const aVencer = doMes.filter((t) => !t.pago && !t.cartao_id && t.data >= d && t.data <= em7)
  const estourados = orcamentos
    .map((o) => ({ o, gasto: soma(doMes.filter((t) => t.tipo === 'despesa' && t.categoria_id === o.categoria_id), (t) => Number(t.valor)) }))
    .filter(({ o, gasto }) => gasto > Number(o.valor))

  const pendentes = doMes.filter((t) => !t.pago && !t.cartao_id).sort((a, b) => a.data.localeCompare(b.data))
  const faturas = cartoes.filter((c) => c.ativo).map((c) => {
    const ts = doMes.filter((t) => t.cartao_id === c.id)
    return { c, total: soma(ts, (t) => Number(t.valor)), aberto: ts.some((t) => !t.pago) }
  }).filter((f) => f.total > 0)

  const variaveis = Math.max(0, r.despesas - r.fixas - r.parcelas)
  const composicao = [
    { nome: 'Contas fixas', valor: r.fixas, cor: '#0f766e' },
    { nome: 'Parcelas', valor: r.parcelas, cor: '#7c3aed' },
    { nome: 'Gastos variáveis', valor: variaveis, cor: '#ea580c' },
  ]

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Painel</h1>
        <SeletorMes valor={mes} onChange={setMes} />
      </header>

      <div className="grade-stats">
        <Stat rotulo="Saldo nas contas" valor={saldoTotal} icone={<Landmark size={16} />}
          tom={saldoTotal >= 0 ? 'neutro' : 'neg'} detalhe="hoje, somando todas as contas" />
        <Stat rotulo="Receitas do mês" valor={r.receitas} tom="pos" icone={<ArrowUpCircle size={16} />}
          detalhe={r.pendentesReceber > 0 ? `${moeda(r.pendentesReceber)} a receber` : 'tudo recebido'} />
        <Stat rotulo="Despesas do mês" valor={r.despesas} tom="neg" icone={<ArrowDownCircle size={16} />}
          detalhe={r.pendentesPagar > 0 ? `${moeda(r.pendentesPagar)} em aberto` : 'tudo pago'} />
        <Stat rotulo="Sobra do mês" valor={r.saldo} tom={r.saldo >= 0 ? 'pos' : 'neg'} icone={<PiggyBank size={16} />}
          detalhe={r.receitas ? `você está guardando ${percentual(taxaPoupanca)} da renda` : '—'} />
      </div>

      <PreencherContas transacoes={doMes} />

      {(vencidas.length > 0 || aVencer.length > 0 || estourados.length > 0 || r.saldo < 0) && (
        <Card className="alertas">
          <ul>
            {r.saldo < 0 && (
              <li className="neg"><AlertTriangle size={16} />
                As despesas deste mês passam a renda em <b>{moeda(-r.saldo)}</b>.
                <Link to="/analise">Ver onde cortar</Link>
              </li>
            )}
            {vencidas.length > 0 && (
              <li className="neg"><AlertTriangle size={16} />
                {vencidas.length} conta(s) vencida(s) sem baixa: {moeda(soma(vencidas, (t) => Number(t.valor)))}
              </li>
            )}
            {aVencer.length > 0 && (
              <li className="alerta"><AlertTriangle size={16} />
                {aVencer.length} conta(s) vencem nos próximos 7 dias: {moeda(soma(aVencer, (t) => Number(t.valor)))}
              </li>
            )}
            {estourados.map(({ o, gasto }) => (
              <li key={o.id} className="neg"><AlertTriangle size={16} />
                Orçamento de <b>{categoria(o.categoria_id)?.nome}</b> estourado: {moeda(gasto)} de {moeda(Number(o.valor))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grade-2">
        <Card titulo="Para onde foi o dinheiro" acao={<Link to="/analise" className="btn-link">Análise completa</Link>}>
          {fatias.length ? (
            <div className="pizza-com-lista">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                    {fatias.map((f) => <Cell key={f.id} fill={f.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => moeda(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="lista-cat">
                {fatias.slice(0, 7).map((f) => (
                  <li key={f.id}>
                    <Bolinha cor={f.cor} /><span className="nome">{f.nome}</span>
                    <span className="pct">{percentual(f.pct)}</span><b>{moeda(f.valor)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : <Vazio>Nenhuma despesa neste mês.</Vazio>}
        </Card>

        <Card titulo="Receitas x despesas (6 meses)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={historico} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => moeda(v)} cursor={{ fill: 'var(--hover)' }} />
              <Legend iconType="circle" />
              <Bar dataKey="Receitas" fill="var(--positivo)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--negativo)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grade-3">
        <Card titulo="Contas a pagar / receber" acao={<Link to="/lancamentos" className="btn-link">Ver todos</Link>}>
          {pendentes.length ? (
            <ul className="lista-simples">
              {pendentes.slice(0, 8).map((t) => (
                <li key={t.id} className={t.data < d ? 'atrasado' : ''}>
                  <div>
                    <span>{t.descricao}</span>
                    <small>{dataBR(t.data)}{t.data < d && ' · vencida'}</small>
                  </div>
                  <b className={t.tipo === 'receita' ? 'tom-pos' : 'tom-neg'}>{moeda(Number(t.valor))}</b>
                  <button className="btn-icone" title="Marcar como pago"
                    onClick={() => executar(() => api.atualizarTransacao(t.id, { pago: true }), 'Baixa registrada')}>
                    <CheckCircle2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <Vazio>Nada pendente neste mês 🎉</Vazio>}
        </Card>

        <Card titulo="Faturas do mês" acao={<Link to="/cartoes" className="btn-link">Cartões</Link>}>
          {faturas.length ? (
            <ul className="lista-simples">
              {faturas.map(({ c, total, aberto }) => (
                <li key={c.id}>
                  <div><span><Bolinha cor={c.cor} /> {c.nome}</span>
                    <small>vence dia {c.dia_vencimento} · {aberto ? 'em aberto' : 'paga'}</small></div>
                  <b className="tom-neg">{moeda(total)}</b>
                </li>
              ))}
            </ul>
          ) : <Vazio>Sem faturas neste mês.</Vazio>}
        </Card>

        <Card titulo="Composição dos gastos">
          {r.despesas > 0 ? (
            <ul className="lista-barras">
              {composicao.map((c) => (
                <li key={c.nome}>
                  <div className="lb-topo"><span>{c.nome}</span><b>{moeda(c.valor)}</b></div>
                  <Barra valor={c.valor} max={r.despesas} cor={c.cor} alerta={false} />
                  <small>{percentual(c.valor / r.despesas)} das despesas
                    {r.receitas > 0 && ` · ${percentual(c.valor / r.receitas)} da renda`}</small>
                </li>
              ))}
            </ul>
          ) : <Vazio>Sem despesas.</Vazio>}
        </Card>
      </div>
    </div>
  )
}

function addDias(data: string, n: number) {
  const d = new Date(`${data}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
