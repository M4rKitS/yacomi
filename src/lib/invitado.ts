const CLAVE = 'yacomi-invitado'

function leer() {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

// El enlace para compartir (/invitado) entra directamente, sin pasar por la pantalla de inicio
const porEnlace = /^\/invitado\/?$/.test(window.location.pathname)
if (porEnlace) history.replaceState(null, '', `/${window.location.hash}`)

let activo = porEnlace || leer()
if (porEnlace) recordar()

function recordar() {
  try {
    if (activo) localStorage.setItem(CLAVE, '1')
    else localStorage.removeItem(CLAVE)
  } catch {
    // sin almacenamiento, dura lo que dure la página
  }
}

export const esInvitado = () => activo

export function ponerInvitado(si: boolean) {
  activo = si
  recordar()
}
