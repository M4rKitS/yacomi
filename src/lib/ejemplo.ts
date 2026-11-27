import { racion } from './calculos'
import { hoyISO, sumarDias } from './formato'
import type { Alimento, Categoria, Comida, Medida, Objetivos, Peso } from './tipos'

export interface DatosInvitado {
  /** false mientras sean los datos de ejemplo o vacíos tal cual, sin nada apuntado por la persona */
  tocado?: boolean
  objetivos: Objetivos | null
  alimentos: Alimento[]
  comidas: Comida[]
  platos: { id: string; name: string; items: { food_id: string; grams: number }[] }[]
  pesos: Peso[]
  medidas: Medida[]
}

// Persona y datos inventados: aquí no hay nada de ninguna cuenta real
const ALIMENTOS: [clave: string, nombre: string, kcal: number, p: number, c: number, f: number][] = [
  ['avena', 'Copos de avena', 372, 13.5, 58.7, 7],
  ['leche', 'Leche semidesnatada', 46, 3.3, 4.8, 1.6],
  ['platano', 'Plátano', 89, 1.1, 22.8, 0.3],
  ['pan', 'Pan integral', 247, 11, 41, 3.5],
  ['huevo', 'Huevo', 143, 12.6, 0.7, 9.5],
  ['tomate', 'Tomate', 18, 0.9, 3.9, 0.2],
  ['aceite', 'Aceite de oliva', 884, 0, 0, 100],
  ['pollo', 'Pechuga de pollo a la plancha', 165, 31, 0, 3.6],
  ['arroz', 'Arroz blanco cocido', 130, 2.7, 28.2, 0.3],
  ['lentejas', 'Lentejas cocidas', 116, 9, 20.1, 0.4],
  ['salmon', 'Salmón al horno', 206, 22, 0, 12.4],
  ['patata', 'Patata cocida', 86, 1.7, 20, 0.1],
  ['brocoli', 'Brócoli', 35, 2.4, 7.2, 0.4],
  ['pasta', 'Pasta cocida', 158, 5.8, 30.9, 0.9],
  ['atun', 'Atún al natural', 116, 25.5, 0, 0.8],
  ['yogur', 'Yogur griego natural', 97, 9, 3.6, 5],
  ['nueces', 'Nueces', 654, 15.2, 13.7, 65.2],
  ['manzana', 'Manzana', 52, 0.3, 13.8, 0.2],
  ['garbanzos', 'Garbanzos cocidos', 164, 8.9, 27.4, 2.6],
  ['queso', 'Queso fresco', 174, 12, 3.5, 12.5],
]

type Parte = [Categoria, hora: number, [clave: string, gramos: number][]]

const DIAS: Parte[][] = [
  [
    ['Desayuno', 8, [['avena', 60], ['leche', 250], ['platano', 120]]],
    ['Comida', 14, [['pollo', 180], ['arroz', 250], ['brocoli', 150], ['aceite', 10]]],
    ['Merienda', 17, [['yogur', 170], ['nueces', 20]]],
    ['Cena', 21, [['salmon', 150], ['patata', 250], ['tomate', 150], ['aceite', 10]]],
  ],
  [
    ['Desayuno', 8, [['pan', 90], ['huevo', 120], ['tomate', 80], ['aceite', 8]]],
    ['Comida', 14, [['lentejas', 350], ['arroz', 120], ['aceite', 10]]],
    ['Merienda', 18, [['manzana', 180], ['nueces', 25]]],
    ['Cena', 21, [['atun', 120], ['pasta', 260], ['tomate', 150], ['aceite', 10]]],
  ],
  [
    ['Desayuno', 9, [['yogur', 200], ['avena', 50], ['platano', 100]]],
    ['Almuerzo', 11, [['pan', 60], ['queso', 60]]],
    ['Comida', 14, [['garbanzos', 250], ['huevo', 60], ['tomate', 120], ['aceite', 12]]],
    ['Cena', 21, [['pollo', 160], ['patata', 250], ['brocoli', 150], ['aceite', 10]]],
  ],
  [
    ['Desayuno', 8, [['pan', 80], ['queso', 60], ['manzana', 150]]],
    ['Comida', 14, [['pasta', 300], ['pollo', 150], ['tomate', 120], ['aceite', 12]]],
    ['Merienda', 17, [['yogur', 170], ['platano', 120]]],
    ['Cena', 22, [['salmon', 140], ['arroz', 200], ['brocoli', 120]]],
  ],
]

export function crearEjemplo(): DatosInvitado {
  const alimentos: Alimento[] = ALIMENTOS.map(([, name, kcal_100g, protein_100g, carbs_100g, fat_100g]) => ({
    id: crypto.randomUUID(),
    name,
    kcal_100g,
    protein_100g,
    carbs_100g,
    fat_100g,
    barcode: null,
  }))
  const de = (clave: string) => alimentos[ALIMENTOS.findIndex((a) => a[0] === clave)]
  const hoy = hoyISO()
  const ahora = new Date().getHours()

  const comidas: Comida[] = []
  for (let atras = 29; atras >= 0; atras--) {
    const dia = sumarDias(hoy, -atras)
    const [y, m, d] = dia.split('-').map(Number)
    DIAS[atras % DIAS.length].forEach(([category, hora, partes], n) => {
      // Hoy solo lo que ya daría tiempo a haber comido
      if (atras === 0 && n > 0 && hora > ahora) return
      partes.forEach(([clave, base], i) => {
        const a = de(clave)
        // Pequeñas variaciones para que cada día sea distinto
        const grams = clave === 'huevo' ? base : Math.round(base * (0.92 + ((atras * 7 + i * 3 + n * 5) % 9) * 0.02))
        comidas.push({
          id: crypto.randomUUID(),
          eaten_at: new Date(y, m - 1, d, hora, i).toISOString(),
          eaten_on: dia,
          category,
          name: a.name,
          grams,
          ...racion(a, grams),
          kcal_100g: a.kcal_100g,
          protein_100g: a.protein_100g,
          carbs_100g: a.carbs_100g,
          fat_100g: a.fat_100g,
          food_id: a.id,
          source: 'despensa',
        })
      })
    })
  }

  const r1 = (n: number) => Math.round(n * 10) / 10
  const pesos: Peso[] = []
  for (let atras = 58; atras >= 0; atras -= 2)
    pesos.push({
      id: crypto.randomUUID(),
      measured_on: sumarDias(hoy, -atras),
      weight_kg: r1(72.4 + atras * 0.038 + Math.sin(atras * 1.7) * 0.35),
    })

  return {
    tocado: false,
    objetivos: {
      kcal_min: 1900,
      kcal_max: 2250,
      protein_g: 115,
      carbs_g: 220,
      fat_g: 65,
      maintenance_kcal: 2250,
      target_weight_kg: 70,
    },
    alimentos,
    comidas,
    platos: [
      {
        id: crypto.randomUUID(),
        name: 'Pollo con arroz y brócoli',
        items: [['pollo', 180], ['arroz', 220], ['brocoli', 150], ['aceite', 10]].map(([k, g]) => ({
          food_id: de(k as string).id,
          grams: g as number,
        })),
      },
      {
        id: crypto.randomUUID(),
        name: 'Gachas de avena con plátano',
        items: [['avena', 60], ['leche', 250], ['platano', 120]].map(([k, g]) => ({ food_id: de(k as string).id, grams: g as number })),
      },
    ],
    pesos,
    medidas: [
      { id: crypto.randomUUID(), measured_on: sumarDias(hoy, -42), waist_cm: 84, chest_cm: 98, thigh_cm: 57, hip_cm: 97 },
      { id: crypto.randomUUID(), measured_on: sumarDias(hoy, -7), waist_cm: 82, chest_cm: 97.5, thigh_cm: 56.5, hip_cm: 96 },
    ],
  }
}
