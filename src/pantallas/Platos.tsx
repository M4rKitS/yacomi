import { useMemo, useState, type FormEvent } from 'react'
import { borrarPlato, cargarAlimentos, cargarPlatos, guardarPlato, totalesPlato } from '../lib/datos'
import { gramos, kcal, leerNumero } from '../lib/formato'
import type { Alimento, Plato } from '../lib/tipos'
import { useCarga } from '../lib/useCarga'
import { Deslizable } from '../componentes/Deslizable'
import { Hoja } from '../componentes/Hoja'
import { Icono } from '../componentes/Icono'

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function Platos({ version, onCambio }: { version: number; onCambio: () => void }) {
  const { datos, error } = useCarga(() => Promise.all([cargarPlatos(), cargarAlimentos()]), [version])
  const [editando, setEditando] = useState<Plato | 'nuevo' | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  async function borrar(p: Plato) {
    if (!window.confirm(`¿Borrar el plato «${p.name}»? Las comidas que ya apuntaste se quedan como están.`)) return
    try {
      await borrarPlato(p.id)
      onCambio()
    } catch (e) {
      setFallo((e as Error).message)
    }
  }

  return (
    <>
      <div className="titulo-con-accion">
        <p className="fecha">{datos ? `${datos[0].length} ${datos[0].length === 1 ? 'plato' : 'platos'} · totales por plato` : ' '}</p>
        <button type="button" className="boton-principal" onClick={() => setEditando('nuevo')}>
          <Icono nombre="mas" tamano={18} /> Nuevo
        </button>
      </div>
      {(error || fallo) && <p className="error" role="alert">{error ?? fallo}</p>}
      {!datos && !error && <p className="cargando">Cargando…</p>}
      {datos && datos[0].length === 0 && (
        <p className="vacio">
          Aún no tienes platos. Crea uno con sus ingredientes (por ejemplo, tu desayuno de siempre) y luego añádelo de un
          toque desde el botón +.
        </p>
      )}
      {datos && datos[0].length > 0 && (
        <ul className="filas tarjeta">
          {datos[0].map((p) => {
            const t = totalesPlato(p)
            return (
              <li key={p.id}>
                <Deslizable etiqueta={p.name} onEditar={() => setEditando(p)} onBorrar={() => borrar(p)}>
                  <span className="fila-texto">
                    <span className="fila-nombre">{p.name}</span>
                    <span className="fila-detalle">
                      {p.items.length} {p.items.length === 1 ? 'ingrediente' : 'ingredientes'} · {gramos(t.grams)} g ·{' '}
                      {gramos(Math.round(t.protein))} g proteína
                    </span>
                  </span>
                  <span className="fila-kcal">{kcal(t.kcal)}</span>
                </Deslizable>
              </li>
            )
          })}
        </ul>
      )}

      {editando && datos && (
        <EditarPlato
          plato={editando === 'nuevo' ? null : editando}
          alimentos={datos[1]}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            onCambio()
          }}
        />
      )}
    </>
  )
}

function EditarPlato({
  plato,
  alimentos,
  onCerrar,
  onGuardado,
}: {
  plato: Plato | null
  alimentos: Alimento[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(plato?.name ?? '')
  const [items, setItems] = useState(() => plato?.items.map((i) => ({ food: i.food, texto: String(i.grams).replace('.', ',') })) ?? [])
  const [buscando, setBuscando] = useState(!plato)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const leidos = items.map((i) => ({ food: i.food, grams: leerNumero(i.texto) ?? 0 }))
  const t = totalesPlato({ id: '', name: '', items: leidos.filter((i) => i.grams > 0) })

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    const usados = new Set(items.map((i) => i.food.id))
    return alimentos.filter((a) => !usados.has(a.id) && (!q || normalizar(a.name).includes(q))).slice(0, 30)
  }, [alimentos, busqueda, items])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Ponle un nombre al plato.')
    const validos = leidos.filter((i) => i.grams > 0)
    if (validos.length === 0) return setError('Añade al menos un ingrediente con sus gramos.')
    setGuardando(true)
    setError(null)
    try {
      await guardarPlato({
        id: plato?.id,
        name: nombre.trim(),
        items: validos.map((i) => ({ food_id: i.food.id, grams: i.grams })),
      })
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={plato ? 'Editar plato' : 'Nuevo plato'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <label className="campo">
          <span>Nombre del plato</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!plato} />
        </label>

        <div className="totales-plato" aria-live="polite">
          <span>
            <strong>{kcal(t.kcal)}</strong> kcal
          </span>
          <span>
            <strong>{gramos(Math.round(t.protein))}</strong> g proteína
          </span>
          <span>
            <strong>{gramos(t.grams)}</strong> g en total
          </span>
        </div>

        {items.length > 0 && (
          <ul className="ingredientes">
            {items.map((i, n) => (
              <li key={i.food.id} className="ingrediente">
                <span className="fila-texto">
                  <span className="fila-nombre">{i.food.name}</span>
                  <span className="fila-detalle">
                    {kcal(Math.round(((leerNumero(i.texto) ?? 0) * i.food.kcal_100g) / 100))} kcal
                  </span>
                </span>
                <label className="gramos-ingrediente">
                  <input
                    inputMode="decimal"
                    value={i.texto}
                    aria-label={`Gramos de ${i.food.name}`}
                    onChange={(e) => setItems(items.map((x, m) => (m === n ? { ...x, texto: e.target.value } : x)))}
                  />
                  <span>g</span>
                </label>
                <button
                  type="button"
                  className="boton-icono"
                  aria-label={`Quitar ${i.food.name}`}
                  onClick={() => setItems(items.filter((_, m) => m !== n))}
                >
                  <Icono nombre="cerrar" tamano={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscando ? (
          <div className="buscar-ingrediente">
            <label className="buscador">
              <Icono nombre="buscar" tamano={18} />
              <input
                type="search"
                placeholder="Buscar ingrediente"
                aria-label="Buscar ingrediente"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <ul className="filas">
              {resultados.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="fila"
                    onClick={() => {
                      setItems([...items, { food: a, texto: '100' }])
                      setBusqueda('')
                      setBuscando(false)
                    }}
                  >
                    <span className="fila-texto">
                      <span className="fila-nombre">{a.name}</span>
                      <span className="fila-detalle">{kcal(a.kcal_100g)} kcal / 100 g</span>
                    </span>
                    <Icono nombre="mas" tamano={20} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button type="button" className="hueco" onClick={() => setBuscando(true)}>
            <Icono nombre="mas" tamano={16} /> Añadir ingrediente
          </button>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="boton-principal ancho" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar plato'}
        </button>
      </form>
    </Hoja>
  )
}
