import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3, CalendarClock, CreditCard, LayoutDashboard, List, LogOut, Plus, Settings, Target, Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { LancamentoForm } from './LancamentoForm'

const LINKS = [
  { to: '/', label: 'Painel', icone: LayoutDashboard, mobile: true },
  { to: '/lancamentos', label: 'Lançamentos', icone: List, mobile: true },
  { to: '/cartoes', label: 'Cartões', icone: CreditCard, mobile: true },
  { to: '/contas-fixas', label: 'Contas fixas', icone: CalendarClock, mobile: false },
  { to: '/orcamento', label: 'Orçamento', icone: Wallet, mobile: false },
  { to: '/metas', label: 'Metas', icone: Target, mobile: false },
  { to: '/analise', label: 'Análise', icone: BarChart3, mobile: true },
  { to: '/configuracoes', label: 'Cadastros', icone: Settings, mobile: false },
]

export function Layout() {
  const { sair, session } = useAuth()
  const { pronto } = useData()
  const [novo, setNovo] = useState(false)
  const [menu, setMenu] = useState(false)

  return (
    <div className="app">
      <aside className={`lateral ${menu ? 'aberta' : ''}`}>
        <div className="marca"><span className="logo">$</span> Finan</div>
        <button className="btn btn-primario btn-novo" onClick={() => setNovo(true)}>
          <Plus size={18} /> Novo lançamento
        </button>
        <nav>
          {LINKS.map(({ to, label, icone: I }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenu(false)}>
              <I size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-rodape">
          <small title={session?.user.email}>{session?.user.email}</small>
          <button className="btn-link" onClick={sair}><LogOut size={16} /> Sair</button>
        </div>
      </aside>
      {menu && <div className="lateral-fundo" onClick={() => setMenu(false)} />}

      <main className="conteudo">
        {pronto ? <Outlet /> : <div className="carregando">Carregando suas finanças…</div>}
      </main>

      <nav className="nav-mobile">
        {LINKS.filter((l) => l.mobile).slice(0, 2).map(({ to, label, icone: I }) => (
          <NavLink key={to} to={to} end={to === '/'}><I size={20} /><span>{label}</span></NavLink>
        ))}
        <button className="fab" onClick={() => setNovo(true)} aria-label="Novo lançamento"><Plus size={26} /></button>
        {LINKS.filter((l) => l.mobile).slice(2).map(({ to, label, icone: I }) => (
          <NavLink key={to} to={to}><I size={20} /><span>{label}</span></NavLink>
        ))}
        <button className="nav-mais" onClick={() => setMenu(true)} aria-label="Menu"><Settings size={20} /><span>Mais</span></button>
      </nav>

      <LancamentoForm aberto={novo} onFechar={() => setNovo(false)} />
    </div>
  )
}
