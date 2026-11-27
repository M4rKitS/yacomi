import type { Alimento, Objetivos, Plato } from './tipos'

export const OBJETIVOS_POR_DEFECTO: Objetivos = {
  kcal_min: 2200,
  kcal_max: 2700,
  protein_g: 165,
  carbs_g: null,
  fat_g: null,
  maintenance_kcal: null,
  target_weight_kg: null,
}

const red2 = (n: number) => Math.round(n * 100) / 100

/** Valores de una ración de un alimento. */
export function racion(a: Pick<Alimento, 'kcal_100g' | 'protein_100g' | 'carbs_100g' | 'fat_100g'>, g: number) {
  return {
    kcal: Math.round((a.kcal_100g * g) / 100),
    protein: red2((a.protein_100g * g) / 100),
    carbs: a.carbs_100g == null ? null : red2((a.carbs_100g * g) / 100),
    fat: a.fat_100g == null ? null : red2((a.fat_100g * g) / 100),
  }
}

/** Días seguidos con algo apuntado, contando desde hoy (o desde ayer si hoy aún está vacío). */
export function calcularRacha(dias: Set<string>, hoy: string, sumarDias: (iso: string, n: number) => string) {
  let dia = dias.has(hoy) ? hoy : sumarDias(hoy, -1)
  let n = 0
  while (dias.has(dia)) {
    n++
    dia = sumarDias(dia, -1)
  }
  return n
}

/** Totales del plato entero. Carbohidratos y grasas solo si todos los ingredientes los tienen. */
export function totalesPlato(p: Plato) {
  const t = p.items.reduce(
    (s, i) => {
      const r = racion(i.food, i.grams)
      return {
        grams: s.grams + i.grams,
        kcal: s.kcal + r.kcal,
        protein: s.protein + r.protein,
        carbs: s.carbs == null || r.carbs == null ? null : s.carbs + r.carbs,
        fat: s.fat == null || r.fat == null ? null : s.fat + r.fat,
      }
    },
    { grams: 0, kcal: 0, protein: 0, carbs: 0 as number | null, fat: 0 as number | null },
  )
  return p.items.length ? t : { ...t, carbs: null, fat: null }
}
