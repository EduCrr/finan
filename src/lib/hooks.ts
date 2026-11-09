import { useEffect, useState } from 'react'
import { transacoesPorCompetencia } from './api'
import type { Transacao } from './types'
import { useData } from '../context/DataContext'

/** lançamentos entre duas competências, recarregados a cada gravação */
export function useTransacoes(inicio: string, fim: string) {
  const { versao, notificar } = useData()
  const [dados, setDados] = useState<Transacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    transacoesPorCompetencia(inicio, fim)
      .then((d) => { if (vivo) setDados(d) })
      .catch((e) => notificar(e.message, 'erro'))
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [inicio, fim, versao, notificar])

  return { dados, carregando }
}
