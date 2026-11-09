import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  session: Session | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<string | null>
  sair: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (!error) return null
    return error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, carregando, entrar, sair }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
