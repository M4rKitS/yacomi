import { useLayoutEffect, useRef, useState } from 'react'

/** Ancho real del elemento en píxeles, para dibujar las gráficas 1:1 y que el texto no encoja en el móvil. */
export function useAncho<T extends HTMLElement>(inicial: number) {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(inicial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => el.clientWidth > 0 && setAncho(Math.round(el.clientWidth))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho] as const
}
