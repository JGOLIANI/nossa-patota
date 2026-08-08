import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { IconBall } from '../components/icons'
import { Button, Field, Input, Note, Select } from '../components/ui'
import type { JoinCodePolicy } from '../data/types'
import { suggestUsername } from '../lib/player'
import { useApp } from '../store/useApp'
import type { DominantFoot, PlayerPosition, PlayerType } from '../types'

type Mode = 'login' | 'signup' | 'recuperar'

const TITLES: Record<Mode, string> = {
  login: 'Entre para ver a partida',
  signup: 'Crie seu acesso de jogador',
  recuperar: 'Recuperar o acesso',
}

export function LoginPage() {
  const { session, ready, demoMode, signIn, signUp, joinCodeRequired } = useApp()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [playerType, setPlayerType] = useState<PlayerType>('mensalista')
  const [position, setPosition] = useState<PlayerPosition>('linha')
  const [dominantFoot, setDominantFoot] = useState<DominantFoot>('direita')
  const [joinCode, setJoinCode] = useState('')
  const [codePolicy, setCodePolicy] = useState<JoinCodePolicy>('dispensado')
  // Enquanto a pessoa não mexe no campo, o usuário acompanha o nome digitado.
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // A patota pode exigir um código de entrada, e quem responde é o servidor —
  // só perguntamos quando o formulário de cadastro aparece.
  useEffect(() => {
    if (mode !== 'signup') return
    let active = true
    joinCodeRequired()
      .then((policy) => {
        if (active) setCodePolicy(policy)
      })
      .catch(() => {
        if (active) setCodePolicy('desconhecido')
      })
    return () => {
      active = false
    }
  }, [mode, joinCodeRequired])

  if (ready && session) return <Navigate to="/" replace />

  function go(next: Mode) {
    setMode(next)
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (mode === 'signup' && !fullName.trim()) {
      setError('Informe seu nome completo.')
      return
    }
    if (!username.trim()) {
      setError('Informe o nome de usuário.')
      return
    }
    // Só tranca quando o servidor confirmou que existe código. Em dúvida o
    // envio segue e o servidor decide — do contrário, uma consulta que falhou
    // barraria o primeiro acesso, quando não há código nem a quem pedir.
    if (mode === 'signup' && codePolicy === 'exigido' && !joinCode.trim()) {
      setError('Informe o código da patota.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(username, password)
      } else {
        await signUp({
          username,
          password,
          full_name: fullName,
          player_type: playerType,
          position,
          dominant_foot: dominantFoot,
          join_code: joinCode,
        })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-9 text-center">
        {/* O ícone do aplicativo, no mesmo formato do que fica na tela de
            início do iPhone: quadrado de cantos contínuos. */}
        <span className="squircle inline-flex size-[72px] items-center justify-center rounded-[22px] bg-brand text-brand-ink shadow-raised">
          <IconBall className="size-10" />
        </span>
        <h1 className="mt-5 text-title1 text-ink">Nossa Patota</h1>
        <p className="mt-1 text-subhead text-muted">{TITLES[mode]}</p>
      </div>

      {mode === 'recuperar' ? (
        <div className="space-y-4">
          <Note>
            O login da patota não usa e-mail, então não há link de recuperação para enviar. Peça a
            um administrador para redefinir sua senha: ele abre <strong>Elenco</strong>, toca no
            seu nome e usa <strong>Redefinir senha</strong>. Você entra com a senha que ele passar
            e o aplicativo já pede que escolha outra.
          </Note>
          <Button size="lg" block variant="secondary" onClick={() => go('login')}>
            Voltar para o login
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <Field label="Nome completo">
              <Input
                value={fullName}
                onChange={(event) => {
                  const value = event.target.value
                  setFullName(value)
                  if (!usernameTouched) setUsername(suggestUsername(value))
                }}
                placeholder="Igor Santos"
                autoCapitalize="words"
                autoFocus
              />
            </Field>
          )}

          <Field
            label="Nome de usuário"
            hint={mode === 'signup' ? 'É com ele que você entra no aplicativo.' : undefined}
          >
            <Input
              value={username}
              onChange={(event) => {
                setUsernameTouched(true)
                setUsername(event.target.value)
              }}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="seu.usuario"
            />
          </Field>

          <Field label="Senha" hint={mode === 'signup' ? 'Mínimo de 6 caracteres.' : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••"
            />
          </Field>

          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <Select
                    value={playerType}
                    onChange={(event) => setPlayerType(event.target.value as PlayerType)}
                  >
                    <option value="mensalista">Mensalista</option>
                    <option value="visitante">Visitante</option>
                  </Select>
                </Field>

                <Field label="Posição">
                  <Select
                    value={position}
                    onChange={(event) => setPosition(event.target.value as PlayerPosition)}
                  >
                    <option value="linha">Linha</option>
                    <option value="goleiro">Goleiro</option>
                  </Select>
                </Field>
              </div>

              <Field label="Perna dominante">
                <Select
                  value={dominantFoot}
                  onChange={(event) => setDominantFoot(event.target.value as DominantFoot)}
                >
                  <option value="direita">Direita</option>
                  <option value="esquerda">Esquerda</option>
                  <option value="ambidestro">Ambidestro</option>
                </Select>
              </Field>

              {codePolicy !== 'dispensado' && (
                <Field
                  label="Código da patota"
                  hint={
                    codePolicy === 'exigido'
                      ? 'Peça a um administrador.'
                      : 'Só preencha se a sua patota já tiver um código.'
                  }
                >
                  <Input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    placeholder="PATOTA24"
                  />
                </Field>
              )}
            </>
          )}

          {error && <Note tone="error">{error}</Note>}

          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar meu acesso'}
          </Button>
        </form>
      )}

      {mode !== 'recuperar' && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            className="text-subhead font-medium text-brand transition duration-200 ease-ios active:opacity-40"
            onClick={() => go(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Primeiro acesso? Criar minha conta' : 'Já tenho conta, quero entrar'}
          </button>
          {mode === 'login' && !demoMode && (
            <button
              type="button"
              className="text-footnote text-muted transition duration-200 ease-ios active:opacity-40"
              onClick={() => go('recuperar')}
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      )}

      {demoMode && (
        <div className="mt-8">
          <Note tone="warn">
            Modo demonstração. Entre como <strong>admin</strong> (administrador) ou{' '}
            <strong>igor</strong> (jogador). A senha é ignorada e os dados ficam só neste
            aparelho.
          </Note>
        </div>
      )}
    </div>
  )
}
