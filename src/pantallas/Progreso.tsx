import { useState, type FormEvent } from 'react'
import {
  borrarMedida,
  borrarPeso,
  cargarMedidas,
  cargarObjetivos,
  cargarPesos,
  cargarResumen,
  guardarMedida,
  guardarPeso,
} from '../lib/datos'
import { fechaCorta, gramos, hoyISO, kcal, leerNumero, sumarDias } from '../lib/formato'
import { esInvitado } from '../lib/invitado'
import { calcularTendencia, ritmoPorCalorias, ritmoSemanal, semanasHastaObjetivo } from '../lib/tendencia'
import type { Medida, Peso } from '../lib/tipos'
import { useCarga } from '../lib/useCarga'
import { Deslizable } from '../componentes/Deslizable'
import { GraficaCalorias } from '../componentes/GraficaCalorias'
import { Entrenos } from '../componentes/Entrenos'
import { GraficaPeso } from '../componentes/GraficaPeso'
import { Hoja } from '../componentes/Hoja'
import { Icono } from '../componentes/Icono'

const conSigno = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${gramos(Math.abs(Math.round(n * 10) / 10))}`
const fechaPrevista = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

const MEDIDAS: { clave: keyof Omit<Medida, 'id' | 'measured_on'>; nombre: string }[] = [
  { clave: 'waist_cm', nombre: 'Cintura' },
  { clave: 'chest_cm', nombre: 'Pecho' },
  { clave: 'hip_cm', nombre: 'Cadera' },
  { clave: 'thigh_cm', nombre: 'Muslo' },
]

export function Progreso({ version, onCambio }: { version: number; onCambio: () => void }) {
  const hoy = hoyISO()
  const { datos, error } = useCarga(
    () => Promise.all([cargarPesos(), cargarMedidas(), cargarObjetivos(), cargarResumen(sumarDias(hoy, -35))]),
    [version],
  )
  const [pesoAbierto, setPesoAbierto] = useState<Peso | 'nuevo' | null>(null)
  const [medidaAbierta, setMedidaAbierta] = useState<Medida | 'nueva' | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  async function quitar(accion: () => Promise<void>) {
    setFallo(null)
    try {
      await accion()
      onCambio()
    } catch (e) {
      setFallo((e as Error).message)
    }
  }

  if (error) return <div className="pantalla"><h1 className="titulo">Progreso</h1><p className="error" role="alert">{error}</p></div>
  if (!datos) return <div className="pantalla"><h1 className="titulo">Progreso</h1><p className="cargando">Cargando…</p></div>

  const [pesos, medidas, objetivos, resumen] = datos
  const puntos = calcularTendencia(pesos)
  const ultimo = puntos.at(-1)
  const ritmo = ritmoSemanal(puntos)
  const porComida = ritmoPorCalorias(resumen.filter((d) => d.eaten_on < hoy), objetivos.maintenance_kcal)
  const meta = objetivos.target_weight_kg
  const semanas = ultimo && meta ? semanasHastaObjetivo(ultimo.tendencia, meta, ritmo) : null
  const llegada = semanas ? new Date(Date.now() + semanas * 7 * 86_400_000) : null

  return (
    <div className="pantalla rejilla-progreso">
      <div className="titulo-con-accion columna-ancha">
        <h1 className="titulo">Progreso</h1>
        <button type="button" className="boton-principal" onClick={() => setPesoAbierto('nuevo')}>
          <Icono nombre="mas" tamano={18} /> Peso
        </button>
      </div>
      {fallo && <p className="error columna-ancha" role="alert">{fallo}</p>}

      <section className="cifras columna-ancha" aria-label="Resumen">
        <div className="tarjeta cifra">
          <p className="macro-nombre">Tendencia</p>
          <p className="cifra-valor">{ultimo ? `${gramos(ultimo.tendencia)} kg` : '—'}</p>
          <p className="macro-nota">
            {puntos.length > 1 ? `${conSigno(ultimo!.tendencia - puntos[0].tendencia)} kg desde ${fechaCorta(puntos[0].dia)}` : 'Apunta más pesadas'}
          </p>
        </div>
        <div className="tarjeta cifra">
          <p className="macro-nombre">Según tu báscula</p>
          <p className="cifra-valor">{ritmo != null ? `${conSigno(ritmo)} kg/sem` : '—'}</p>
          <p className="macro-nota">media de las últimas semanas</p>
        </div>
        <div className="tarjeta cifra">
          <p className="macro-nombre">Según lo que comes</p>
          <p className="cifra-valor">{porComida ? `${conSigno(porComida.kgSemana)} kg/sem` : '—'}</p>
          <p className="macro-nota">
            {porComida
              ? `${kcal(porComida.media)} kcal de media en ${porComida.dias} días`
              : objetivos.maintenance_kcal
                ? 'faltan días apuntados'
                : 'pon tu mantenimiento en Perfil'}
          </p>
        </div>
        <div className="tarjeta cifra destacada">
          <p className="macro-nombre">Objetivo</p>
          <p className="cifra-valor">{meta ? `${gramos(meta)} kg` : '—'}</p>
          <p className="macro-nota">
            {!meta
              ? 'ponlo en Perfil'
              : llegada
                ? `a este ritmo, hacia ${fechaPrevista.format(llegada)}`
                : ultimo
                  ? `te faltan ${gramos(Math.abs(Math.round((ultimo.tendencia - meta) * 10) / 10))} kg`
                  : ''}
          </p>
        </div>
      </section>

      <section className="tarjeta seccion">
        <h2 className="subtitulo">Peso</h2>
        {puntos.length === 0 ? (
          <p className="vacio">Aún no has apuntado ningún peso.</p>
        ) : (
          <>
            <GraficaPeso puntos={puntos} objetivo={meta} />
          </>
        )}
        <ul className="filas lista-plana">
          {[...pesos].reverse().map((p) => (
            <li key={p.id}>
              <Deslizable
                etiqueta={`Peso del ${fechaCorta(p.measured_on)}`}
                onEditar={() => setPesoAbierto(p)}
                onBorrar={() => quitar(() => borrarPeso(p.id))}
              >
                <span className="fila-texto">
                  <span className="fila-nombre">{fechaCorta(p.measured_on)}</span>
                </span>
                <span className="fila-kcal">{gramos(p.weight_kg)} kg</span>
              </Deslizable>
            </li>
          ))}
        </ul>
      </section>

      <GraficaCalorias resumen={resumen} objetivos={objetivos} />

      {!esInvitado() && <Entrenos />}

      <section className="tarjeta seccion">
        <div className="titulo-con-accion">
          <h2 className="subtitulo">Medidas</h2>
          <button type="button" className="boton-secundario pequeno" onClick={() => setMedidaAbierta('nueva')}>
            <Icono nombre="mas" tamano={16} /> Medidas
          </button>
        </div>
        {medidas.length === 0 && <p className="vacio">Aún no has apuntado medidas.</p>}
        {medidas.length > 0 && (
          <div className="medidas">
            {MEDIDAS.map(({ clave, nombre }) => {
              const actual = medidas[0][clave]
              const previa = medidas.slice(1).find((m) => m[clave] != null)?.[clave]
              return (
                <div key={clave} className="medida">
                  <p className="macro-nombre">{nombre}</p>
                  <p className="cifra-valor">{actual == null ? '—' : `${gramos(actual)} cm`}</p>
                  {actual != null && previa != null && <p className="macro-nota">{conSigno(actual - previa)} cm</p>}
                </div>
              )
            })}
          </div>
        )}
        <ul className="filas lista-plana">
          {medidas.map((m) => (
            <li key={m.id}>
              <Deslizable
                etiqueta={`Medidas del ${fechaCorta(m.measured_on)}`}
                onEditar={() => setMedidaAbierta(m)}
                onBorrar={() => quitar(() => borrarMedida(m.id))}
              >
                <span className="fila-texto">
                  <span className="fila-nombre">{fechaCorta(m.measured_on)}</span>
                  <span className="fila-detalle">
                    {MEDIDAS.filter((x) => m[x.clave] != null)
                      .map((x) => `${x.nombre.toLowerCase()} ${gramos(m[x.clave])}`)
                      .join(' · ')}
                  </span>
                </span>
              </Deslizable>
            </li>
          ))}
        </ul>
      </section>

      {pesoAbierto && (
        <FormPeso
          peso={pesoAbierto === 'nuevo' ? null : pesoAbierto}
          sugerido={ultimo?.peso ?? null}
          onCerrar={() => setPesoAbierto(null)}
          onGuardado={() => {
            setPesoAbierto(null)
            onCambio()
          }}
        />
      )}
      {medidaAbierta && (
        <FormMedida
          medida={medidaAbierta === 'nueva' ? null : medidaAbierta}
          onCerrar={() => setMedidaAbierta(null)}
          onGuardado={() => {
            setMedidaAbierta(null)
            onCambio()
          }}
        />
      )}
    </div>
  )
}

function FormPeso({
  peso,
  sugerido,
  onCerrar,
  onGuardado,
}: {
  peso: Peso | null
  sugerido: number | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [dia, setDia] = useState(peso?.measured_on ?? hoyISO())
  const [kg, setKg] = useState(peso ? String(peso.weight_kg).replace('.', ',') : '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const n = leerNumero(kg)
    if (!n || n < 20 || n > 400) return setError('Escribe un peso válido en kilos.')
    setGuardando(true)
    try {
      if (peso && peso.measured_on !== dia) await borrarPeso(peso.id)
      await guardarPeso(dia, n)
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={peso ? 'Editar peso' : 'Apuntar peso'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <div className="campos-fila">
          <label className="campo">
            <span>Día</span>
            <input type="date" value={dia} max={hoyISO()} onChange={(e) => setDia(e.target.value)} />
          </label>
          <label className="campo">
            <span>Peso (kg)</span>
            <input
              inputMode="decimal"
              value={kg}
              placeholder={sugerido ? gramos(sugerido) : undefined}
              onChange={(e) => setKg(e.target.value)}
              autoFocus
            />
          </label>
        </div>
        <p className="fila-detalle">Si ya hay un peso ese día, se sustituye.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="boton-principal ancho" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </Hoja>
  )
}

function FormMedida({
  medida,
  onCerrar,
  onGuardado,
}: {
  medida: Medida | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [dia, setDia] = useState(medida?.measured_on ?? hoyISO())
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEDIDAS.map(({ clave }) => [clave, medida?.[clave] == null ? '' : String(medida[clave]).replace('.', ',')])),
  )
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const leidos = Object.fromEntries(MEDIDAS.map(({ clave }) => [clave, leerNumero(valores[clave])])) as Record<
      (typeof MEDIDAS)[number]['clave'],
      number | null
    >
    if (Object.values(leidos).every((v) => v == null)) return setError('Escribe al menos una medida.')
    setGuardando(true)
    try {
      if (medida && medida.measured_on !== dia) await borrarMedida(medida.id)
      await guardarMedida({ measured_on: dia, ...leidos })
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={medida ? 'Editar medidas' : 'Apuntar medidas'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <label className="campo">
          <span>Día</span>
          <input type="date" value={dia} max={hoyISO()} onChange={(e) => setDia(e.target.value)} />
        </label>
        <div className="campos-fila">
          {MEDIDAS.map(({ clave, nombre }) => (
            <label key={clave} className="campo">
              <span>{nombre} (cm)</span>
              <input
                inputMode="decimal"
                value={valores[clave]}
                placeholder="Opcional"
                onChange={(e) => setValores({ ...valores, [clave]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="boton-principal ancho" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </Hoja>
  )
}
