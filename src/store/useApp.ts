import { useContext } from 'react'
import { AppContext, type AppValue } from './context'

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp precisa estar dentro de <AppProvider>.')
  return value
}
