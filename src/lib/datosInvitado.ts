import { racion } from './calculos'
import { crearEjemplo, type DatosInvitado } from './ejemplo'
import type { Alimento, Comida, Medida, NuevaComida, Objetivos, Peso, Plato, ResumenDia } from './tipos'

// Mismas funciones que datosNube.ts, pero guardando en este navegador
const CLAVE = 'yacomi-invitado-datos'
const CLAVE_ANTERIOR = 'yacomi-invitado-anterior'
let memoria: DatosInvitado | null = null
let anterior: DatosInvitado | null | undefined

const OBJETIVOS: Objetivos = {
  kcal_min: 1800,
  kcal_max: 2200,
  protein_g: 100,
  carbs_g: null,
  fat_g: null,
  maintenance_kcal: null,
  target_weight_kg: null,
}

const VACIO = (): DatosInvitado => ({ objetivos: null, alimentos: [], comidas: [], platos: [], pesos: [], medidas: [] })

function leer(): DatosInvitado {
  try {
    const t = localStorage.getItem(CLAVE)
    if (t) return { ...VACIO(), ...JSON.parse(t) }
  } catch {
    // sin almacenamiento o con datos rotos: se usa la copia en memoria
  }
  return memoria ?? guardar(crearEjemplo())
}

function guardar(d: DatosInvitado) {
  memoria = d
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d))
  } catch {
    // sin almacenamiento, dura lo que dure la página
  }
  return d
}

async function cambiar(f: (d: DatosInvitado) => void) {
  const d = leer()
  f(d)
  guardar({ ...d, tocado: true })
}

const nuevoId = () => crypto.randomUUID()
const suma = (v: (number | null)[]) => {
  const n = v.filter((x) => x != null)
  return n.length ? Math.round(n.reduce((s, x) => s + x, 0) * 10) / 10 : null
}

function leerAnterior(): DatosInvitado | null {
  if (anterior === undefined) {
    anterior = null
    try {
      const t = localStorage.getItem(CLAVE_ANTERIOR)
      if (t) anterior = { ...VACIO(), ...JSON.parse(t) }
    } catch {
      // sin copia que recuperar
    }
  }
  return anterior ?? null
}

function guardarAnterior(d: DatosInvitado | null) {
  anterior = d
  try {
    if (d) localStorage.setItem(CLAVE_ANTERIOR, JSON.stringify(d))
    else localStorage.removeItem(CLAVE_ANTERIOR)
  } catch {
    // sin almacenamiento, la copia dura lo que dure la página
  }
}

/** Cambia todos los datos. Antes guarda una copia, salvo que no haya nada propio: así pulsar dos veces no pisa la buena. */
function sustituir(d: DatosInvitado) {
  const actual = leer()
  if (actual.tocado !== false) guardarAnterior(actual)
  guardar(d)
}

export const empezarDeCero = () => sustituir({ ...VACIO(), tocado: false })
export const ponerEjemplo = () => sustituir(crearEjemplo())
export const hayAnterior = () => leerAnterior() != null

/** Vuelve a la copia. Lo que haya ahora pasa a ser la copia, así que también se puede deshacer. */
export function recuperarAnterior() {
  const copia = leerAnterior()
  if (!copia) return
  const actual = leer()
  guardarAnterior(actual.tocado !== false ? actual : null)
  guardar(copia)
}

export async function cargarObjetivos(): Promise<Objetivos> {
  return leer().objetivos ?? OBJETIVOS
}

export async function guardarObjetivos(o: Objetivos) {
  await cambiar((d) => {
    d.objetivos = o
  })
}

export async function cargarComidasDe(dia: string): Promise<Comida[]> {
  return leer()
    .comidas.filter((c) => c.eaten_on === dia)
    .sort((a, b) => a.eaten_at.localeCompare(b.eaten_at))
}

export async function cargarResumen(desde: string): Promise<ResumenDia[]> {
  const dias = new Map<string, Comida[]>()
  for (const c of leer().comidas) if (c.eaten_on >= desde) dias.set(c.eaten_on, [...(dias.get(c.eaten_on) ?? []), c])
  return [...dias]
    .map(([eaten_on, cs]) => ({
      eaten_on,
      kcal: cs.reduce((s, c) => s + c.kcal, 0),
      protein: suma(cs.map((c) => c.protein)) ?? 0,
      carbs: suma(cs.map((c) => c.carbs)),
      fat: suma(cs.map((c) => c.fat)),
      comidas: cs.length,
    }))
    .sort((a, b) => b.eaten_on.localeCompare(a.eaten_on))
}

export async function cargarRecientes(): Promise<Comida[]> {
  const vistas = new Set<string>()
  return leer()
    .comidas.sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))
    .slice(0, 300)
    .filter((c) => {
      const clave = `${c.name.toLowerCase()}|${c.grams ?? c.kcal}`
      if (vistas.has(clave)) return false
      vistas.add(clave)
      return true
    })
}

export async function anadirComida(c: NuevaComida) {
  await cambiar((d) => {
    d.comidas.push({ ...c, id: nuevoId(), eaten_at: new Date().toISOString() })
  })
}

export async function actualizarComida(id: string, cambios: Partial<NuevaComida>) {
  await cambiar((d) => {
    d.comidas = d.comidas.map((c) => (c.id === id ? { ...c, ...cambios } : c))
  })
}

export async function restaurarComida(c: Comida) {
  await cambiar((d) => {
    d.comidas.push(c)
  })
}

export async function borrarComida(id: string) {
  await cambiar((d) => {
    d.comidas = d.comidas.filter((c) => c.id !== id)
  })
}

export async function cargarAlimentos(): Promise<Alimento[]> {
  return leer().alimentos.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function guardarAlimento(a: Omit<Alimento, 'id'> & { id?: string }): Promise<Alimento> {
  const listo: Alimento = { ...a, id: a.id ?? nuevoId() }
  await cambiar((d) => {
    if (a.barcode && d.alimentos.some((x) => x.barcode === a.barcode && x.id !== listo.id))
      throw new Error('Ya tienes otro alimento con ese código de barras.')
    d.alimentos = [...d.alimentos.filter((x) => x.id !== listo.id), listo]
  })
  return listo
}

export async function borrarAlimento(id: string) {
  await cambiar((d) => {
    if (d.platos.some((p) => p.items.some((i) => i.food_id === id)))
      throw new Error('Este alimento está en algún plato. Quítalo del plato antes de borrarlo.')
    d.alimentos = d.alimentos.filter((a) => a.id !== id)
    d.comidas = d.comidas.map((c) => (c.food_id === id ? { ...c, food_id: null } : c))
  })
}

export async function contarComidasDeAlimento(id: string): Promise<number> {
  return leer().comidas.filter((c) => c.food_id === id).length
}

export async function corregirComidasDeAlimento(id: string): Promise<number> {
  let n = 0
  await cambiar((d) => {
    const a = d.alimentos.find((x) => x.id === id)
    if (!a) return
    d.comidas = d.comidas.map((c) => {
      if (c.food_id !== id || c.grams == null) return c
      n++
      const { kcal_100g, protein_100g, carbs_100g, fat_100g } = a
      return { ...c, ...racion(a, c.grams), kcal_100g, protein_100g, carbs_100g, fat_100g }
    })
  })
  return n
}

export async function cargarPesos(): Promise<Peso[]> {
  return leer().pesos.sort((a, b) => a.measured_on.localeCompare(b.measured_on))
}

export async function guardarPeso(dia: string, kg: number) {
  await cambiar((d) => {
    d.pesos = [...d.pesos.filter((p) => p.measured_on !== dia), { id: nuevoId(), measured_on: dia, weight_kg: kg }]
  })
}

export async function borrarPeso(id: string) {
  await cambiar((d) => {
    d.pesos = d.pesos.filter((p) => p.id !== id)
  })
}

export async function cargarMedidas(): Promise<Medida[]> {
  return leer().medidas.sort((a, b) => b.measured_on.localeCompare(a.measured_on))
}

export async function guardarMedida(m: Omit<Medida, 'id'>) {
  await cambiar((d) => {
    d.medidas = [...d.medidas.filter((x) => x.measured_on !== m.measured_on), { ...m, id: nuevoId() }]
  })
}

export async function borrarMedida(id: string) {
  await cambiar((d) => {
    d.medidas = d.medidas.filter((m) => m.id !== id)
  })
}

export async function cargarPlatos(): Promise<Plato[]> {
  const d = leer()
  return d.platos
    .map((p) => ({
      id: p.id,
      name: p.name,
      items: p.items.flatMap((i) => {
        const food = d.alimentos.find((a) => a.id === i.food_id)
        return food ? [{ food, grams: i.grams }] : []
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function guardarPlato(p: { id?: string; name: string; items: { food_id: string; grams: number }[] }) {
  await cambiar((d) => {
    const id = p.id ?? nuevoId()
    d.platos = [...d.platos.filter((x) => x.id !== id), { id, name: p.name, items: p.items }]
  })
}

export async function borrarPlato(id: string) {
  await cambiar((d) => {
    d.platos = d.platos.filter((p) => p.id !== id)
    d.comidas = d.comidas.map((c) => (c.dish_id === id ? { ...c, dish_id: null } : c))
  })
}
