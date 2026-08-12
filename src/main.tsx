import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { watchInstallPrompt } from './lib/install'
import './index.css'

registerSW({ immediate: true })

// Antes de montar a interface: o convite de instalação do Chrome chega uma
// vez só, e quem não estava ouvindo o perde.
watchInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
