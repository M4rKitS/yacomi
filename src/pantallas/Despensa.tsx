import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  borrarAlimento,
  cargarAlimentos,
  contarComidasDeAlimento,
  corregirComidasDeAlimento,
  guardarAlimento,
} from '../lib/datos'
import { gramos, kcal, leerNumero } from '../lib/formato'
import type { Alimento } from '../lib/tipos'
import { useCarga } from '../lib/useCarga'
import { Deslizable } from '../componentes/Deslizable'
import { Hoja } from '../componentes/Hoja'
import { Icono } from '../componentes/Icono'
import { Platos } from './Platos'

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function Despensa({ version, onCambio }: { version: number; onCambio: () => void }) {
  const [vista, setVista] = useState<'alimentos' | 'platos'>('alimentos')
  return (
    <div className="pantalla">
      <div className="titulo-con-accion">
        <h1 className="titulo">Despensa</h1>
        <div className="segmentos" role="group" aria-label="Qué ver">
          <button type="button" aria-pressed={vista === 'alimentos'} onClick={() => setVista('alimentos')}>
            Alimentos
          </button>
          <button type="button" aria-pressed={vista === 'platos'} onClick={() => setVista('platos')}>
            Platos
          </button>
        </div>
      </div>
      {vista === 'alimentos' ? <Alimentos version={version} onCambio={onCambio} /> : <Platos version={version} onCambio={onCambio} />}
    </div>
  )
}

function Alimentos({ version, onCambio }: { version: number; onCambio: () => void }) {
  const { datos, error } = useCarga(cargarAlimentos, [version])
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Alimento | 'nuevo' | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  async function borrarDeLista(a: Alimento) {
    setFallo(null)
    try {
      const usos = await contarComidasDeAlimento(a.id)
      const aviso = usos
        ? `¿Borrar «${a.name}» de la despensa? Tus ${usos} comidas anteriores se quedan como están.`
        : `¿Borrar «${a.name}» de la despensa?`
      if (!window.confirm(aviso)) return
      await borrarAlimento(a.id)
      onCambio()
    } catch (e) {
      setFallo((e as Error).message)
    }
  }

  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return (datos ?? []).filter((a) => !q || normalizar(a.name).includes(q))
  }, [datos, busqueda])

  return (
    <>
      <div className="titulo-con-accion">
        <p className="fecha">{datos ? `${datos.length} alimentos · por 100 g` : ' '}</p>
        <button type="button" className="boton-principal" onClick={() => setEditando('nuevo')}>
          <Icono nombre="mas" tamano={18} /> Nuevo
        </button>
      </div>

      <label className="buscador">
        <Icono nombre="buscar" tamano={18} />
        <input
          type="search"
          placeholder="Buscar alimento"
          aria-label="Buscar alimento"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {(error || fallo) && <p className="error" role="alert">{error ?? fallo}</p>}
      {!datos && !error && <p className="cargando">Cargando…</p>}
      {datos && lista.length === 0 && <p className="vacio">{busqueda ? `No hay ningún alimento con «${busqueda}».` : 'Tu despensa está vacía. Añade el primero con «Nuevo».'}</p>}

      <ul className="filas tarjeta">
        {lista.map((a) => (
          <li key={a.id}>
            <Deslizable etiqueta={a.name} onEditar={() => setEditando(a)} onBorrar={() => borrarDeLista(a)}>
              <span className="fila-texto">
                <span className="fila-nombre">{a.name}</span>
                <span className="fila-detalle">
                  {kcal(a.kcal_100g)} kcal · {gramos(a.protein_100g)} g prot.
                  {a.carbs_100g != null && ` · ${gramos(a.carbs_100g)} g carb.`}
                  {a.fat_100g != null && ` · ${gramos(a.fat_100g)} g grasa`}
                </span>
              </span>
            </Deslizable>
          </li>
        ))}
      </ul>

      {editando && (
        <EditarAlimento
          alimento={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            onCambio()
          }}
        />
      )}
    </>
  )
}

const texto = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

function EditarAlimento({
  alimento,
  onCerrar,
  onGuardado,
}: {
  alimento: Alimento | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(alimento?.name ?? '')
  const [k, setK] = useState(texto(alimento?.kcal_100g ?? null))
  const [p, setP] = useState(texto(alimento?.protein_100g ?? null))
  const [c, setC] = useState(texto(alimento?.carbs_100g ?? null))
  const [f, setF] = useState(texto(alimento?.fat_100g ?? null))
  const [usos, setUsos] = useState(0)
  const [corregir, setCorregir] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (alimento) contarComidasDeAlimento(alimento.id).then(setUsos).catch(() => setUsos(0))
  }, [alimento])

  const valores = {
    kcal_100g: leerNumero(k),
    protein_100g: leerNumero(p) ?? 0,
    carbs_100g: leerNumero(c),
    fat_100g: leerNumero(f),
  }
  const cambianValores =
    alimento != null &&
    (valores.kcal_100g !== alimento.kcal_100g ||
      valores.protein_100g !== alimento.protein_100g ||
      valores.carbs_100g !== alimento.carbs_100g ||
      valores.fat_100g !== alimento.fat_100g)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Ponle un nombre.')
    if (valores.kcal_100g == null) return setError('Escribe las calorías por 100 g.')
    setGuardando(true)
    setError(null)
    try {
      const guardado = await guardarAlimento({
        ...(alimento ? { id: alimento.id } : {}),
        name: nombre.trim(),
        kcal_100g: valores.kcal_100g,
        protein_100g: valores.protein_100g,
        carbs_100g: valores.carbs_100g,
        fat_100g: valores.fat_100g,
        barcode: alimento?.barcode ?? null,
      })
      if (corregir && cambianValores) await corregirComidasDeAlimento(guardado.id)
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!alimento) return
    const aviso = usos
      ? `¿Borrar «${alimento.name}» de la despensa? Tus ${usos} comidas anteriores se quedan como están.`
      : `¿Borrar «${alimento.name}» de la despensa?`
    if (!window.confirm(aviso)) return
    setGuardando(true)
    try {
      await borrarAlimento(alimento.id)
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={alimento ? 'Editar alimento' : 'Nuevo alimento'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <label className="campo">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!alimento} />
        </label>
        <p className="fila-detalle">Valores por 100 g</p>
        <div className="campos-fila">
          <label className="campo">
            <span>Calorías</span>
            <input inputMode="decimal" value={k} onChange={(e) => setK(e.target.value)} />
          </label>
          <label className="campo">
            <span>Proteína (g)</span>
            <input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
          </label>
        </div>
        <div className="campos-fila">
          <label className="campo">
            <span>Carbohidratos (g)</span>
            <input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder="Opcional" />
          </label>
          <label className="campo">
            <span>Grasas (g)</span>
            <input inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} placeholder="Opcional" />
          </label>
        </div>

        {cambianValores && usos > 0 && (
          <label className="casilla">
            <input type="checkbox" checked={corregir} onChange={(e) => setCorregir(e.target.checked)} />
            <span>
              Corregir también mis {usos} {usos === 1 ? 'comida anterior' : 'comidas anteriores'} con este alimento
              <small>Si no lo marcas, solo cambia a partir de ahora.</small>
            </span>
          </label>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="acciones">
          {alimento && (
            <button type="button" className="boton-peligro" onClick={borrar} disabled={guardando}>
              Borrar
            </button>
          )}
          <button type="submit" className="boton-principal" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Hoja>
  )
}
