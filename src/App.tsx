import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Painel } from './pages/Painel'
import { Lancamentos } from './pages/Lancamentos'
import { Cartoes } from './pages/Cartoes'
import { ContasFixas } from './pages/ContasFixas'
import { Orcamento } from './pages/Orcamento'
import { Metas } from './pages/Metas'
import { Analise } from './pages/Analise'
import { Cadastros } from './pages/Cadastros'

function Rotas() {
  const { session, carregando } = useAuth()
  if (carregando) return <div className="carregando tela">Carregando…</div>
  if (!session) return <Login />
  return (
    // a key garante que os dados recarreguem ao trocar de usuário
    <DataProvider key={session.user.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Painel />} />
          <Route path="lancamentos" element={<Lancamentos />} />
          <Route path="cartoes" element={<Cartoes />} />
          <Route path="contas-fixas" element={<ContasFixas />} />
          <Route path="orcamento" element={<Orcamento />} />
          <Route path="metas" element={<Metas />} />
          <Route path="analise" element={<Analise />} />
          <Route path="configuracoes" element={<Cadastros />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
