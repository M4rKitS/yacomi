import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { anadirComida, cargarAlimentos, cargarPlatos, cargarRecientes, racion, totalesPlato } from '../lib/datos'
import { fechaCorta, gramos, kcal, leerNumero } from '../lib/formato'
import { CATEGORIAS, type Alimento, type Categoria, type Comida, type NuevaComida, type Plato } from '../lib/tipos'
import { Escanear } from './Escanear'
import { esInvitado } from '../lib/invitado'
import { EstimarIA } from './EstimarIA'
import { Hoja } from './Hoja'
import { Icono, type NombreIcono } from './Icono'

type Modo = 'despensa' | 'platos' | 'repetir' | 'manual' | 'ia' | 'escaner'

const MODOS: { id: Modo; nombre: string; icono: NombreIcono; pronto?: boolean }[] = [
  { id: 'despensa', nombre: 'Despensa', icono: 'despensa' },
  { id: 'platos', nombre: 'Platos', icono: 'plato' },
  { id: 'repetir', nombre: 'Repetir', icono: 'repetir' },
  { id: 'manual', nombre: 'A mano', icono: 'lapiz' },
  { id: 'ia', nombre: 'Con IA', icono: 'chispa' },
  { id: 'escaner', nombre: 'Escanear', icono: 'escaner' },
]

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function Anadir({
  dia,
  categoriaInicial,
  onCerrar,
  onAnadida,
}: {
  dia: string
  categoriaInicial: Categoria
  onCerrar: () => void
  onAnadida: () => void
}) {
  const [modo, setModo] = useState<Modo>('despensa')
  const [categoria, setCategoria] = useState<Categoria>(categoriaInicial)
  const [alimentos, setAlimentos] = useState<Alimento[] | null>(null)
  const [recientes, setRecientes] = useState<Comida[] | null>(null)
  const [platos, setPlatos] = useState<Plato[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([cargarAlimentos(), cargarRecientes(), cargarPlatos()])
      .then(([a, r, p]) => {
        setAlimentos(a)
        setRecientes(r)
        setPlatos(p)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  async function guardar(c: Omit<NuevaComida, 'eaten_on' | 'category'> | Omit<NuevaComida, 'eaten_on' | 'category'>[]) {
    setGuardando(true)
    setError(null)
    try {
      for (const x of Array.isArray(c) ? c : [c]) await anadirComida({ ...x, eaten_on: dia, category: categoria })
      onAnadida()
    } catch (e) {
      setError((e as Error).message)
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={`Añadir · ${fechaCorta(dia)}`} onCerrar={onCerrar} alta>
      <fieldset className="chips">
        <legend>Momento</legend>
        {CATEGORIAS.map((c) => (
          <label key={c} className="chip">
            <input type="radio" name="momento" checked={categoria === c} onChange={() => setCategoria(c)} />
            {c}
          </label>
        ))}
      </fieldset>

      <div className="modos" role="tablist" aria-label="Cómo añadir">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            className="modo"
            aria-selected={modo === m.id}
            disabled={m.pronto}
            onClick={() => !m.pronto && setModo(m.id)}
          >
            <Icono nombre={m.icono} />
            <span>{m.nombre}</span>
            {m.pronto && <span className="pronto">pronto</span>}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div role="tabpanel" className="panel-modo">
        {modo === 'despensa' && (
          <DesdeDespensa alimentos={alimentos} recientes={recientes} guardando={guardando} onGuardar={guardar} />
        )}
        {modo === 'platos' && <DesdePlato platos={platos} guardando={guardando} onGuardar={guardar} />}
        {modo === 'repetir' && <Repetir recientes={recientes} guardando={guardando} onGuardar={guardar} />}
        {modo === 'escaner' && <Escanear alimentos={alimentos} guardando={guardando} onGuardar={guardar} />}
        {modo === 'ia' &&
          (esInvitado() ? (
            <p className="aviso-suave">
              Con cuenta, aquí describes o fotografías lo que has comido y la IA calcula las calorías. No está disponible en el modo
              invitado.
            </p>
          ) : (
            <EstimarIA guardando={guardando} onGuardar={guardar} />
          ))}
        {modo === 'manual' && <Manual guardando={guardando} onGuardar={guardar} />}
      </div>
    </Hoja>
  )
}

type Guardar = (c: Omit<NuevaComida, 'eaten_on' | 'category'>) => void

function DesdeDespensa({
  alimentos,
  recientes,
  guardando,
  onGuardar,
}: {
  alimentos: Alimento[] | null
  recientes: Comida[] | null
  guardando: boolean
  onGuardar: Guardar
}) {
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<Alimento | null>(null)
  const [g, setG] = useState('')

  // Los alimentos usados hace poco salen primero, con los gramos de la última vez
  const uso = useMemo(() => {
    const m = new Map<string, { orden: number; gramos: number | null }>()
    recientes?.forEach((c, i) => c.food_id && !m.has(c.food_id) && m.set(c.food_id, { orden: i, gramos: c.grams }))
    return m
  }, [recientes])

  const lista = useMemo(() => {
    if (!alimentos) return []
    const q = normalizar(busqueda.trim())
    return alimentos
      .filter((a) => !q || normalizar(a.name).includes(q))
      .sort((a, b) => (uso.get(a.id)?.orden ?? 1e6) - (uso.get(b.id)?.orden ?? 1e6))
  }, [alimentos, busqueda, uso])

  if (!alimentos) return <p className="cargando">Cargando tu despensa…</p>

  if (elegido) {
    const n = leerNumero(g)
    const r = n ? racion(elegido, n) : null
    const enviar = (e: FormEvent) => {
      e.preventDefault()
      if (!n || !r) return
      onGuardar({
        name: elegido.name,
        grams: n,
        ...r,
        kcal_100g: elegido.kcal_100g,
        protein_100g: elegido.protein_100g,
        carbs_100g: elegido.carbs_100g,
        fat_100g: elegido.fat_100g,
        food_id: elegido.id,
        source: 'despensa',
      })
    }
    return (
      <form className="formulario" onSubmit={enviar}>
        <button type="button" className="enlace-atras" onClick={() => setElegido(null)}>
          <Icono nombre="atras" tamano={18} /> Otro alimento
        </button>
        <h3 className="titulo-eleccion">{elegido.name}</h3>
        <p className="fila-detalle">
          {kcal(elegido.kcal_100g)} kcal · {gramos(elegido.protein_100g)} g proteína por 100 g
        </p>
        <label className="campo">
          <span>Gramos</span>
          <input inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} autoFocus />
        </label>
        <p className="resumen-racion" aria-live="polite">
          {r ? `${kcal(r.kcal)} kcal · ${gramos(r.protein)} g proteína` : 'Escribe cuántos gramos'}
        </p>
        <button type="submit" className="boton-principal ancho" disabled={!r || guardando}>
          {guardando ? 'Añadiendo…' : 'Añadir'}
        </button>
      </form>
    )
  }

  return (
    <>
      <label className="buscador">
        <Icono nombre="buscar" tamano={18} />
        <input
          type="search"
          placeholder="Buscar en tu despensa"
          aria-label="Buscar en tu despensa"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>
      {lista.length === 0 && <p className="vacio">{busqueda ? `No hay nada con «${busqueda}». Pruébalo a mano.` : 'Tu despensa está vacía. Apúntalo a mano o escanéalo.'}</p>}
      <ul className="filas tarjeta">
        {lista.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className="fila"
              onClick={() => {
                setElegido(a)
                setG(String(uso.get(a.id)?.gramos ?? 100))
              }}
            >
              <span className="fila-texto">
                <span className="fila-nombre">{a.name}</span>
                <span className="fila-detalle">
                  {kcal(a.kcal_100g)} kcal · {gramos(a.protein_100g)} g prot. / 100 g
                </span>
              </span>
              <Icono nombre="mas" tamano={20} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function Repetir({ recientes, guardando, onGuardar }: { recientes: Comida[] | null; guardando: boolean; onGuardar: Guardar }) {
  if (!recientes) return <p className="cargando">Cargando…</p>
  return (
    <ul className="filas tarjeta">
      {recientes.slice(0, 40).map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className="fila"
            disabled={guardando}
            onClick={() =>
              onGuardar({
                name: c.name,
                grams: c.grams,
                kcal: c.kcal,
                protein: c.protein,
                carbs: c.carbs,
                fat: c.fat,
                kcal_100g: c.kcal_100g,
                protein_100g: c.protein_100g,
                carbs_100g: c.carbs_100g,
                fat_100g: c.fat_100g,
                food_id: c.food_id,
                source: 'repetir',
              })
            }
          >
            <span className="fila-texto">
              <span className="fila-nombre">{c.name}</span>
              <span className="fila-detalle">
                {c.grams != null && `${gramos(c.grams)} g · `}
                {fechaCorta(c.eaten_on)}
              </span>
            </span>
            <span className="fila-kcal">{kcal(c.kcal)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Manual({ guardando, onGuardar }: { guardando: boolean; onGuardar: Guardar }) {
  const [nombre, setNombre] = useState('')
  const [k, setK] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const nk = leerNumero(k)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || nk == null) return
    onGuardar({
      name: nombre.trim(),
      grams: null,
      kcal: Math.round(nk),
      protein: leerNumero(p) ?? 0,
      carbs: leerNumero(c),
      fat: leerNumero(f),
      kcal_100g: null,
      protein_100g: null,
      carbs_100g: null,
      fat_100g: null,
      food_id: null,
      source: 'manual',
    })
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <label className="campo">
        <span>Qué has comido</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </label>
      <div className="campos-fila">
        <label className="campo">
          <span>Calorías</span>
          <input inputMode="numeric" value={k} onChange={(e) => setK(e.target.value)} />
        </label>
        <label className="campo">
          <span>Proteína (g)</span>
          <input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
        </label>
      </div>
      <div className="campos-fila">
        <label className="campo">
          <span>Carbohidratos (g)</span>
          <input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder="Opcional" />
        </label>
        <label className="campo">
          <span>Grasas (g)</span>
          <input inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} placeholder="Opcional" />
        </label>
      </div>
      <button type="submit" className="boton-principal ancho" disabled={!nombre.trim() || nk == null || guardando}>
        {guardando ? 'Añadiendo…' : 'Añadir'}
      </button>
    </form>
  )
}

const PORCIONES = [
  { factor: 0.5, nombre: '½ plato' },
  { factor: 1, nombre: '1 plato' },
  { factor: 1.5, nombre: '1½' },
  { factor: 2, nombre: '2 platos' },
]

function DesdePlato({ platos, guardando, onGuardar }: { platos: Plato[] | null; guardando: boolean; onGuardar: Guardar }) {
  const [elegido, setElegido] = useState<Plato | null>(null)
  const [factor, setFactor] = useState(1)

  if (!platos) return <p className="cargando">Cargando tus platos…</p>
  if (platos.length === 0)
    return <p className="vacio">Aún no tienes platos. Créalos en Despensa → Platos con sus ingredientes.</p>

  if (elegido) {
    const t = totalesPlato(elegido)
    const por100 = (v: number | null) => (v == null || !t.grams ? null : Math.round((v / t.grams) * 10000) / 100)
    const r = {
      kcal: Math.round(t.kcal * factor),
      protein: Math.round(t.protein * factor * 100) / 100,
      carbs: t.carbs == null ? null : Math.round(t.carbs * factor * 100) / 100,
      fat: t.fat == null ? null : Math.round(t.fat * factor * 100) / 100,
    }
    return (
      <div className="formulario">
        <button type="button" className="enlace-atras" onClick={() => setElegido(null)}>
          <Icono nombre="atras" tamano={18} /> Otro plato
        </button>
        <h3 className="titulo-eleccion">{elegido.name}</h3>
        <p className="fila-detalle">{elegido.items.map((i) => `${i.food.name} ${gramos(i.grams)} g`).join(' · ')}</p>
        <fieldset className="chips">
          <legend>Cuánto</legend>
          {PORCIONES.map((p) => (
            <label key={p.factor} className="chip">
              <input type="radio" name="porcion" checked={factor === p.factor} onChange={() => setFactor(p.factor)} />
              {p.nombre}
            </label>
          ))}
        </fieldset>
        <p className="resumen-racion" aria-live="polite">
          {kcal(r.kcal)} kcal · {gramos(Math.round(r.protein))} g proteína · {gramos(Math.round(t.grams * factor))} g
        </p>
        <button
          type="button"
          className="boton-principal ancho"
          disabled={guardando}
          onClick={() =>
            onGuardar({
              name: factor === 1 ? elegido.name : `${elegido.name} (${PORCIONES.find((p) => p.factor === factor)?.nombre})`,
              grams: Math.round(t.grams * factor * 10) / 10,
              ...r,
              kcal_100g: por100(t.kcal),
              protein_100g: por100(t.protein),
              carbs_100g: por100(t.carbs),
              fat_100g: por100(t.fat),
              food_id: null,
              dish_id: elegido.id,
              source: 'plato',
            })
          }
        >
          {guardando ? 'Añadiendo…' : 'Añadir'}
        </button>
      </div>
    )
  }

  return (
    <ul className="filas tarjeta">
      {platos.map((p) => {
        const t = totalesPlato(p)
        return (
          <li key={p.id}>
            <button type="button" className="fila" onClick={() => { setElegido(p); setFactor(1) }}>
              <span className="fila-texto">
                <span className="fila-nombre">{p.name}</span>
                <span className="fila-detalle">
                  {p.items.length} ingredientes · {gramos(Math.round(t.protein))} g proteína
                </span>
              </span>
              <span className="fila-kcal">{kcal(t.kcal)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
