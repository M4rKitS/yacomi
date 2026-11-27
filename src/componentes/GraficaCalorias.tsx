import { useEffect, useState, type KeyboardEvent } from 'react'
import { fechaCorta, hoyISO, kcal, sumarDias } from '../lib/formato'
import { useAncho } from '../lib/useAncho'
import type { Objetivos, ResumenDia } from '../lib/tipos'

const M = { arriba: 40, abajo: 28, lados: 8 }
const INICIAL = new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' })

type Periodo = 7 | 30

/** Barras redondeadas por día; la elegida se resalta con su cifra encima. */
export function GraficaCalorias({ resumen, objetivos }: { resumen: ResumenDia[]; objetivos: Objetivos }) {
  const [periodo, setPeriodo] = useState<Periodo>(7)
  const [marco, ANCHO] = useAncho<HTMLElement>(460)
  const ALTO = ANCHO < 500 ? 200 : 230
  const hoy = hoyISO()
  const porDia = new Map(resumen.map((r) => [r.eaten_on, r.kcal]))
  const dias = Array.from({ length: periodo }, (_, i) => sumarDias(hoy, i - periodo + 1))
  const valores = dias.map((d) => porDia.get(d) ?? 0)
  const [sel, setSel] = useState(periodo - 1)
  useEffect(() => setSel(periodo - 1), [periodo])

  const tope = Math.max(objetivos.kcal_max * 1.04, ...valores)
  const alto = ALTO - M.arriba - M.abajo
  const y = (k: number) => M.arriba + alto - (k / tope) * alto
  const hueco = (ANCHO - M.lados * 2) / periodo
  const anchoBarra = Math.min(36, hueco * 0.62)
  const cx = (i: number) => M.lados + hueco * i + hueco / 2

  const conDatos = valores.filter((v) => v > 0)
  const media = conDatos.length ? conDatos.reduce((s, v) => s + v, 0) / conDatos.length : 0
  const enRango = conDatos.filter((v) => v >= objetivos.kcal_min && v <= objetivos.kcal_max).length
  const etiqueta = valores[sel] ? `${kcal(valores[sel])} kcal` : 'sin datos'
  const anchoEtiqueta = etiqueta.length * 7.6 + 22
  const ex = Math.min(Math.max(cx(sel) - anchoEtiqueta / 2, 0), ANCHO - anchoEtiqueta)

  function alTeclado(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, s - 1))
    else if (e.key === 'ArrowRight') setSel((s) => Math.min(periodo - 1, s + 1))
    else return
    e.preventDefault()
  }

  return (
    <section className="tarjeta seccion">
      <div className="titulo-con-accion">
        <h2 className="subtitulo">Calorías</h2>
        <div className="segmentos" role="group" aria-label="Periodo">
          {([7, 30] as const).map((p) => (
            <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
              {p === 7 ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>
      <p className="fila-detalle">
        Media {kcal(media)} kcal · {enRango} de {conDatos.length} días en tu rango
      </p>

      <figure className="grafica-marco" ref={marco}>
        <svg
          className="grafica"
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          role="img"
          tabIndex={0}
          onKeyDown={alTeclado}
          aria-label={`Calorías de los últimos ${periodo} días, media ${kcal(media)} kcal. Usa las flechas para recorrer los días.`}
        >
          <rect
            x={0}
            width={ANCHO}
            y={y(objetivos.kcal_max)}
            height={y(objetivos.kcal_min) - y(objetivos.kcal_max)}
            className="grafica-banda"
          />
          {valores.map((v, i) => {
            const activo = i === sel
            const h = Math.max(anchoBarra, y(0) - y(v))
            return (
              <g key={dias[i]} onClick={() => setSel(i)} onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(i)}>
                <rect x={cx(i) - hueco / 2} y={0} width={hueco} height={ALTO} fill="transparent" />
                <rect
                  x={cx(i) - anchoBarra / 2}
                  y={v ? y(0) - h : y(0) - anchoBarra}
                  width={anchoBarra}
                  height={v ? h : anchoBarra}
                  rx={anchoBarra / 2}
                  className={`grafica-barra${activo ? ' activa' : ''}${v ? '' : ' vacia'}`}
                />
                {(periodo === 7 || i % 5 === (periodo - 1) % 5) && (
                  <text x={cx(i)} y={ALTO - 6} textAnchor="middle" className={`grafica-eje${activo ? ' activo' : ''}`}>
                    {periodo === 7 ? INICIAL.format(Date.parse(dias[i]) + 43_200_000).toUpperCase() : dias[i].slice(8)}
                  </text>
                )}
              </g>
            )
          })}
          <g transform={`translate(${ex}, ${Math.max(4, (valores[sel] ? y(0) - Math.max(anchoBarra, y(0) - y(valores[sel])) : y(0) - anchoBarra) - 38)})`} className="grafica-pildora">
            <rect width={anchoEtiqueta} height={28} rx={14} />
            <text x={anchoEtiqueta / 2} y={15} textAnchor="middle" dominantBaseline="middle">
              {etiqueta}
            </text>
          </g>
        </svg>
        <figcaption className="grafica-detalle" aria-live="polite">
          <strong>{fechaCorta(dias[sel])}</strong> · {valores[sel] ? `${kcal(valores[sel])} kcal` : 'sin comidas apuntadas'} ·
          la franja es tu rango de{' '}
          <span className="sin-corte">{kcal(objetivos.kcal_min)}–{kcal(objetivos.kcal_max)}</span>
        </figcaption>
      </figure>
    </section>
  )
}
