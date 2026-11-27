import { cargarComidasDe, cargarObjetivos, cargarResumen } from '../lib/datos'
import { fechaCorta, fechaLarga, gramos, hoyISO, kcal, sumarDias } from '../lib/formato'
import type { Categoria } from '../lib/tipos'
import { useCarga } from '../lib/useCarga'
import { Icono } from '../componentes/Icono'
import { ListaDia } from '../componentes/ListaDia'
import { Resumen } from '../componentes/Resumen'

export function Diario({
  version,
  diaAbierto,
  onAbrir,
  onAnadir,
  onCambio,
}: {
  version: number
  diaAbierto: string | null
  onAbrir: (dia: string | null) => void
  onAnadir: (dia: string, c: Categoria) => void
  onCambio: () => void
}) {
  if (diaAbierto) {
    return (
      <DiaDelDiario
        dia={diaAbierto}
        version={version}
        onVolver={() => onAbrir(null)}
        onAnadir={(c) => onAnadir(diaAbierto, c)}
        onCambio={onCambio}
      />
    )
  }
  return <ListaDias version={version} onAbrir={onAbrir} />
}

function ListaDias({ version, onAbrir }: { version: number; onAbrir: (dia: string) => void }) {
  const hoy = hoyISO()
  const { datos, error } = useCarga(
    () => Promise.all([cargarObjetivos(), cargarResumen(sumarDias(hoy, -120))]),
    [version],
  )

  return (
    <div className="pantalla">
      <h1 className="titulo">Diario</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {!datos && !error && <p className="cargando">Cargando…</p>}
      {datos && (
        <>
          <p className="fecha">Últimos 4 meses · toca un día para verlo o corregirlo</p>
          <ul className="filas tarjeta">
            {datos[1].map((d) => {
              const [o] = datos
              const estado = d.kcal < o.kcal_min ? 'bajo' : d.kcal <= o.kcal_max ? 'dentro' : 'alto'
              return (
                <li key={d.eaten_on}>
                  <button type="button" className="fila" onClick={() => onAbrir(d.eaten_on)}>
                    <span className={`punto ${estado}`} aria-hidden="true" />
                    <span className="fila-texto">
                      <span className="fila-nombre">{fechaCorta(d.eaten_on)}</span>
                      <span className="fila-detalle">
                        {gramos(d.protein)} g proteína · {d.comidas} {d.comidas === 1 ? 'comida' : 'comidas'}
                      </span>
                    </span>
                    <span className="fila-kcal">{kcal(d.kcal)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="leyenda">
            <span className="punto dentro" /> en tu rango <span className="punto bajo" /> por debajo{' '}
            <span className="punto alto" /> por encima
          </p>
        </>
      )}
    </div>
  )
}

function DiaDelDiario({
  dia,
  version,
  onVolver,
  onAnadir,
  onCambio,
}: {
  dia: string
  version: number
  onVolver: () => void
  onAnadir: (c: Categoria) => void
  onCambio: () => void
}) {
  const { datos, error } = useCarga(() => Promise.all([cargarObjetivos(), cargarComidasDe(dia)]), [dia, version])
  return (
    <div className="pantalla rejilla-dia">
      <div className="columna-resumen">
        <button type="button" className="enlace-atras" onClick={onVolver}>
          <Icono nombre="atras" tamano={18} /> Diario
        </button>
        <h1 className="titulo">{fechaLarga(dia)}</h1>
        {error && <p className="error" role="alert">{error}</p>}
        {datos && <Resumen objetivos={datos[0]} comidas={datos[1]} />}
      </div>
      {datos && (
        <div className="columna-lista">
          <h2 className="subtitulo">Comidas</h2>
          <ListaDia comidas={datos[1]} onAnadir={onAnadir} onCambio={onCambio} />
        </div>
      )}
    </div>
  )
}
