import { esInvitado } from './invitado'
import { supabase } from './supabase'

export type AlimentoEstimado = {
  nombre: string
  gramos: number
  kcal: number
  proteina: number
  carbohidratos: number
  grasas: number
}

export type Estimacion = { alimentos: AlimentoEstimado[]; nota: string }

/** Llama al servidor propio (que guarda la clave de la IA) con la sesión del usuario. */
async function llamar<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  if (esInvitado()) throw new Error('Esto no está disponible en el modo invitado.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Tu sesión ha caducado. Vuelve a entrar.')
  let r: Response
  try {
    r = await fetch(ruta, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('Sin conexión. Prueba otra vez.')
  }
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(cuerpo?.error ?? (r.status === 404 ? 'Esto solo funciona en la web publicada.' : `Error ${r.status}`))
  return cuerpo as T
}

export function estimarConIA(texto: string, imagen: { tipo: string; datos: string } | null) {
  return llamar<Estimacion>('/api/ia', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto, imagen }),
  })
}

export type Etiqueta = {
  nombre: string
  kcal_100g: number | null
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
}

/** Lee la tabla nutricional de una foto del envase. */
export function leerEtiqueta(imagen: { tipo: string; datos: string }) {
  return llamar<Etiqueta>('/api/etiqueta', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imagen: { tipo: imagen.tipo, datos: imagen.datos } }),
  })
}

/** Reduce la foto a 1024 px de lado como mucho (o lo que se pida) y la pasa a JPEG en base64. */
export async function prepararFoto(archivo: File, lado = 1024): Promise<{ tipo: string; datos: string; url: string }> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(bitmap.width * escala)
  lienzo.height = Math.round(bitmap.height * escala)
  lienzo.getContext('2d')!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height)
  const url = lienzo.toDataURL('image/jpeg', 0.82)
  return { tipo: 'image/jpeg', datos: url.split(',')[1], url }
}

export { llamar }
