import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { esInvitado, ponerInvitado } from './lib/invitado'
import { supabase } from './lib/supabase'
import { categoriaPorHora, hoyISO } from './lib/formato'
import type { Categoria } from './lib/tipos'
import { Nav, SECCIONES, type Seccion } from './componentes/Nav'
import { Anadir } from './componentes/Anadir'
import { Hoy } from './pantallas/Hoy'
import { Diario } from './pantallas/Diario'
import { Despensa } from './pantallas/Despensa'
import { Perfil } from './pantallas/Perfil'
import { Progreso } from './pantallas/Progreso'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(errorDeEntrada)
  const [invitado, setInvitado] = useState(esInvitado)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSession(nueva))
    return () => data.subscription.unsubscribe()
  }, [])

  async function entrarConGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  const cambiarInvitado = (si: boolean) => {
    ponerInvitado(si)
    setInvitado(si)
    history.replaceState(null, '', '/')
  }

  if (invitado) return <Aplicacion key="invitado" email={null} onSalir={() => cambiarInvitado(false)} />

  if (cargando) return <main className="pantalla-entrada" aria-busy="true" />

  if (!session) {
    return (
      <main className="pantalla-entrada">
        <img src="/marca/YaComi-logo-claro.svg" alt="YaComí" className="logo-entrada" />
        <p className="lema">Tu diario de comidas</p>
        <button type="button" className="boton-google" onClick={entrarConGoogle}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
          </svg>
          Entrar con Google
        </button>
        <button type="button" className="boton-secundario" onClick={() => cambiarInvitado(true)}>
          Entrar como invitado
        </button>
        <p className="nota-entrada">Sin cuenta y con datos de ejemplo. Lo que apuntes se queda en este dispositivo.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </main>
    )
  }

  return <Aplicacion email={session.user.email ?? ''} onSalir={() => supabase.auth.signOut()} />
}

/** Google devuelve aquí los errores en la dirección; sin esto, quien no tiene cuenta no sabe qué ha pasado. */
function errorDeEntrada(): string | null {
  const p = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`)
  if (!p.get('error')) return null
  return /signup/i.test(`${p.get('error_code')} ${p.get('error_description')}`)
    ? 'Esa cuenta de Google no tiene acceso. Puedes entrar como invitado.'
    : 'No se ha podido entrar con Google. Prueba otra vez.'
}

function leerHash(): { seccion: Seccion; dia: string | null } {
  const [s, d] = window.location.hash.replace('#', '').split('/')
  const seccion = SECCIONES.some((x) => x.id === s) ? (s as Seccion) : 'hoy'
  return { seccion, dia: seccion === 'diario' && /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d : null }
}

function Aplicacion({ email, onSalir }: { email: string | null; onSalir: () => void }) {
  const [ruta, setRuta] = useState(leerHash)
  const [version, setVersion] = useState(0)
  const [hoy, setHoy] = useState(hoyISO)
  const [anadir, setAnadir] = useState<{ dia: string; categoria: Categoria } | null>(null)
  const cambio = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const alCambiar = () => setRuta(leerHash())
    window.addEventListener('hashchange', alCambiar)
    window.addEventListener('popstate', alCambiar)
    // Si la app se queda abierta pasada la medianoche, Hoy pasa al día nuevo
    const alVolver = () => document.visibilityState === 'visible' && setHoy(hoyISO())
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.removeEventListener('hashchange', alCambiar)
      window.removeEventListener('popstate', alCambiar)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  const ir = (seccion: Seccion, dia: string | null = null) => {
    // Con pushState y no con location.hash: el iPhone toma ese cambio por otra página y olvida el permiso de la cámara
    const destino = `#${dia ? `${seccion}/${dia}` : seccion}`
    if (destino !== window.location.hash) history.pushState(null, '', destino)
    setRuta(leerHash())
    window.scrollTo(0, 0)
  }

  const abrirAnadir = (dia = ruta.dia ?? hoy, categoria: Categoria = categoriaPorHora()) =>
    setAnadir({ dia, categoria })

  return (
    <div className="marco">
      <Nav actual={ruta.seccion} onIr={(s) => ir(s)} onAnadir={() => abrirAnadir()} />
      <main className="contenido">
        {email == null && <p className="banda-invitado">Modo invitado · se guarda solo en este dispositivo</p>}
        {ruta.seccion === 'hoy' && (
          <Hoy dia={hoy} version={version} onAnadir={(c) => abrirAnadir(hoy, c)} onCambio={cambio} />
        )}
        {ruta.seccion === 'diario' && (
          <Diario
            version={version}
            diaAbierto={ruta.dia}
            onAbrir={(d) => ir('diario', d)}
            onAnadir={(d, c) => abrirAnadir(d, c)}
            onCambio={cambio}
          />
        )}
        {ruta.seccion === 'despensa' && <Despensa version={version} onCambio={cambio} />}
        {ruta.seccion === 'progreso' && <Progreso version={version} onCambio={cambio} />}
        {ruta.seccion === 'perfil' && <Perfil email={email} onSalir={onSalir} version={version} onCambio={cambio} />}
      </main>

      {anadir && (
        <Anadir
          dia={anadir.dia}
          categoriaInicial={anadir.categoria}
          onCerrar={() => setAnadir(null)}
          onAnadida={() => {
            setAnadir(null)
            cambio()
          }}
        />
      )}
    </div>
  )
}
