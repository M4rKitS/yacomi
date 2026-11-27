const control = (cuerpo: string) => {
  let s = 0
  for (let i = 0; i < cuerpo.length; i++) s += Number(cuerpo[cuerpo.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  return String((10 - (s % 10)) % 10)
}

/** El último dígito de un código de barras se calcula con los demás: así se detecta una mala lectura. */
export const digitoCorrecto = (c: string) => /^(\d{8}|\d{12,14})$/.test(c) && control(c.slice(0, -1)) === c.slice(-1)

/** UPC-E (8 cifras, versión corta americana) pasado a UPC-A (12 cifras). */
function expandirUpcE(c: string): string | null {
  if (!/^[01]\d{7}$/.test(c)) return null
  const [n, d1, d2, d3, d4, d5, d6, k] = c
  const medio =
    d6 <= '2'
      ? `${d1}${d2}${d6}0000${d3}${d4}${d5}`
      : d6 === '3'
        ? `${d1}${d2}${d3}00000${d4}${d5}`
        : d6 === '4'
          ? `${d1}${d2}${d3}${d4}00000${d5}`
          : `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  const largo = `${n}${medio}${k}`
  return digitoCorrecto(largo) ? largo : null
}

/** Deja el código en su forma estándar: 13 cifras, u 8 si es un EAN-8. */
export function normalizarCodigo(c: string): string {
  const s = c.replace(/\D/g, '')
  if (s.length === 8 && !digitoCorrecto(s)) {
    const largo = expandirUpcE(s)
    if (largo) return `0${largo}`
  }
  return s.length === 12 ? `0${s}` : s
}

export const codigoValido = (c: string) => digitoCorrecto(normalizarCodigo(c))

/**
 * Códigos con los que buscar un producto. Los de peso variable (empiezan por 2) llevan el peso dentro,
 * así que también se prueba el mismo código con el peso a cero.
 */
export function candidatos(c: string): string[] {
  const s = normalizarCodigo(c)
  if (!/^2\d{12}$/.test(s)) return [s]
  const base = `${s.slice(0, 7)}00000`
  const sinPeso = base + control(base)
  return sinPeso === s ? [s] : [s, sinPeso]
}
