import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icono } from './Icono'

const ANCHO_BORRAR = 88
const UMBRAL_ABRIR = 48
const UMBRAL_EDITAR = 80
const EVENTO = 'yacomi:cerrar-deslizables'

/**
 * Fila que se desliza: a la izquierda descubre la papelera y a la derecha abre la edición.
 * Tocarla también edita, y el teclado llega a los dos botones, así que el gesto es solo un atajo.
 */
export function Deslizable({
  etiqueta,
  onEditar,
  onBorrar,
  children,
}: {
  etiqueta: string
  onEditar: () => void
  onBorrar: () => void
  children: ReactNode
}) {
  const id = useId()
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const gesto = useRef<{ x: number; y: number; base: number; decidido: boolean; movido: boolean } | null>(null)
  const abierto = desplazamiento <= -ANCHO_BORRAR

  // Al abrir una fila se cierran las demás
  useEffect(() => {
    const alAbrirOtra = (e: Event) => (e as CustomEvent<string>).detail !== id && setDesplazamiento(0)
    window.addEventListener(EVENTO, alAbrirOtra)
    return () => window.removeEventListener(EVENTO, alAbrirOtra)
  }, [id])

  function alBajar(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesto.current = { x: e.clientX, y: e.clientY, base: desplazamiento, decidido: false, movido: false }
  }

  function alMover(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesto.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.decidido) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        gesto.current = null // es un desplazamiento vertical de la página
        return
      }
      if (Math.abs(dx) < 8) return
      g.decidido = true
      g.movido = true
      setArrastrando(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: id }))
    }
    setDesplazamiento(Math.max(-ANCHO_BORRAR - 24, Math.min(UMBRAL_EDITAR + 40, g.base + dx)))
  }

  function alSoltar() {
    const g = gesto.current
    setArrastrando(false)
    if (!g?.decidido) return
    if (desplazamiento >= UMBRAL_EDITAR) {
      setDesplazamiento(0)
      onEditar()
    } else if (desplazamiento <= -UMBRAL_ABRIR) {
      setDesplazamiento(-ANCHO_BORRAR)
    } else {
      setDesplazamiento(0)
    }
  }

  function alPulsar() {
    // El clic que llega al final de un arrastre no cuenta
    if (gesto.current?.movido) {
      gesto.current = null
      return
    }
    gesto.current = null
    if (desplazamiento !== 0) setDesplazamiento(0)
    else onEditar()
  }

  const fondo = desplazamiento > 0 ? 'editar' : 'borrar'

  return (
    <div className={`desliza ${fondo}${desplazamiento === 0 && !arrastrando ? ' reposo' : ''}`}>
      <div className="desliza-fondo" aria-hidden={!abierto && desplazamiento === 0}>
        <span className="desliza-editar">
          <Icono nombre="lapiz" tamano={20} /> Editar
        </span>
        <button
          type="button"
          className="desliza-borrar"
          tabIndex={abierto ? 0 : -1}
          aria-label={`Borrar ${etiqueta}`}
          onClick={() => {
            setDesplazamiento(0)
            onBorrar()
          }}
        >
          <Icono nombre="papelera" tamano={22} />
        </button>
      </div>
      <button
        type="button"
        className={`fila desliza-frente${arrastrando ? ' arrastrando' : ''}`}
        style={{ transform: `translateX(${desplazamiento}px)` }}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClick={alPulsar}
        onKeyDown={(e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault()
            onBorrar()
          }
        }}
        aria-label={`${etiqueta}. Pulsa para editar; Suprimir para borrar`}
      >
        {children}
      </button>
    </div>
  )
}
