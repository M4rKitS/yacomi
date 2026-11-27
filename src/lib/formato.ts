import type { Categoria } from './tipos'

// 'always' agrupa también los números de 4 cifras (1.316), que en es-ES no se agrupan por defecto
const agrupar = 'always' as unknown as boolean
const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: agrupar })
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, useGrouping: agrupar })

export const kcal = (n: number) => entero.format(Math.round(n))
export const gramos = (n: number | null | undefined) => (n == null ? '—' : decimal.format(n))

export function fechaISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

export const hoyISO = () => fechaISO(new Date())

function aFecha(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function sumarDias(iso: string, n: number) {
  const f = aFecha(iso)
  f.setDate(f.getDate() + n)
  return fechaISO(f)
}

const largo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const corto = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

export function fechaLarga(iso: string) {
  const s = largo.format(aFecha(iso))
  return s[0].toUpperCase() + s.slice(1)
}

export function fechaCorta(iso: string) {
  const hoy = hoyISO()
  if (iso === hoy) return 'Hoy'
  if (iso === sumarDias(hoy, -1)) return 'Ayer'
  const s = corto.format(aFecha(iso)).replace(/\./g, '')
  return s[0].toUpperCase() + s.slice(1)
}

export function categoriaPorHora(h = new Date().getHours()): Categoria {
  if (h < 11) return 'Desayuno'
  if (h < 13) return 'Almuerzo'
  if (h < 16) return 'Comida'
  if (h < 19) return 'Merienda'
  if (h < 23) return 'Cena'
  return 'Extra'
}

/** Convierte el texto de un campo numérico (acepta coma decimal) en número o null. */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) && n >= 0 ? n : null
}
