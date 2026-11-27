import { calcularRacha, cargarComidasDe, cargarObjetivos, cargarResumen } from '../lib/datos'
import { fechaLarga, sumarDias } from '../lib/formato'
import type { Categoria } from '../lib/tipos'
import { useCarga } from '../lib/useCarga'
import { Icono } from '../componentes/Icono'
import { ListaDia } from '../componentes/ListaDia'
import { Resumen } from '../componentes/Resumen'

export function Hoy({
  dia,
  version,
  onAnadir,
  onCambio,
}: {
  dia: string
  version: number
  onAnadir: (c: Categoria) => void
  onCambio: () => void
}) {
  const { datos, error } = useCarga(
    async () => {
      const [objetivos, comidas, resumen] = await Promise.all([
        cargarObjetivos(),
        cargarComidasDe(dia),
        cargarResumen(sumarDias(dia, -400)),
      ])
      const racha = calcularRacha(new Set(resumen.map((r) => r.eaten_on)), dia, sumarDias)
      return { objetivos, comidas, racha }
    },
    [dia, version],
  )

  return (
    <div className="pantalla rejilla-dia">
      <div className="columna-resumen">
        <header className="cabecera-hoy">
          <img src="/marca/YaComi-logo-claro.svg" alt="YaComí" className="logo-cabecera" />
          {datos && datos.racha > 0 && (
            <span className="racha" title="Días seguidos apuntando">
              <Icono nombre="llama" tamano={16} />
              {datos.racha} {datos.racha === 1 ? 'día' : 'días'}
            </span>
          )}
        </header>
        <p className="fecha">{fechaLarga(dia)}</p>
        <h1 className="titulo">¿Ya comiste?</h1>
        {error && <p className="error" role="alert">{error}</p>}
        {!datos && !error && <p className="cargando">Cargando…</p>}
        {datos && <Resumen comidas={datos.comidas} objetivos={datos.objetivos} />}
      </div>

      {datos && (
        <div className="columna-lista">
          <h2 className="subtitulo">Comidas de hoy</h2>
          <ListaDia comidas={datos.comidas} onAnadir={onAnadir} onCambio={onCambio} />
        </div>
      )}
    </div>
  )
}
