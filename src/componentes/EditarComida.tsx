import { useState, type FormEvent } from 'react'
import { actualizarComida, borrarComida, racion } from '../lib/datos'
import { gramos, kcal, leerNumero } from '../lib/formato'
import { CATEGORIAS, type Categoria, type Comida } from '../lib/tipos'
import { Hoja } from './Hoja'

export function EditarComida({
  comida,
  onCerrar,
  onGuardada,
}: {
  comida: Comida
  onCerrar: () => void
  onGuardada: () => void
}) {
  const porPeso = comida.kcal_100g != null && comida.grams != null
  const [categoria, setCategoria] = useState<Categoria>(comida.category)
  const [g, setG] = useState(String(comida.grams ?? ''))
  const [k, setK] = useState(String(comida.kcal))
  const [p, setP] = useState(String(comida.protein))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nuevosGramos = leerNumero(g)
  const vista =
    porPeso && nuevosGramos
      ? racion(
          {
            kcal_100g: comida.kcal_100g!,
            protein_100g: comida.protein_100g ?? 0,
            carbs_100g: comida.carbs_100g,
            fat_100g: comida.fat_100g,
          },
          nuevosGramos,
        )
      : null

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    let cambios
    if (porPeso) {
      if (!vista || !nuevosGramos) return setError('Escribe los gramos.')
      cambios = { category: categoria, grams: nuevosGramos, ...vista }
    } else {
      const nk = leerNumero(k)
      if (nk == null) return setError('Escribe las calorías.')
      cambios = { category: categoria, kcal: Math.round(nk), protein: leerNumero(p) ?? 0 }
    }
    setGuardando(true)
    try {
      await actualizarComida(comida.id, cambios)
      onGuardada()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar «${comida.name}» de este día?`)) return
    setGuardando(true)
    try {
      await borrarComida(comida.id)
      onGuardada()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={comida.name} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <fieldset className="chips">
          <legend>Momento</legend>
          {CATEGORIAS.map((c) => (
            <label key={c} className="chip">
              <input type="radio" name="cat" checked={categoria === c} onChange={() => setCategoria(c)} />
              {c}
            </label>
          ))}
        </fieldset>

        {porPeso ? (
          <>
            <label className="campo">
              <span>Gramos</span>
              <input inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} autoFocus />
            </label>
            <p className="resumen-racion" aria-live="polite">
              {vista ? `${kcal(vista.kcal)} kcal · ${gramos(vista.protein)} g proteína` : '—'}
            </p>
          </>
        ) : (
          <div className="campos-fila">
            <label className="campo">
              <span>Calorías</span>
              <input inputMode="numeric" value={k} onChange={(e) => setK(e.target.value)} autoFocus />
            </label>
            <label className="campo">
              <span>Proteína (g)</span>
              <input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
            </label>
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="acciones">
          <button type="button" className="boton-peligro" onClick={borrar} disabled={guardando}>
            Borrar
          </button>
          <button type="submit" className="boton-principal" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Hoja>
  )
}
