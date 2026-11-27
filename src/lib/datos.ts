import * as local from './datosInvitado'
import * as nube from './datosNube'
import { esInvitado } from './invitado'

export { calcularRacha, racion, totalesPlato } from './calculos'

type Fuente = typeof nube

// El invitado guarda en su dispositivo; con cuenta se guarda en Supabase
const enLocal: Fuente = local

function con<K extends keyof Fuente>(nombre: K): Fuente[K] {
  return ((...a: unknown[]) => ((esInvitado() ? enLocal : nube)[nombre] as (...x: unknown[]) => unknown)(...a)) as Fuente[K]
}

export const cargarObjetivos = con('cargarObjetivos')
export const guardarObjetivos = con('guardarObjetivos')
export const cargarComidasDe = con('cargarComidasDe')
export const cargarResumen = con('cargarResumen')
export const cargarRecientes = con('cargarRecientes')
export const anadirComida = con('anadirComida')
export const actualizarComida = con('actualizarComida')
export const restaurarComida = con('restaurarComida')
export const borrarComida = con('borrarComida')
export const cargarAlimentos = con('cargarAlimentos')
export const guardarAlimento = con('guardarAlimento')
export const borrarAlimento = con('borrarAlimento')
export const contarComidasDeAlimento = con('contarComidasDeAlimento')
export const corregirComidasDeAlimento = con('corregirComidasDeAlimento')
export const cargarPesos = con('cargarPesos')
export const guardarPeso = con('guardarPeso')
export const borrarPeso = con('borrarPeso')
export const cargarMedidas = con('cargarMedidas')
export const guardarMedida = con('guardarMedida')
export const borrarMedida = con('borrarMedida')
export const cargarPlatos = con('cargarPlatos')
export const guardarPlato = con('guardarPlato')
export const borrarPlato = con('borrarPlato')
