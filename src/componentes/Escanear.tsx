import { useEffect, useRef, useState, type FormEvent } from 'react'
import { guardarAlimento, racion } from '../lib/datos'
import { candidatos, codigoValido, normalizarCodigo } from '../lib/ean'
import { gramos, kcal, leerNumero } from '../lib/formato'
import { esInvitado } from '../lib/invitado'
import { leerEtiqueta, prepararFoto } from '../lib/ia'
import type { Alimento, NuevaComida } from '../lib/tipos'
import { Icono } from './Icono'

type Guardar = (c: Omit<NuevaComida, 'eaten_on' | 'category'>) => void

type Estado =
  | { paso: 'camara' }
  | { paso: 'buscando'; codigo: string }
  | { paso: 'ficha'; codigo: string; alimento: Alimento | null; aviso: string | null }

const texto = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export function Escanear({
  alimentos,
  guardando,
  onGuardar,
}: {
  alimentos: Alimento[] | null
  guardando: boolean
  onGuardar: Guardar
}) {
  const [estado, setEstado] = useState<Estado>({ paso: 'camara' })
  const [manual, setManual] = useState('')
  const [nombre, setNombre] = useState('')
  const [valores, setValores] = useState({ k: '', p: '', c: '', f: '' })
  const [g, setG] = useState('100')
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  async function buscar(leido: string) {
    setError(null)
    const posibles = candidatos(leido)
    const propio = alimentos?.find((a) => a.barcode && posibles.includes(normalizarCodigo(a.barcode)))
    if (propio) {
      setNombre(propio.name)
      setValores({ k: texto(propio.kcal_100g), p: texto(propio.protein_100g), c: texto(propio.carbs_100g), f: texto(propio.fat_100g) })
      setEstado({ paso: 'ficha', codigo: propio.barcode!, alimento: propio, aviso: null })
      return
    }
    setEstado({ paso: 'buscando', codigo: posibles[0] })
    try {
      const { buscarProducto } = await import('../lib/codigos')
      const { codigo, producto: p, fuente, incompleta } = await buscarProducto(posibles)
      setNombre(p?.nombre ?? '')
      setValores({ k: texto(p?.kcal_100g), p: texto(p?.protein_100g), c: texto(p?.carbs_100g), f: texto(p?.fat_100g) })
      setEstado({
        paso: 'ficha',
        codigo,
        alimento: null,
        aviso: p
          ? p.kcal_100g == null || p.protein_100g == null
            ? `${fuente} conoce el producto, pero le faltan datos. ${esInvitado() ? 'Complétalos con la etiqueta.' : 'Haz una foto a la tabla nutricional o complétalos.'}`
            : `Datos de ${fuente}. Revísalos con la etiqueta antes de guardar.`
          : incompleta
            ? `Alguna base de datos no ha respondido. Vuelve a escanear en un momento o ${esInvitado() ? 'copia los datos de la etiqueta' : 'haz una foto a la tabla nutricional'}.`
            : esInvitado()
              ? 'Este código no está en la base de datos. Copia los valores de la etiqueta.'
              : 'Este código no está en las bases de datos. Haz una foto a la tabla nutricional, o sube una captura de otra app, y se rellena sola.',
      })
    } catch (e) {
      setError((e as Error).message)
      setEstado({ paso: 'camara' })
    }
  }

  async function leerFoto(archivo: File | undefined) {
    if (!archivo || estado.paso !== 'ficha') return
    setLeyendo(true)
    setError(null)
    try {
      const e = await leerEtiqueta(await prepararFoto(archivo, 1600))
      setNombre((n) => n.trim() || e.nombre)
      setValores((v) => ({
        k: texto(e.kcal_100g) || v.k,
        p: texto(e.protein_100g) || v.p,
        c: texto(e.carbs_100g) || v.c,
        f: texto(e.fat_100g) || v.f,
      }))
      // 4 kcal por gramo de proteína y carbohidratos, 9 por gramo de grasa: si no cuadra, algo se ha leído mal
      const suma = (e.protein_100g ?? 0) * 4 + (e.carbs_100g ?? 0) * 4 + (e.fat_100g ?? 0) * 9
      const entero = e.kcal_100g != null && e.protein_100g != null && e.carbs_100g != null && e.fat_100g != null
      const raro = entero && Math.abs(suma - e.kcal_100g!) > Math.max(30, e.kcal_100g! * 0.25)
      setEstado({
        ...estado,
        aviso: raro
          ? 'Leído de la foto, pero las calorías no cuadran con el resto. Compáralo con la etiqueta.'
          : 'Leído de la foto. Compáralo con la etiqueta antes de guardar.',
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLeyendo(false)
    }
  }

  if (estado.paso === 'camara') {
    return (
      <div className="formulario">
        <Camara onCodigo={buscar} />
        <form
          className="codigo-manual"
          onSubmit={(e) => {
            e.preventDefault()
            if (codigoValido(manual)) buscar(manual)
            else setError('Ese código no es correcto. Revisa las cifras.')
          }}
        >
          <label className="campo">
            <span>O escribe el código</span>
            <input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ej. 6408430000258" />
          </label>
          <button type="submit" className="boton-secundario" disabled={manual.replace(/\D/g, '').length < 8}>
            Buscar
          </button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    )
  }

  if (estado.paso === 'buscando') return <p className="cargando">Buscando {estado.codigo}…</p>

  const leidos = {
    kcal_100g: leerNumero(valores.k),
    protein_100g: leerNumero(valores.p) ?? 0,
    carbs_100g: leerNumero(valores.c),
    fat_100g: leerNumero(valores.f),
  }
  const n = leerNumero(g)
  const r = leidos.kcal_100g != null && n ? racion({ ...leidos, kcal_100g: leidos.kcal_100g }, n) : null

  async function anadir(e: FormEvent) {
    e.preventDefault()
    if (estado.paso !== 'ficha' || !r || !n || leidos.kcal_100g == null) return
    if (!nombre.trim()) return setError('Ponle un nombre.')
    setError(null)
    try {
      // Si el producto es nuevo o lo has corregido, se guarda en tu despensa con su código
      const a = estado.alimento
      const cambiado =
        !a ||
        a.name !== nombre.trim() ||
        a.kcal_100g !== leidos.kcal_100g ||
        a.protein_100g !== leidos.protein_100g ||
        a.carbs_100g !== leidos.carbs_100g ||
        a.fat_100g !== leidos.fat_100g
      const alimento = cambiado
        ? await guardarAlimento({
            ...(a ? { id: a.id } : {}),
            name: nombre.trim(),
            ...leidos,
            kcal_100g: leidos.kcal_100g,
            barcode: estado.codigo,
          })
        : a
      onGuardar({
        name: alimento.name,
        grams: n,
        ...r,
        kcal_100g: alimento.kcal_100g,
        protein_100g: alimento.protein_100g,
        carbs_100g: alimento.carbs_100g,
        fat_100g: alimento.fat_100g,
        food_id: alimento.id,
        source: 'escaner',
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="formulario" onSubmit={anadir}>
      <button type="button" className="enlace-atras" onClick={() => setEstado({ paso: 'camara' })}>
        <Icono nombre="atras" tamano={18} /> Escanear otro
      </button>
      {estado.alimento ? (
        <p className="aviso-suave">Ya lo tenías en tu despensa.</p>
      ) : (
        estado.aviso && <p className="aviso-suave">{estado.aviso}</p>
      )}
      {!estado.alimento && !esInvitado() && (
        <label className={`boton-secundario foto-etiqueta${leyendo ? ' ocupado' : ''}`}>
          <Icono nombre="camara" tamano={18} /> {leyendo ? 'Leyendo la etiqueta…' : 'Foto o captura de la tabla'}
          <input
            type="file"
            accept="image/*"
            disabled={leyendo}
            onChange={(e) => {
              leerFoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      )}
      <label className="campo">
        <span>Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <p className="fila-detalle">Valores por 100 g · código {estado.codigo}</p>
      <div className="campos-fila">
        <label className="campo">
          <span>Calorías</span>
          <input inputMode="decimal" value={valores.k} onChange={(e) => setValores({ ...valores, k: e.target.value })} />
        </label>
        <label className="campo">
          <span>Proteína (g)</span>
          <input inputMode="decimal" value={valores.p} onChange={(e) => setValores({ ...valores, p: e.target.value })} />
        </label>
        <label className="campo">
          <span>Carbohidratos (g)</span>
          <input inputMode="decimal" value={valores.c} onChange={(e) => setValores({ ...valores, c: e.target.value })} />
        </label>
        <label className="campo">
          <span>Grasas (g)</span>
          <input inputMode="decimal" value={valores.f} onChange={(e) => setValores({ ...valores, f: e.target.value })} />
        </label>
      </div>
      <label className="campo">
        <span>Gramos que te comes</span>
        <input inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} />
      </label>
      <p className="resumen-racion" aria-live="polite">
        {r ? `${kcal(r.kcal)} kcal · ${gramos(r.protein)} g proteína` : 'Faltan las calorías o los gramos'}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="boton-principal ancho" disabled={!r || guardando || leyendo}>
        {guardando ? 'Añadiendo…' : estado.alimento ? 'Añadir' : 'Guardar en la despensa y añadir'}
      </button>
    </form>
  )
}

/** Los iPhone no enfocan de cerca con la cámara normal: con un poco de zoom se puede escanear desde más lejos. */
async function acercar(pista: MediaStreamTrack) {
  try {
    const c = pista.getCapabilities?.() as { zoom?: { min: number; max: number }; focusMode?: string[] } | undefined
    const ajustes: Record<string, unknown>[] = []
    if (c?.zoom && c.zoom.max > 1) ajustes.push({ zoom: Math.min(2, c.zoom.max) })
    if (c?.focusMode?.includes('continuous')) ajustes.push({ focusMode: 'continuous' })
    if (ajustes.length) await pista.applyConstraints({ advanced: ajustes as MediaTrackConstraintSet[] })
  } catch {
    // sin zoom también funciona
  }
}

/** Vídeo de la cámara trasera que avisa al reconocer un código de barras. */
function Camara({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const aviso = useRef(onCodigo)
  useEffect(() => {
    aviso.current = onCodigo
  })

  useEffect(() => {
    let flujo: MediaStream | null = null
    let parar = false
    let temporizador = 0

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no deja usar la cámara aquí.')
        // Sin pedir tamaño, el navegador da 640×480 y los códigos pequeños no se leen
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (parar || !video.current) {
          flujo.getTracks().forEach((t) => t.stop())
          return
        }
        await acercar(flujo.getVideoTracks()[0])
        video.current.srcObject = flujo
        await video.current.play()
        const { crearLector } = await import('../lib/codigos')
        const lector = crearLector()
        let anterior = ''
        const mirar = async () => {
          if (parar || !video.current) return
          try {
            const [c] = await lector.detect(video.current)
            const codigo = c && codigoValido(c.rawValue) ? c.rawValue : ''
            // Dos lecturas iguales seguidas, para no dar por buena una equivocada
            const seguro = codigo !== '' && codigo === anterior
            if (codigo) anterior = codigo
            if (seguro && !parar) {
              parar = true
              navigator.vibrate?.(60)
              aviso.current(codigo)
              return
            }
          } catch {
            // un fotograma ilegible no es un error
          }
          temporizador = window.setTimeout(mirar, 120)
        }
        mirar()
      } catch (e) {
        const err = e as Error
        setFallo(
          err.name === 'NotAllowedError'
            ? 'No hay permiso para la cámara. Actívalo en los ajustes del navegador o escribe el código.'
            : err.message || 'No se ha podido abrir la cámara.',
        )
      }
    })()

    return () => {
      parar = true
      clearTimeout(temporizador)
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="camara">
      {fallo ? (
        <p className="camara-fallo">{fallo}</p>
      ) : (
        <>
          <video ref={video} playsInline muted aria-label="Vista de la cámara" />
          <span className="camara-marco" aria-hidden="true" />
          <p className="camara-texto">Apunta al código de barras</p>
        </>
      )}
    </div>
  )
}
