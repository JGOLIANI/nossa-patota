import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { IconBall } from '../components/icons'
import { Button, ErrorText, Field, Input } from '../components/ui'
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
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <IconBall className="size-9" />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Nossa Patota</h1>
        <p className="mt-1 text-sm text-slate-400">
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
            inputMode="text"
          />
        </Field>

        <Field
          label="Senha"
          hint={mode === 'signup' ? 'Mínimo de 6 caracteres.' : undefined}
        >
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••"
          />
        </Field>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar acesso'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-center text-sm text-slate-400 underline underline-offset-4"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError('')
        }}
      >
        {mode === 'login'
          ? 'Primeiro acesso? Criar minha senha'
          : 'Já tenho acesso, quero entrar'}
      </button>

      {demoMode && (
        <p className="mt-8 rounded-xl bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-200">
          Modo demonstração ativo. Entre como <strong>admin</strong> (administrador) ou{' '}
          <strong>igor</strong> (jogador). A senha é ignorada e os dados ficam salvos apenas
          neste aparelho.
        </p>
      )}
    </div>
  )
}
