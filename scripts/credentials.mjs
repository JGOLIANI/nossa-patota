/**
 * Validação das credenciais do Supabase.
 *
 * Vive fora do `setup.mjs` porque duas frentes precisam das mesmas regras: o
 * script que grava o `.env` na máquina de quem desenvolve e a guarda do
 * workflow de deploy, que roda antes do build no GitHub Actions.
 */

export function validateUrl(value) {
  if (!value) return 'Informe a URL do projeto.'
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return 'URL inválida. Ela se parece com https://abcdefgh.supabase.co'
  }
  if (parsed.protocol !== 'https:') return 'A URL precisa começar com https://'
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return 'Use apenas o endereço base, sem caminho depois do domínio.'
  }
  return ''
}

export function validateKey(value) {
  if (!value) return 'Informe a chave anônima (anon/publishable).'
  const isJwt = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(value)
  const isPublishable = /^sb_publishable_[\w-]+$/.test(value)
  if (!isJwt && !isPublishable) {
    return 'Chave em formato inesperado. Copie a chave "anon public" do painel.'
  }
  if (isJwt) {
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString())
      if (payload.role === 'service_role') {
        return 'Esta é a chave service_role — ela NUNCA deve ir para o aplicativo. Use a chave anon.'
      }
    } catch {
      // Chave opaca: seguimos apenas com a validação de formato.
    }
  }
  return ''
}
