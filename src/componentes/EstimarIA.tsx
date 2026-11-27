import { useState, type FormEvent } from 'react'
import { gramos, kcal, leerNumero } from '../lib/formato'
import { estimarConIA, prepararFoto, type AlimentoEstimado } from '../lib/ia'
import type { NuevaComida } from '../lib/tipos'
import { Icono } from './Icono'

type Fila = AlimentoEstimado & { texto: string; incluido: boolean }
type Sin = Omit<NuevaComida, 'eaten_on' | 'category'>

const r1 = (n: number) => Math.round(n * 10) / 10

/** Describe (o fotografía) lo que has comido; la IA lo separa en alimentos que puedes ajustar antes de guardar. */
export function EstimarIA({ guardando, onGuardar }: { guardando: boolean; onGuardar: (cs: Sin[]) => void }) {
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<{ tipo: string; datos: string; url: string } | null>(null)
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [nota, setNota] = useState('')

  async function estimar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim() && !foto) return
    setPensando(true)
    setError(null)
    try {
      const r = await estimarConIA(texto, foto && { tipo: foto.tipo, datos: foto.datos })
      if (r.alimentos.length === 0) throw new Error('No he sabido separar esa comida. Descríbela con algo más de detalle.')
      setFilas(r.alimentos.map((a) => ({ ...a, texto: String(Math.round(a.gramos)), incluido: true })))
      setNota(r.nota)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPensando(false)
    }
  }

  // Si cambias los gramos, los valores se escalan en proporción a la estimación
  const ajustadas = (filas ?? []).map((f) => {
    const g = leerNumero(f.texto)
    const k = g && f.gramos ? g / f.gramos : 1
    return { ...f, g: g ?? f.gramos, kcal: f.kcal * k, proteina: f.proteina * k, carbohidratos: f.carbohidratos * k, grasas: f.grasas * k }
  })
  const elegidas = ajustadas.filter((f) => f.incluido)
  const total = elegidas.reduce((s, f) => ({ kcal: s.kcal + f.kcal, p: s.p + f.proteina }), { kcal: 0, p: 0 })

  function guardar() {
    onGuardar(
      elegidas.map((f) => {
        const por100 = (v: number) => (f.g ? r1((v / f.g) * 100) : null)
        return {
          name: f.nombre,
          grams: r1(f.g),
          kcal: Math.round(f.kcal),
          protein: r1(f.proteina),
          carbs: r1(f.carbohidratos),
          fat: r1(f.grasas),
          kcal_100g: por100(f.kcal),
          protein_100g: por100(f.proteina),
          carbs_100g: por100(f.carbohidratos),
          fat_100g: por100(f.grasas),
          food_id: null,
          source: 'ia',
        }
      }),
    )
  }

  if (filas) {
    return (
      <div className="formulario">
        <button type="button" className="enlace-atras" onClick={() => setFilas(null)}>
          <Icono nombre="atras" tamano={18} /> Cambiar la descripción
        </button>
        {nota && <p className="aviso-suave">{nota}</p>}
        <ul className="ingredientes">
          {ajustadas.map((f, n) => (
            <li key={n} className={`ingrediente${f.incluido ? '' : ' descartado'}`}>
              <input
                type="checkbox"
                checked={f.incluido}
                aria-label={`Incluir ${f.nombre}`}
                onChange={() => setFilas(filas.map((x, m) => (m === n ? { ...x, incluido: !x.incluido } : x)))}
              />
              <span className="fila-texto">
                <span className="fila-nombre">{f.nombre}</span>
                <span className="fila-detalle">
                  {kcal(Math.round(f.kcal))} kcal · {gramos(Math.round(f.proteina))} g prot.
                </span>
              </span>
              <label className="gramos-ingrediente">
                <input
                  inputMode="decimal"
                  value={f.texto}
                  aria-label={`Gramos de ${f.nombre}`}
                  onChange={(e) => setFilas(filas.map((x, m) => (m === n ? { ...x, texto: e.target.value } : x)))}
                />
                <span>g</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="resumen-racion" aria-live="polite">
          {kcal(Math.round(total.kcal))} kcal · {gramos(Math.round(total.p))} g proteína
        </p>
        <p className="fila-detalle">Es una estimación: revisa los gramos. Cada alimento se apunta por separado.</p>
        <button type="button" className="boton-principal ancho" disabled={elegidas.length === 0 || guardando} onClick={guardar}>
          {guardando ? 'Añadiendo…' : `Añadir ${elegidas.length === 1 ? '1 alimento' : `${elegidas.length} alimentos`}`}
        </button>
      </div>
    )
  }

  return (
    <form className="formulario" onSubmit={estimar}>
      <label className="campo">
        <span>Qué has comido</span>
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej. un plato de lentejas con chorizo, una barra de pan pequeña y una manzana"
          autoFocus
        />
      </label>
      <div className="foto-ia">
        {foto ? (
          <>
            <img src={foto.url} alt="Foto de la comida" />
            <button type="button" className="boton-secundario" onClick={() => setFoto(null)}>
              Quitar foto
            </button>
          </>
        ) : (
          <label className="boton-secundario">
            <Icono nombre="escaner" tamano={18} /> Añadir foto (opcional)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={async (e) => {
                const a = e.target.files?.[0]
                if (a) setFoto(await prepararFoto(a).catch(() => null))
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="boton-principal ancho" disabled={pensando || (!texto.trim() && !foto)}>
        <Icono nombre="chispa" tamano={18} /> {pensando ? 'Estimando…' : 'Estimar'}
      </button>
    </form>
  )
}
