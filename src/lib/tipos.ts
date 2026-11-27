export const CATEGORIAS = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Extra'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export interface Alimento {
  id: string
  name: string
  kcal_100g: number
  protein_100g: number
  carbs_100g: number | null
  fat_100g: number | null
  barcode: string | null
}

export interface Comida {
  id: string
  eaten_at: string
  eaten_on: string
  category: Categoria
  name: string
  grams: number | null
  kcal: number
  protein: number
  carbs: number | null
  fat: number | null
  kcal_100g: number | null
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
  food_id: string | null
  dish_id?: string | null
  source: string
}

export type NuevaComida = Omit<Comida, 'id' | 'eaten_at'>

export interface Objetivos {
  kcal_min: number
  kcal_max: number
  protein_g: number
  carbs_g: number | null
  fat_g: number | null
  maintenance_kcal: number | null
  target_weight_kg: number | null
}

export interface ResumenDia {
  eaten_on: string
  kcal: number
  protein: number
  carbs: number | null
  fat: number | null
  comidas: number
}

export interface Peso {
  id: string
  measured_on: string
  weight_kg: number
}

export interface Medida {
  id: string
  measured_on: string
  waist_cm: number | null
  chest_cm: number | null
  thigh_cm: number | null
  hip_cm: number | null
}

export interface Ingrediente {
  food: Alimento
  grams: number
}

export interface Plato {
  id: string
  name: string
  items: Ingrediente[]
}
