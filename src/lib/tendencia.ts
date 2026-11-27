import type { Peso, ResumenDia } from './tipos'

const KCAL_POR_KG = 7700
const SUAVIZADO_DIARIO = 0.9 // cada día pesa un 10 % en la tendencia (media móvil exponencial)

export interface PuntoPeso {
  dia: string
  peso: number
  tendencia: number
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** Media móvil exponencial que tiene en cuenta los días que pasan entre pesadas. */
export function calcularTendencia(pesos: Peso[]): PuntoPeso[] {
  const puntos: PuntoPeso[] = []
  for (const p of pesos) {
    const anterior = puntos.at(-1)
    const tendencia = anterior
      ? anterior.tendencia + (1 - SUAVIZADO_DIARIO ** diasEntre(anterior.dia, p.measured_on)) * (p.weight_kg - anterior.tendencia)
      : p.weight_kg
    puntos.push({ dia: p.measured_on, peso: p.weight_kg, tendencia })
  }
  return puntos
}

/** Kilos por semana según la tendencia de las últimas semanas, o null si hay pocos datos. */
export function ritmoSemanal(puntos: PuntoPeso[], ventanaDias = 60): number | null {
  if (puntos.length < 2) return null
  const ultimo = puntos.at(-1)!
  const desde = puntos.find((p) => diasEntre(p.dia, ultimo.dia) <= ventanaDias) ?? puntos[0]
  const dias = diasEntre(desde.dia, ultimo.dia)
  if (dias < 7) return null
  return ((ultimo.tendencia - desde.tendencia) / dias) * 7
}

/** Semanas hasta el objetivo al ritmo actual, o null si no se va hacia él. */
export function semanasHastaObjetivo(actual: number, objetivo: number, ritmo: number | null) {
  if (ritmo == null || ritmo === 0) return null
  const semanas = (objetivo - actual) / ritmo
  return semanas > 0 ? semanas : null
}

/** Kilos por semana que corresponden a lo que comes frente a tu mantenimiento. */
export function ritmoPorCalorias(resumen: ResumenDia[], mantenimiento: number | null, dias = 14) {
  if (!mantenimiento) return null
  const recientes = resumen.slice(0, dias).filter((d) => d.kcal > 0)
  if (recientes.length < 5) return null
  const media = recientes.reduce((s, d) => s + d.kcal, 0) / recientes.length
  return { media, dias: recientes.length, kgSemana: ((media - mantenimiento) * 7) / KCAL_POR_KG }
}
