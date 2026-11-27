import { useEffect, useState } from 'react'
import { borrarComida, restaurarComida } from '../lib/datos'
import { CATEGORIAS, type Categoria, type Comida } from '../lib/tipos'
import { gramos, kcal } from '../lib/formato'
import { Deslizable } from './Deslizable'
import { EditarComida } from './EditarComida'
import { Icono } from './Icono'

/** Comidas de un día agrupadas por momento, con botón para añadir a cada uno. */
export function ListaDia({
  comidas,
  onAnadir,
  onCambio,
}: {
  comidas: Comida[]
  onAnadir: (c: Categoria) => void
  onCambio: () => void
}) {
  const [editando, setEditando] = useState<Comida | null>(null)
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())
  const [borrada, setBorrada] = useState<Comida | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Cuando llegan los datos nuevos ya no hace falta ocultar nada a mano
  useEffect(() => setOcultas(new Set()), [comidas])

  // El aviso de «Deshacer» desaparece solo
  useEffect(() => {
    if (!borrada) return
    const t = setTimeout(() => setBorrada(null), 6000)
    return () => clearTimeout(t)
  }, [borrada])

  async function borrar(c: Comida) {
    setError(null)
    setOcultas((s) => new Set(s).add(c.id))
    try {
      await borrarComida(c.id)
      setBorrada(c)
      onCambio()
    } catch (e) {
      setOcultas((s) => {
        const n = new Set(s)
        n.delete(c.id)
        return n
      })
      setError((e as Error).message)
    }
  }

  async function deshacer() {
    if (!borrada) return
    const c = borrada
    setBorrada(null)
    try {
      await restaurarComida(c)
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const visibles = comidas.filter((c) => !ocultas.has(c.id))
  const grupos = CATEGORIAS.map((cat) => ({ cat, filas: visibles.filter((c) => c.category === cat) }))
  const conComidas = grupos.filter((g) => g.filas.length > 0)
  const vacias = grupos.filter((g) => g.filas.length === 0 && g.cat !== 'Extra')

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {conComidas.length === 0 && <p className="vacio">Todavía no has apuntado nada este día.</p>}

      {conComidas.map(({ cat, filas }) => (
        <section key={cat} className="tarjeta grupo" aria-labelledby={`g-${cat}`}>
          <header className="grupo-cabecera">
            <h3 id={`g-${cat}`}>{cat}</h3>
            <span>{kcal(filas.reduce((s, c) => s + c.kcal, 0))} kcal</span>
          </header>
          <ul className="filas">
            {filas.map((c) => (
              <li key={c.id}>
                <Deslizable etiqueta={c.name} onEditar={() => setEditando(c)} onBorrar={() => borrar(c)}>
                  <span className="fila-texto">
                    <span className="fila-nombre">{c.name}</span>
                    <span className="fila-detalle">
                      {c.grams != null && `${gramos(c.grams)} g · `}
                      {gramos(c.protein)} g proteína
                    </span>
                  </span>
                  <span className="fila-kcal">{kcal(c.kcal)}</span>
                </Deslizable>
              </li>
            ))}
          </ul>
          <button type="button" className="grupo-anadir" onClick={() => onAnadir(cat)}>
            <Icono nombre="mas" tamano={18} /> Añadir a {cat.toLowerCase()}
          </button>
        </section>
      ))}

      {vacias.length > 0 && (
        <div className="huecos" aria-label="Momentos sin apuntar">
          {vacias.map(({ cat }) => (
            <button key={cat} type="button" className="hueco" onClick={() => onAnadir(cat)}>
              <Icono nombre="mas" tamano={16} /> {cat}
            </button>
          ))}
        </div>
      )}

      <div className="aviso-zona" aria-live="polite">
        {borrada && (
          <div className="aviso">
            <span>Has borrado «{borrada.name}»</span>
            <button type="button" onClick={deshacer}>
              Deshacer
            </button>
          </div>
        )}
      </div>

      {editando && (
        <EditarComida
          comida={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            onCambio()
          }}
        />
      )}
    </>
  )
}
