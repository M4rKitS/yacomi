import { OBJETIVOS_POR_DEFECTO } from './calculos'
import { supabase } from './supabase'
import type { Alimento, Comida, Medida, NuevaComida, Objetivos, Peso, Plato, ResumenDia } from './tipos'

/** Lanza el error de Supabase si lo hay; si no, devuelve los datos ya sin el null. */
function comprobar<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message)
  return r.data as NonNullable<T>
}

export async function cargarObjetivos(): Promise<Objetivos> {
  const data = comprobar(await supabase.from('goals').select('*').maybeSingle())
  return data ?? OBJETIVOS_POR_DEFECTO
}

export async function guardarObjetivos(o: Objetivos) {
  comprobar(await supabase.from('goals').upsert(o))
}

export async function cargarComidasDe(dia: string): Promise<Comida[]> {
  return comprobar(await supabase.from('meals').select('*').eq('eaten_on', dia).order('eaten_at'))
}

export async function cargarResumen(desde: string): Promise<ResumenDia[]> {
  return comprobar(
    await supabase
      .from('resumen_diario')
      .select('eaten_on, kcal, protein, carbs, fat, comidas')
      .gte('eaten_on', desde)
      .order('eaten_on', { ascending: false }),
  )
}

/** Comidas recientes sin repetir (mismo nombre y gramos), para «Repetir». */
export async function cargarRecientes(): Promise<Comida[]> {
  const filas: Comida[] = comprobar(
    await supabase.from('meals').select('*').order('eaten_at', { ascending: false }).limit(300),
  )
  const vistas = new Set<string>()
  return filas.filter((c) => {
    const clave = `${c.name.toLowerCase()}|${c.grams ?? c.kcal}`
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  })
}

export async function anadirComida(c: NuevaComida) {
  comprobar(await supabase.from('meals').insert(c))
}

export async function actualizarComida(id: string, cambios: Partial<NuevaComida>) {
  comprobar(await supabase.from('meals').update(cambios).eq('id', id))
}

/** Vuelve a guardar una comida borrada, con el mismo id (para «Deshacer»). */
export async function restaurarComida(c: Comida) {
  comprobar(await supabase.from('meals').insert(c))
}

export async function borrarComida(id: string) {
  comprobar(await supabase.from('meals').delete().eq('id', id))
}

export async function cargarAlimentos(): Promise<Alimento[]> {
  return comprobar(await supabase.from('foods').select('*').order('name'))
}

export async function guardarAlimento(a: Omit<Alimento, 'id'> & { id?: string }): Promise<Alimento> {
  return comprobar(await supabase.from('foods').upsert(a).select().single())
}

export async function borrarAlimento(id: string) {
  const r = await supabase.from('foods').delete().eq('id', id)
  if (r.error?.code === '23503') throw new Error('Este alimento está en algún plato. Quítalo del plato antes de borrarlo.')
  comprobar(r)
}

export async function contarComidasDeAlimento(id: string): Promise<number> {
  const r = await supabase.from('meals').select('id', { count: 'exact', head: true }).eq('food_id', id)
  if (r.error) throw new Error(r.error.message)
  return r.count ?? 0
}

/** Recalcula las comidas anteriores con los valores actuales del alimento. Devuelve cuántas cambió. */
export async function corregirComidasDeAlimento(id: string): Promise<number> {
  return comprobar(await supabase.rpc('corregir_comidas_de_alimento', { p_food: id }))
}

async function miId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('No hay sesión iniciada')
  return id
}

export async function cargarPesos(): Promise<Peso[]> {
  return comprobar(await supabase.from('weights').select('id, measured_on, weight_kg').order('measured_on'))
}

/** Guarda el peso de un día; si ya había uno ese día, lo sustituye. */
export async function guardarPeso(dia: string, kg: number) {
  const user_id = await miId()
  comprobar(
    await supabase.from('weights').upsert({ user_id, measured_on: dia, weight_kg: kg }, { onConflict: 'user_id,measured_on' }),
  )
}

export async function borrarPeso(id: string) {
  comprobar(await supabase.from('weights').delete().eq('id', id))
}

export async function cargarMedidas(): Promise<Medida[]> {
  return comprobar(
    await supabase
      .from('measurements')
      .select('id, measured_on, waist_cm, chest_cm, thigh_cm, hip_cm')
      .order('measured_on', { ascending: false }),
  )
}

export async function guardarMedida(m: Omit<Medida, 'id'>) {
  const user_id = await miId()
  comprobar(await supabase.from('measurements').upsert({ ...m, user_id }, { onConflict: 'user_id,measured_on' }))
}

export async function borrarMedida(id: string) {
  comprobar(await supabase.from('measurements').delete().eq('id', id))
}

type FilaPlato = {
  id: string
  name: string
  dish_items: { grams: number; position: number; foods: Alimento | null }[]
}

export async function cargarPlatos(): Promise<Plato[]> {
  const filas: FilaPlato[] = comprobar(
    await supabase.from('dishes').select('id, name, dish_items(grams, position, foods(*))').order('name'),
  ) as unknown as FilaPlato[]
  return filas.map((p) => ({
    id: p.id,
    name: p.name,
    items: [...p.dish_items]
      .sort((a, b) => a.position - b.position)
      .filter((i) => i.foods)
      .map((i) => ({ food: i.foods!, grams: i.grams })),
  }))
}

/** Guarda el plato y sustituye su lista de ingredientes. */
export async function guardarPlato(p: { id?: string; name: string; items: { food_id: string; grams: number }[] }) {
  const plato: { id: string } = comprobar(
    await supabase.from('dishes').upsert(p.id ? { id: p.id, name: p.name } : { name: p.name }).select('id').single(),
  )
  comprobar(await supabase.from('dish_items').delete().eq('dish_id', plato.id))
  if (p.items.length)
    comprobar(
      await supabase
        .from('dish_items')
        .insert(p.items.map((i, position) => ({ dish_id: plato.id, food_id: i.food_id, grams: i.grams, position }))),
    )
}

export async function borrarPlato(id: string) {
  comprobar(await supabase.from('dishes').delete().eq('id', id))
}
