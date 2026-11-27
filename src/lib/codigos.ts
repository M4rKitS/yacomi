import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import urlWasm from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { llamar } from './ia'
import { esInvitado } from './invitado'

// El lector se sirve desde la propia app, no desde un CDN
prepareZXingModule({
  overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith('.wasm') ? urlWasm : prefijo + ruta) },
})

export function crearLector() {
  return new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
}

export interface ProductoEncontrado {
  nombre: string
  kcal_100g: number | null
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
}

const redondear = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null)

/** Open Food Facts (mundial). Devuelve null si no lo conocen. */
async function enOpenFoodFacts(codigo: string): Promise<ProductoEncontrado | null> {
  const campos = 'product_name,product_name_es,product_name_fi,brands,nutriments'
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${campos}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error('Open Food Facts no responde.')
  const d = await r.json()
  if (d.status !== 1 || !d.product) return null
  const p = d.product
  const n = p.nutriments ?? {}
  const kcal = n['energy-kcal_100g'] ?? (typeof n.energy_100g === 'number' ? n.energy_100g / 4.184 : null)
  const nombre = [p.product_name_es || p.product_name || p.product_name_fi, p.brands?.split(',')[0]]
    .filter(Boolean)
    .join(' · ')
  return {
    nombre: nombre || `Producto ${codigo}`,
    kcal_100g: redondear(kcal),
    protein_100g: redondear(n.proteins_100g),
    carbs_100g: redondear(n.carbohydrates_100g),
    fat_100g: redondear(n.fat_100g),
  }
}

/** S-kaupat (Finlandia), a través del servidor propio. */
async function enFinlandia(codigo: string): Promise<ProductoEncontrado | null> {
  if (esInvitado()) return null
  return (await llamar<{ producto: ProductoEncontrado | null }>(`/api/producto/${codigo}`)).producto
}

export interface Busqueda {
  codigo: string
  producto: ProductoEncontrado | null
  fuente: string | null
  /** Alguna base de datos no ha contestado: quizá el producto sí exista */
  incompleta: boolean
}

/** Busca en todas las bases a la vez y se queda con la ficha más completa. */
export async function buscarProducto(candidatos: string[]): Promise<Busqueda> {
  let incompleta = false
  let parcial: Busqueda | null = null
  for (const codigo of candidatos) {
    const [fi, off] = await Promise.allSettled([enFinlandia(codigo), enOpenFoodFacts(codigo)])
    if (fi.status === 'rejected' || off.status === 'rejected') incompleta = true
    const fichas = [
      { fuente: 'S-kaupat', p: fi.status === 'fulfilled' ? fi.value : null },
      { fuente: 'Open Food Facts', p: off.status === 'fulfilled' ? off.value : null },
    ]
    const completa = fichas.find((f) => f.p?.kcal_100g != null && f.p.protein_100g != null)
    if (completa) return { codigo, producto: completa.p, fuente: completa.fuente, incompleta: false }
    const conAlgo = fichas.find((f) => f.p)
    if (conAlgo) parcial ??= { codigo, producto: conAlgo.p, fuente: conAlgo.fuente, incompleta }
  }
  return parcial ?? { codigo: candidatos[0], producto: null, fuente: null, incompleta }
}
