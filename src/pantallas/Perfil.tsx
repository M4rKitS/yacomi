import { useEffect, useState, type FormEvent } from 'react'
import { cargarObjetivos, guardarObjetivos } from '../lib/datos'
import { empezarDeCero, hayAnterior, ponerEjemplo, recuperarAnterior } from '../lib/datosInvitado'
import { leerNumero } from '../lib/formato'
import type { Objetivos } from '../lib/tipos'
import { useCarga } from '../lib/useCarga'

const CAMPOS: { clave: keyof Objetivos; nombre: string; unidad: string; opcional?: boolean }[] = [
  { clave: 'kcal_min', nombre: 'Calorías mínimas', unidad: 'kcal' },
  { clave: 'kcal_max', nombre: 'Calorías máximas', unidad: 'kcal' },
  { clave: 'protein_g', nombre: 'Proteína', unidad: 'g' },
  { clave: 'carbs_g', nombre: 'Carbohidratos', unidad: 'g', opcional: true },
  { clave: 'fat_g', nombre: 'Grasas', unidad: 'g', opcional: true },
  { clave: 'maintenance_kcal', nombre: 'Mantenimiento', unidad: 'kcal', opcional: true },
  { clave: 'target_weight_kg', nombre: 'Peso objetivo', unidad: 'kg', opcional: true },
]

export function Perfil({
  email,
  onSalir,
  version,
  onCambio,
}: {
  /** null en el modo invitado */
  email: string | null
  onSalir: () => void
  version: number
  onCambio: () => void
}) {
  const { datos, error } = useCarga(cargarObjetivos, [version])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    if (datos)
      setValores(Object.fromEntries(CAMPOS.map((c) => [c.clave, datos[c.clave] == null ? '' : String(datos[c.clave])])))
  }, [datos])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setEstado(null)
    setFallo(null)
    const o = Object.fromEntries(CAMPOS.map((c) => [c.clave, leerNumero(valores[c.clave] ?? '')])) as unknown as Objetivos
    if (o.kcal_min == null || o.kcal_max == null || o.protein_g == null)
      return setFallo('Las calorías y la proteína son obligatorias.')
    if (o.kcal_max < o.kcal_min) return setFallo('Las calorías máximas no pueden ser menores que las mínimas.')
    try {
      await guardarObjetivos({ ...o, kcal_min: Math.round(o.kcal_min), kcal_max: Math.round(o.kcal_max) })
      setEstado('Guardado')
      onCambio()
    } catch (err) {
      setFallo((err as Error).message)
    }
  }

  function sustituir(pregunta: string, accion: () => void) {
    if (window.confirm(pregunta)) aplicar(accion)
  }

  function aplicar(accion: () => void) {
    accion()
    setEstado(null)
    onCambio()
  }

  return (
    <div className="pantalla">
      <h1 className="titulo">Perfil</h1>
      <p className="fecha">{email ?? 'Invitado'}</p>

      <section className="tarjeta seccion">
        <h2 className="subtitulo">Objetivos diarios</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {datos && (
          <form className="formulario" onSubmit={guardar}>
            <div className="campos-rejilla">
              {CAMPOS.map((c) => (
                <label key={c.clave} className="campo">
                  <span>
                    {c.nombre} ({c.unidad})
                  </span>
                  <input
                    inputMode="decimal"
                    value={valores[c.clave] ?? ''}
                    placeholder={c.opcional ? 'Opcional' : undefined}
                    onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {fallo && <p className="error" role="alert">{fallo}</p>}
            <div className="acciones">
              <span className="ok" aria-live="polite">{estado}</span>
              <button type="submit" className="boton-principal">
                Guardar objetivos
              </button>
            </div>
          </form>
        )}
      </section>

      {email == null && (
        <section className="tarjeta seccion">
          <h2 className="subtitulo">Datos de este dispositivo</h2>
          <p className="fila-detalle">
            Lo que apuntes solo se guarda en este navegador. Si borras sus datos o cambias de móvil, se pierde.
          </p>
          <div className="botones-invitado">
            <button
              type="button"
              className="boton-secundario"
              onClick={() => sustituir('Se quitará todo lo que hay en este dispositivo. ¿Empezar de cero? Podrás deshacerlo.', empezarDeCero)}
            >
              Empezar de cero
            </button>
            <button
              type="button"
              className="boton-secundario"
              onClick={() => sustituir('Se sustituirá lo que hay en este dispositivo. ¿Poner los datos de ejemplo? Podrás deshacerlo.', ponerEjemplo)}
            >
              Poner datos de ejemplo
            </button>
          </div>
          {hayAnterior() && (
            <div className="deshacer-invitado">
              <span>Tienes guardados los datos que había antes.</span>
              <button type="button" className="boton-secundario" onClick={() => aplicar(recuperarAnterior)}>
                Deshacer
              </button>
            </div>
          )}
        </section>
      )}

      <button type="button" className="boton-secundario" onClick={onSalir}>
        {email == null ? 'Salir del modo invitado' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
