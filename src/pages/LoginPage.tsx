import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { IconBall } from '../components/icons'
import { Button, Field, Input, Note } from '../components/ui'
import { useApp } from '../store/useApp'

export function LoginPage() {
  const { session, ready, demoMode, signIn, signUp } = useApp()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && session) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!username.trim()) {
      setError('Informe o nome de usuário.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await signIn(username, password)
      else await signUp(username, password)
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
        <p className="mt-1 text-subhead text-muted">
          {mode === 'login' ? 'Entre para ver a rodada' : 'Crie seu acesso de jogador'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome de usuário">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
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

        {error && <Note tone="error">{error}</Note>}

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar acesso'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-subhead font-medium text-brand transition duration-200 ease-ios active:opacity-40"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError('')
        }}
      >
        {mode === 'login' ? 'Primeiro acesso? Criar minha senha' : 'Já tenho acesso, quero entrar'}
      </button>

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
