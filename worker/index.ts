import { leerFichaS } from './skaupat'

interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  HEVY_API_KEY?: string
}

type Alimento = { nombre: string; gramos: number; kcal: number; proteina: number; carbohidratos: number; grasas: number }

const num = { type: 'NUMBER' }
const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    alimentos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { nombre: { type: 'STRING' }, gramos: num, kcal: num, proteina: num, carbohidratos: num, grasas: num },
        required: ['nombre', 'gramos', 'kcal', 'proteina', 'carbohidratos', 'grasas'],
      },
    },
    nota: { type: 'STRING' },
  },
  required: ['alimentos', 'nota'],
}

/** Comprueba la respuesta en vez de fiarse de ella. */
function validar(x: unknown): { alimentos: Alimento[]; nota: string } | null {
  const o = x as { alimentos?: unknown; nota?: unknown }
  if (!o || !Array.isArray(o.alimentos)) return null
  const alimentos: Alimento[] = []
  for (const a of o.alimentos as Record<string, unknown>[]) {
    const n = (k: string) => (typeof a?.[k] === 'number' && Number.isFinite(a[k]) && (a[k] as number) >= 0 ? (a[k] as number) : null)
    const v = { gramos: n('gramos'), kcal: n('kcal'), proteina: n('proteina'), carbohidratos: n('carbohidratos'), grasas: n('grasas') }
    if (typeof a?.nombre !== 'string' || Object.values(v).some((y) => y == null)) continue
    alimentos.push({ nombre: a.nombre.slice(0, 80), ...(v as Omit<Alimento, 'nombre'>) })
  }
  return { alimentos, nota: typeof o.nota === 'string' ? o.nota.slice(0, 300) : '' }
}

const SISTEMA = `Eres un nutricionista que estima lo que alguien ha comido a partir de una descripción breve en castellano (a veces con una foto).
Separa la comida en sus alimentos o ingredientes principales. Para cada uno da los gramos que probablemente se ha comido y sus kcal, proteína, carbohidratos y grasas en gramos para esa cantidad (no por 100 g).
Si la descripción da cantidades, respétalas. Si no, usa raciones normales de España. Usa valores de tablas de composición habituales (BEDCA, USDA).
Nombres cortos y en castellano, como en una etiqueta: «Arroz blanco cocido», «Pechuga de pollo a la plancha».
En «nota» escribe una frase corta con la suposición más importante que has hecho (por ejemplo, el tamaño de la ración o el aceite), o deja la nota vacía si no hay ninguna.`

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

/** Solo deja pasar a quien tenga una sesión válida de Supabase (las altas están cerradas: solo tú). */
async function usuario(req: Request, env: Env): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  const u = (await r.json()) as { id?: string }
  return u.id ?? null
}

type Foto = { tipo: string; datos: string }

const parteFoto = (f?: Foto | null) =>
  f && typeof f.datos === 'string' && ['image/jpeg', 'image/png', 'image/webp'].includes(f.tipo) && f.datos.length < 7_000_000
    ? { inline_data: { mime_type: f.tipo, data: f.datos } }
    : null

/** Pide a Gemini una respuesta con el esquema dado. Devuelve el objeto ya leído o la respuesta de error. */
async function gemini(env: Env, sistema: string, partes: unknown[], esquema: unknown): Promise<{ ok: unknown } | { error: Response }> {
  if (!env.GEMINI_API_KEY) return { error: json({ error: 'Falta la clave de la IA en el servidor.' }, 503) }
  const cuerpo = JSON.stringify({
    system_instruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: partes }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, temperature: 0.2 },
  })

  // Si un modelo no existe o está saturado, prueba con el siguiente
  const modelos = [env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-4-hydrogen'].filter(Boolean) as string[]
  let r: Response | null = null
  for (const m of modelos) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: cuerpo,
    })
    if (r.ok || ![404, 429, 500, 503].includes(r.status)) break
    console.log('gemini', m, r.status, await r.clone().text())
  }
  if (!r || !r.ok) {
    const s = r?.status ?? 0
    console.log('gemini', s, await r?.text())
    if (s === 429) return { error: json({ error: 'Has llegado al límite gratuito de la IA por ahora. Prueba en un rato.' }, 429) }
    if (s === 402)
      return { error: json({ error: 'El proyecto de Google de la clave no tiene saldo. Usa una clave de un proyecto sin facturación.' }, 503) }
    if (s === 400 || s === 401 || s === 403) return { error: json({ error: 'La clave de la IA no es válida o no tiene permiso.' }, 503) }
    return { error: json({ error: `La IA ha fallado (${s}). Prueba otra vez.` }, 502) }
  }
  const datos = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const salida = datos.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  try {
    return { ok: JSON.parse(salida) }
  } catch {
    return { error: json({ error: 'La IA no ha devuelto una respuesta válida. Prueba otra vez.' }, 502) }
  }
}

async function estimar(req: Request, env: Env): Promise<Response> {
  const { texto, imagen } = (await req.json()) as { texto?: string; imagen?: Foto }
  const descripcion = (texto ?? '').trim().slice(0, 1500)
  if (!descripcion && !imagen) return json({ error: 'Describe lo que has comido.' }, 400)
  const foto = parteFoto(imagen)
  const partes = [...(foto ? [foto] : []), { text: descripcion || 'Estima lo que hay en la foto.' }]
  const r = await gemini(env, SISTEMA, partes, ESQUEMA)
  if ('error' in r) return r.error
  const estimacion = validar(r.ok)
  if (!estimacion) return json({ error: 'La IA no ha devuelto una estimación válida. Prueba otra vez.' }, 502)
  return json(estimacion)
}

const SISTEMA_ETIQUETA = `Lees la tabla de información nutricional de un alimento a partir de una foto del envase o de una captura de pantalla de una app o web. Puede estar en cualquier idioma.
Devuelve los valores por 100 g (o por 100 ml). Si la etiqueta solo los da por ración y dice cuánto pesa la ración, conviértelos a 100 g.
«kcal» son kilocalorías: si solo hay kilojulios, divide entre 4,184. «carbohidratos» son los hidratos de carbono totales y «grasas» las grasas totales.
Copia lo que pone: no estimes ni inventes. Si un dato no se ve o no se lee bien, devuelve null en ese campo.
«nombre» es el nombre del producto con su marca si se ve en la foto; si no, cadena vacía.`

const numONulo = { type: 'NUMBER', nullable: true }
const ESQUEMA_ETIQUETA = {
  type: 'OBJECT',
  properties: { nombre: { type: 'STRING' }, kcal: numONulo, proteina: numONulo, carbohidratos: numONulo, grasas: numONulo },
  required: ['nombre', 'kcal', 'proteina', 'carbohidratos', 'grasas'],
}

async function etiqueta(req: Request, env: Env): Promise<Response> {
  const { imagen } = (await req.json()) as { imagen?: Foto }
  const foto = parteFoto(imagen)
  if (!foto) return json({ error: 'No se ha podido leer la foto.' }, 400)
  const r = await gemini(env, SISTEMA_ETIQUETA, [foto, { text: 'Lee la tabla nutricional.' }], ESQUEMA_ETIQUETA)
  if ('error' in r) return r.error
  const o = (r.ok ?? {}) as Record<string, unknown>
  const n = (k: string, max: number) =>
    typeof o[k] === 'number' && Number.isFinite(o[k]) && (o[k] as number) >= 0 && (o[k] as number) <= max ? Math.round((o[k] as number) * 10) / 10 : null
  const p = {
    nombre: typeof o.nombre === 'string' ? o.nombre.slice(0, 80) : '',
    kcal_100g: n('kcal', 910),
    protein_100g: n('proteina', 100),
    carbs_100g: n('carbohidratos', 100),
    fat_100g: n('grasas', 100),
  }
  if (p.kcal_100g == null && p.protein_100g == null)
    return json({ error: 'No veo la tabla nutricional. Haz la foto más cerca y con buena luz.' }, 422)
  return json(p)
}

/** Lee la ficha pública de un producto en S-kaupat (Finlandia), que lleva los datos del fabricante. */
async function productoFinlandia(codigo: string): Promise<Response> {
  if (!/^\d{8,14}$/.test(codigo)) return json({ error: 'Código no válido.' }, 400)
  let r: Response
  try {
    r = await fetch(`https://www.s-kaupat.fi/tuote/x/${codigo}`, {
      headers: { accept: 'text/html', 'user-agent': 'product-lookup/1.0' },
      signal: AbortSignal.timeout(6000),
    })
  } catch {
    return json({ error: 'S-kaupat no responde.' }, 502)
  }
  if (r.status === 404) return json({ producto: null })
  if (!r.ok) return json({ error: `S-kaupat no responde (${r.status}).` }, 502)
  return json({ producto: leerFichaS(await r.text(), codigo) })
}

/** Solo lectura: reenvía GET /api/hevy/<ruta> a la API de Hevy con la clave guardada en el servidor. */
async function hevy(req: Request, env: Env, ruta: string): Promise<Response> {
  if (!env.HEVY_API_KEY) return json({ error: 'Falta la clave de Hevy en el servidor.' }, 503)
  if (req.method !== 'GET') return json({ error: 'Solo lectura.' }, 405)
  if (!/^[a-z0-9_\-/]+$/i.test(ruta)) return json({ error: 'Ruta no válida.' }, 400)
  const url = new URL(`https://api.hevyapp.com/v1/${ruta}`)
  url.search = new URL(req.url).search
  const r = await fetch(url, { headers: { 'api-key': env.HEVY_API_KEY, accept: 'application/json' } })
  return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)

    if (!(await usuario(req, env))) return json({ error: 'Inicia sesión.' }, 401)
    if (url.pathname === '/api/ia' && req.method === 'POST') return estimar(req, env)
    if (url.pathname === '/api/etiqueta' && req.method === 'POST') return etiqueta(req, env)
    if (url.pathname.startsWith('/api/producto/')) return productoFinlandia(url.pathname.slice('/api/producto/'.length))
    if (url.pathname.startsWith('/api/hevy/')) return hevy(req, env, url.pathname.slice('/api/hevy/'.length))
    return json({ error: 'No existe.' }, 404)
  },
} satisfies ExportedHandler<Env>
