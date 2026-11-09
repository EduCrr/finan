import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigurado } from '../lib/supabase'

export function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(await entrar(email, senha))
    setEnviando(false)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={enviar}>
        <div className="marca grande"><span className="logo">$</span> Finan</div>
        <p className="sub">Finanças da família, num lugar só.</p>
        {!supabaseConfigurado && (
          <p className="erro">
            Supabase não configurado. Crie o arquivo <code>.env.local</code> com
            VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).
          </p>
        )}
        <label>E-mail
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Senha
          <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
