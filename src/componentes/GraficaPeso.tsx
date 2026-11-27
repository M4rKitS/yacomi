import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { PuntoPeso } from '../lib/tendencia'
import { fechaCorta, gramos } from '../lib/formato'
import { useAncho } from '../lib/useAncho'

const M = { arriba: 44, derecha: 20, abajo: 30, izquierda: 40 }

/** Curva suave que no se pasa de los puntos (interpolación monótona de Fritsch–Carlson). */
export function curvaMonotona(xs: number[], ys: number[]) {
  const n = xs.length
  if (n === 1) return `M${xs[0]},${ys[0]}`
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i] || 1))
  const m = ys.map((_, i) => {
    if (i === 0) return d[0]
    if (i === n - 1) return d[n - 2]
    return d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  })
  // Limita las pendientes para que la curva no se salga entre dos puntos
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      m[i] = k * a * d[i]
      m[i + 1] = k * b * d[i]
    }
  }
  let ruta = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3
    ruta += ` C${(xs[i] + h).toFixed(1)},${(ys[i] + m[i] * h).toFixed(1)} ${(xs[i + 1] - h).toFixed(1)},${(ys[i + 1] - m[i + 1] * h).toFixed(1)} ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(1)}`
  }
  return ruta
}

/** Curva suave que pasa por cada pesada, con relleno degradado; cada pesada se puede tocar. */
export function GraficaPeso({ puntos, objetivo }: { puntos: PuntoPeso[]; objetivo: number | null }) {
  const idGradiente = useId()
  const [marco, ANCHO] = useAncho<HTMLElement>(640)
  const ALTO = ANCHO < 500 ? 210 : 260
  const [sel, setSel] = useState(puntos.length - 1)
  useEffect(() => setSel(puntos.length - 1), [puntos.length])
  if (puntos.length === 0) return null

  const t = puntos.map((p) => Date.parse(p.dia))
  const t0 = t[0]
  const t1 = Math.max(t.at(-1)!, t0 + 86_400_000)
  const valores = puntos.map((p) => p.peso)
  const verObjetivo = objetivo != null && objetivo >= Math.min(...valores) - 3
  if (verObjetivo) valores.push(objetivo!)
  const min = Math.floor(Math.min(...valores) - 0.5)
  const max = Math.ceil(Math.max(...valores) + 0.5)

  const x = (ms: number) => M.izquierda + ((ms - t0) / (t1 - t0)) * (ANCHO - M.izquierda - M.derecha)
  const y = (kg: number) => M.arriba + ((max - kg) / (max - min)) * (ALTO - M.arriba - M.abajo)
  const xs = t.map(x)
  const ys = puntos.map((p) => y(p.peso))
  const curva = curvaMonotona(xs, ys)
  const base = ALTO - M.abajo
  const area = `${curva} L${xs.at(-1)!.toFixed(1)},${base} L${xs[0].toFixed(1)},${base} Z`
  const marcas = [min, Math.round(((min + max) / 2) * 10) / 10, max]

  const p = puntos[Math.min(sel, puntos.length - 1)]
  const px = xs[Math.min(sel, puntos.length - 1)]
  const py = y(p.peso)
  const etiqueta = `${gramos(p.peso)} kg`
  const anchoEtiqueta = etiqueta.length * 8 + 20
  const ex = Math.min(Math.max(px - anchoEtiqueta / 2, M.izquierda), ANCHO - M.derecha - anchoEtiqueta)

  function alTeclado(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, s - 1))
    else if (e.key === 'ArrowRight') setSel((s) => Math.min(puntos.length - 1, s + 1))
    else return
    e.preventDefault()
  }

  return (
    <figure className="grafica-marco" ref={marco}>
      <svg
        className="grafica"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        tabIndex={0}
        onKeyDown={alTeclado}
        aria-label={`Peso de ${fechaCorta(puntos[0].dia)} a ${fechaCorta(puntos.at(-1)!.dia)}. Usa las flechas para recorrer las pesadas.`}
      >
        <defs>
          <linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--mandarina)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--mandarina)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {marcas.map((m) => (
          <g key={m}>
            <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(m)} y2={y(m)} className="grafica-rejilla" />
            <text x={M.izquierda - 10} y={y(m)} className="grafica-eje" textAnchor="end" dominantBaseline="middle">
              {gramos(m)}
            </text>
          </g>
        ))}

        {verObjetivo && (
          <g>
            <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(objetivo!)} y2={y(objetivo!)} className="grafica-objetivo" />
            <text x={ANCHO - M.derecha} y={y(objetivo!) - 8} className="grafica-eje objetivo" textAnchor="end">
              objetivo {gramos(objetivo!)}
            </text>
          </g>
        )}

        <path d={area} fill={`url(#${idGradiente})`} />
        <path d={curva} className="grafica-tendencia" />

        <line x1={px} x2={px} y1={py} y2={base} className="grafica-guia" />

        {puntos.map((q, i) => (
          <circle key={q.dia} cx={xs[i]} cy={y(q.peso)} r={i === sel ? 7 : 4} className={i === sel ? 'grafica-punto activo' : 'grafica-punto'} />
        ))}

        <g transform={`translate(${ex}, ${Math.max(4, py - 42)})`} className="grafica-pildora">
          <rect width={anchoEtiqueta} height={28} rx={14} />
          <text x={anchoEtiqueta / 2} y={15} textAnchor="middle" dominantBaseline="middle">
            {etiqueta}
          </text>
        </g>

        {/* Zonas invisibles para tocar cada pesada */}
        {xs.map((cx, i) => {
          const izq = i === 0 ? M.izquierda : (xs[i - 1] + cx) / 2
          const der = i === xs.length - 1 ? ANCHO - M.derecha : (cx + xs[i + 1]) / 2
          return (
            <rect
              key={i}
              x={izq}
              y={0}
              width={Math.max(1, der - izq)}
              height={ALTO}
              fill="transparent"
              onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(i)}
              onClick={() => setSel(i)}
            />
          )
        })}

        <text x={xs[0]} y={ALTO - 6} className="grafica-eje">
          {fechaCorta(puntos[0].dia)}
        </text>
        <text x={ANCHO - M.derecha} y={ALTO - 6} className="grafica-eje" textAnchor="end">
          {fechaCorta(puntos.at(-1)!.dia)}
        </text>
      </svg>
      <figcaption className="grafica-detalle" aria-live="polite">
        <strong>{fechaCorta(p.dia)}</strong> · pesaste {gramos(p.peso)} kg · tendencia {gramos(Math.round(p.tendencia * 10) / 10)} kg
      </figcaption>
    </figure>
  )
}
