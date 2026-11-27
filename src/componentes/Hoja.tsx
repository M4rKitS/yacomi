import { useEffect, useRef, type ReactNode } from 'react'
import { Icono } from './Icono'

/** Panel que sube desde abajo en el móvil y se centra en el escritorio. */
export function Hoja({
  titulo,
  onCerrar,
  alta = false,
  children,
}: {
  titulo: string
  onCerrar: () => void
  /** Altura fija, para hojas cuyo contenido cambia y no deben dar saltos */
  alta?: boolean
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    document.addEventListener('keydown', alPulsar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = ''
      anterior?.focus()
    }
  }, [])

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div
        className={alta ? 'hoja alta' : 'hoja'}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hoja-cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </header>
        <div className="hoja-cuerpo">{children}</div>
      </div>
    </div>
  )
}
