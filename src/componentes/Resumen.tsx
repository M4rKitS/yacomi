import { gramos, kcal } from '../lib/formato'
import type { Comida, Objetivos } from '../lib/tipos'

/** Bloque de calorías del día y tarjetas de macros. */
export function Resumen({ comidas, objetivos }: { comidas: Comida[]; objetivos: Objetivos }) {
  const total = comidas.reduce((s, c) => s + c.kcal, 0)
  const prote = comidas.reduce((s, c) => s + c.protein, 0)
  const conCarbos = comidas.some((c) => c.carbs != null)
  const conGrasas = comidas.some((c) => c.fat != null)
  const carbos = comidas.reduce((s, c) => s + (c.carbs ?? 0), 0)
  const grasas = comidas.reduce((s, c) => s + (c.fat ?? 0), 0)
  const { kcal_min: min, kcal_max: max } = objetivos

  let estado: { etiqueta: string; valor: string }
  if (total < min) estado = { etiqueta: 'Te faltan', valor: kcal(min - total) }
  else if (total <= max) estado = { etiqueta: 'En tu rango', valor: `${kcal(max - total)} de margen` }
  else estado = { etiqueta: 'Te has pasado', valor: kcal(total - max) }

  const escala = max * 1.1
  const pct = (n: number) => `${Math.min(100, (n / escala) * 100)}%`

  return (
    <>
      <section className="bloque-kcal" aria-label="Calorías del día">
        <div className="bloque-kcal-arriba">
          <div>
            <p className="bloque-etiqueta">Llevas</p>
            <p className="bloque-cifra">{kcal(total)}</p>
            <p className="bloque-etiqueta">
              kcal de {kcal(min)}–{kcal(max)}
            </p>
          </div>
          <div className="bloque-estado">
            <p className="bloque-etiqueta">{estado.etiqueta}</p>
            <p className="bloque-estado-valor">{estado.valor}</p>
          </div>
        </div>
        <div
          className="barra-kcal"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={total}
          aria-label={`${kcal(total)} de ${kcal(max)} kcal`}
        >
          <span className="barra-rango" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />
          <span className={`barra-relleno${total > max ? ' pasado' : ''}`} style={{ width: pct(total) }} />
        </div>
      </section>

      <section className="macros" aria-label="Macronutrientes">
        <Macro nombre="Proteína" valor={prote} objetivo={objetivos.protein_g} />
        <Macro nombre="Carbos" valor={conCarbos ? carbos : null} objetivo={objetivos.carbs_g} />
        <Macro nombre="Grasas" valor={conGrasas ? grasas : null} objetivo={objetivos.fat_g} />
      </section>
    </>
  )
}

function Macro({ nombre, valor, objetivo }: { nombre: string; valor: number | null; objetivo: number | null }) {
  const pct = valor != null && objetivo ? Math.min(100, (valor / objetivo) * 100) : 0
  return (
    <div className="tarjeta macro">
      <p className="macro-nombre">{nombre}</p>
      <p className="macro-valor">
        {valor == null ? '—' : gramos(Math.round(valor))}
        {objetivo ? <span> / {gramos(objetivo)} g</span> : valor != null && <span> g</span>}
      </p>
      {objetivo ? (
        <div className="barra-macro" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <p className="macro-nota">{valor == null ? 'sin datos' : 'sin objetivo'}</p>
      )}
    </div>
  )
}
