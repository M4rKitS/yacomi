import { Icono, type NombreIcono } from './Icono'

export const SECCIONES = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'diario', nombre: 'Diario' },
  { id: 'despensa', nombre: 'Despensa' },
  { id: 'progreso', nombre: 'Progreso' },
  { id: 'perfil', nombre: 'Perfil' },
] as const satisfies readonly { id: NombreIcono; nombre: string }[]

export type Seccion = (typeof SECCIONES)[number]['id']

export function Nav({ actual, onIr, onAnadir }: { actual: Seccion; onIr: (s: Seccion) => void; onAnadir: () => void }) {
  return (
    <nav className="nav" aria-label="Secciones">
      <img src="/marca/YaComi-logo-claro.svg" alt="YaComí" className="nav-logo" />
      <ul className="nav-lista">
        {SECCIONES.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="nav-enlace"
              aria-current={actual === s.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                onIr(s.id)
              }}
            >
              <Icono nombre={s.id} />
              <span>{s.nombre}</span>
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="nav-mas" onClick={onAnadir} aria-label="Añadir comida">
        <Icono nombre="mas" tamano={28} />
        <span className="nav-mas-texto">Añadir comida</span>
      </button>
    </nav>
  )
}
