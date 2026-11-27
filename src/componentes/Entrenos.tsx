import { useEffect, useState } from 'react'
import { fechaCorta, fechaISO, gramos, hoyISO, sumarDias } from '../lib/formato'
import { llamar } from '../lib/ia'

type Serie = { type?: string; weight_kg?: number | null; reps?: number | null }
type Entreno = {
  id: string
  title: string
  start_time: string
  end_time: string
  exercises: { title: string; sets: Serie[] }[]
}

const minutos = (e: Entreno) => Math.round((Date.parse(e.end_time) - Date.parse(e.start_time)) / 60_000)
const volumen = (e: Entreno) =>
  e.exercises.reduce((s, x) => s + x.sets.reduce((t, z) => t + (z.type === 'warmup' ? 0 : (z.weight_kg ?? 0) * (z.reps ?? 0)), 0), 0)
const series = (e: Entreno) => e.exercises.reduce((s, x) => s + x.sets.filter((z) => z.type !== 'warmup').length, 0)

/** Últimos entrenos de Hevy (solo lectura). */
export function Entrenos() {
  const [entrenos, setEntrenos] = useState<Entreno[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    llamar<{ workouts: Entreno[] }>('/api/hevy/workouts?page=1&pageSize=10')
      .then((r) => setEntrenos(r.workouts))
      .catch((e: Error) => setError(e.message))
  }, [])

  const hace7 = sumarDias(hoyISO(), -6)
  const semana = entrenos?.filter((e) => fechaISO(new Date(e.start_time)) >= hace7) ?? []

  return (
    <section className="tarjeta seccion">
      <h2 className="subtitulo">Entrenos</h2>
      {error && <p className="vacio">{error}</p>}
      {!entrenos && !error && <p className="cargando">Cargando tus entrenos de Hevy…</p>}
      {entrenos && entrenos.length === 0 && <p className="vacio">Aún no hay entrenos en Hevy.</p>}
      {entrenos && entrenos.length > 0 && (
        <>
          <p className="fila-detalle">
            {semana.length === 0
              ? 'Ningún entreno en los últimos 7 días'
              : `${semana.length} ${semana.length === 1 ? 'entreno' : 'entrenos'} en los últimos 7 días · ${gramos(
                  semana.reduce((s, e) => s + minutos(e), 0),
                )} min`}
          </p>
          <ul className="filas entrenos">
            {entrenos.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="fila"
                  aria-expanded={abierto === e.id}
                  onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                >
                  <span className="fila-texto">
                    <span className="fila-nombre">{e.title}</span>
                    <span className="fila-detalle">
                      {fechaCorta(fechaISO(new Date(e.start_time)))} · {minutos(e)} min · {series(e)} series
                    </span>
                  </span>
                  <span className="fila-kcal">{gramos(Math.round(volumen(e)))} kg</span>
                </button>
                {abierto === e.id && (
                  <ul className="ejercicios">
                    {e.exercises.map((x, i) => {
                      const efectivas = x.sets.filter((z) => z.type !== 'warmup')
                      return (
                        <li key={i}>
                          <span>{x.title}</span>
                          <span className="fila-detalle">
                            {efectivas
                              .map((z) => (z.weight_kg ? `${gramos(z.weight_kg)}×${z.reps ?? 0}` : z.reps ? `${z.reps} rep.` : '—'))
                              .join(' · ')}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
