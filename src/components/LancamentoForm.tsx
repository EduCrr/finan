import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import * as api from '../lib/api'
import type { TipoMov, Transacao } from '../lib/types'
import { hoje, mesCurto } from '../lib/dates'
import { competenciaFatura, dividirParcelas } from '../lib/finance'
import { moeda } from '../lib/format'
import { CampoValor, Modal } from './ui'

interface Props {
  aberto: boolean
  onFechar: () => void
  editar?: Transacao | null
  tipoInicial?: TipoMov
  cartaoInicial?: string
}

export function LancamentoForm(props: Props) {
  // remonta o formulário a cada abertura para limpar o estado
  if (!props.aberto) return null
  return <Formulario key={props.editar?.id ?? 'novo'} {...props} />
}

function Formulario({ onFechar, editar, tipoInicial = 'despesa', cartaoInicial }: Props) {
  const { categorias, contas, cartoes, executar } = useData()
  const [tipo, setTipo] = useState<TipoMov>(editar?.tipo ?? tipoInicial)
  const [descricao, setDescricao] = useState(editar?.descricao ?? '')
  const [valor, setValor] = useState(editar ? Number(editar.valor) : 0)
  const [data, setData] = useState(editar?.data ?? hoje())
  const [categoriaId, setCategoriaId] = useState(editar?.categoria_id ?? '')
  const [forma, setForma] = useState<'conta' | 'cartao'>(editar?.cartao_id || cartaoInicial ? 'cartao' : 'conta')
  const contasAtivas = contas.filter((c) => c.ativo)
  const cartoesAtivos = cartoes.filter((c) => c.ativo)
  const [contaId, setContaId] = useState(editar?.conta_id ?? contasAtivas[0]?.id ?? '')
  const [cartaoId, setCartaoId] = useState(editar?.cartao_id ?? cartaoInicial ?? cartoesAtivos[0]?.id ?? '')
  const [parcelas, setParcelas] = useState(1)
  const [pago, setPago] = useState(editar?.pago ?? true)
  const [obs, setObs] = useState(editar?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)

  const cats = categorias.filter((c) => c.tipo === tipo && c.ativo)
  const usaCartao = tipo === 'despesa' && forma === 'cartao'
  const cartao = cartoes.find((c) => c.id === cartaoId) ?? null

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (valor <= 0) return
    setSalvando(true)
    const okk = await executar(async () => {
      if (editar) {
        await api.atualizarTransacao(editar.id, {
          tipo, descricao, valor, data,
          categoria_id: categoriaId || null,
          conta_id: usaCartao ? editar.conta_id : contaId || null,
          pago,
          observacao: obs || null,
          a_preencher: false, // ao editar, o valor passa a ser o real
        })
      } else {
        await api.criarLancamento({
          tipo, descricao, valor, data,
          categoria_id: categoriaId || null,
          conta_id: usaCartao ? null : contaId || null,
          cartao: usaCartao ? cartao : null,
          parcelas: usaCartao || tipo === 'despesa' ? parcelas : 1,
          pago,
          observacao: obs || null,
        })
      }
    }, editar ? 'Lançamento atualizado' : 'Lançamento salvo')
    setSalvando(false)
    if (okk) onFechar()
  }

  const valorParcela = parcelas > 1 ? dividirParcelas(valor, parcelas)[parcelas - 1] : valor
  const primeiraFatura = usaCartao && cartao ? competenciaFatura(cartao, data) : null

  return (
    <Modal titulo={editar ? 'Editar lançamento' : 'Novo lançamento'} aberto onFechar={onFechar}>
      <form onSubmit={enviar} className="form">
        <div className="segmento">
          <button type="button" className={tipo === 'despesa' ? 'ativo neg' : ''}
            onClick={() => { setTipo('despesa'); setCategoriaId('') }}>Despesa</button>
          <button type="button" className={tipo === 'receita' ? 'ativo pos' : ''}
            onClick={() => { setTipo('receita'); setCategoriaId(''); setForma('conta') }}>Receita</button>
        </div>

        <label>Descrição
          <input required value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === 'receita' ? 'Ex.: Salário' : 'Ex.: Mercado do mês'} autoFocus />
        </label>

        <div className="linha">
          <label>{parcelas > 1 ? 'Valor total' : 'Valor'}
            <CampoValor valor={valor} onChange={setValor} />
          </label>
          <label>Data
            <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </label>
        </div>

        <label>Categoria
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
            <option value="">Selecione…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>

        {tipo === 'despesa' && !editar && (
          <div className="segmento pequeno">
            <button type="button" className={forma === 'conta' ? 'ativo' : ''} onClick={() => setForma('conta')}>
              Débito / Pix / Dinheiro
            </button>
            <button type="button" className={forma === 'cartao' ? 'ativo' : ''} onClick={() => setForma('cartao')}
              disabled={!cartoesAtivos.length} title={!cartoesAtivos.length ? 'Cadastre um cartão primeiro' : ''}>
              Cartão de crédito
            </button>
          </div>
        )}

        {usaCartao ? (
          <label>Cartão
            <select value={cartaoId} onChange={(e) => setCartaoId(e.target.value)} required disabled={!!editar}>
              {cartoesAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        ) : (
          <label>Conta
            <select value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Sem conta</option>
              {contasAtivas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        )}

        {!editar && tipo === 'despesa' && (
          <label>Parcelas
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
              {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
              ))}
            </select>
          </label>
        )}

        {(parcelas > 1 || primeiraFatura) && valor > 0 && (
          <p className="dica">
            {parcelas > 1 && <>{parcelas}x de {moeda(valorParcela)}. </>}
            {primeiraFatura && <>Entra na fatura de <b>{mesCurto(primeiraFatura)}</b>.</>}
          </p>
        )}

        {!usaCartao && (
          <label className="check">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            {tipo === 'receita' ? 'Já recebido' : 'Já pago'}
          </label>
        )}

        <label>Observação
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
        </label>

        <footer className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primario" disabled={salvando || valor <= 0}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
