import { useEffect, useState } from 'react'

/** Carga datos asíncronos y vuelve a cargarlos cuando cambian las dependencias. */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    cargar()
      .then((d) => {
        if (vivo) {
          setDatos(d)
          setError(null)
        }
      })
      .catch((e: Error) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { datos, error }
}
