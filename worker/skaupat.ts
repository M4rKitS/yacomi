/** Saca los valores por 100 g de una página de producto de S-kaupat. Devuelve null si no los trae. */
export function leerFichaS(html: string, codigo: string) {
  // Solo la parte de la página que describe este código, no la de los productos relacionados
  const ini = html.indexOf(`"ean":"${codigo}"`)
  if (ini < 0) return null
  const det = html.indexOf('"productDetails":{', ini)
  const otro = html.indexOf('"ean":"', ini + 10)
  if (det < 0 || (otro > 0 && otro < det)) return null
  const bloque = html.slice(det, otro > 0 ? otro : det + 20_000)

  const numero = (t: string | undefined, unidad: string) => {
    const m = t?.match(new RegExp(`([\\d\\s\\u00a0.,]*\\d)\\s*${unidad}\\b`, 'i'))
    if (!m) return null
    const v = Number(m[1].replace(/[\s\u00a0]/g, '').replace(',', '.'))
    return Number.isFinite(v) ? v : null
  }
  for (const g of bloque.matchAll(/"nutrients":\[((?:\{"__typename":"ProductNutrient",[^{}]*\},?)+)\],"referenceQuantity":"([^"]*)"/g)) {
    const base = g[2].match(/^([\d.,]+)\s*(?:g|ml)/i)
    const cantidad = base ? Number(base[1].replace(',', '.')) : NaN
    if (!(cantidad > 0)) continue
    const v = new Map([...g[1].matchAll(/"name":"([^"]*)","value":"([^"]*)"/g)].map((m) => [m[1].toLowerCase(), m[2]]))
    const kj = numero(v.get('energia'), 'kJ')
    const kcal = numero(v.get('energia'), 'kcal') ?? (kj == null ? null : kj / 4.184)
    // Fichas de relleno («1 kJ / 1 kcal»): una caloría son unos 4,2 kJ
    if (kcal == null || (kj != null && kj < kcal * 3)) continue
    const por100 = (n: number | null) => (n == null ? null : Math.round((n * 1000) / cantidad) / 10)
    const p = {
      kcal_100g: por100(kcal),
      protein_100g: por100(numero(v.get('proteiinia'), 'g')),
      carbs_100g: por100(numero(v.get('hiilihydraattia'), 'g')),
      fat_100g: por100(numero(v.get('rasvaa'), 'g')),
    }
    // En los productos a granel a veces ponen todo a cero: eso no es un dato
    if (codigo.startsWith('2') && !p.kcal_100g && !p.protein_100g && !p.fat_100g) continue
    const titulo = html.match(/data-test-id="product-name"[^>]*>([^<]+)</)?.[1] ?? ''
    const nombre = titulo.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim()
    return { nombre: nombre || `Producto ${codigo}`, ...p }
  }
  return null
}
