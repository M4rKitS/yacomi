import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Si se publica una versión nueva con la web abierta, los archivos antiguos ya no existen: se recarga una vez
window.addEventListener('vite:preloadError', (e) => {
  try {
    const clave = 'yacomi-recarga'
    if (Date.now() - Number(sessionStorage.getItem(clave) ?? 0) < 30_000) return
    sessionStorage.setItem(clave, String(Date.now()))
  } catch {
    return
  }
  e.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
