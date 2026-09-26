/**
 * SISTEMA BL — Script maestro de formateo v2
 *
 * Reemplaza google_apps_script_causas.js
 *
 * Cómo instalar:
 *  1. Google Sheet → Extensiones → Apps Script
 *  2. Crea un nuevo archivo y pega TODO este código
 *  3. Guarda (Ctrl+S)
 *  4. Menú "📋 Sistema BL" → Reformatear TODAS las hojas
 *
 * Qué hace:
 *  - Lee los datos existentes de cada hoja (sin perder nada)
 *  - Detecta automáticamente las secciones (Contacto, Seguimiento, SIAU, PJUD)
 *  - Reconstruye cada hoja con el estándar de 5 módulos
 *  - Aplica la misma colorimetría y formato en todas las hojas
 */

// ─── Columnas ─────────────────────────────────────────────────────────────────

const COL = {
  MARGEN:      1,   // A
  FECHA:       2,   // B  FECHA / CAMPO
  FOLIO:       3,   // C  FOLIO / DETALLE (en tablas simples: fusionar C-G)
  SOLICITUD:   4,   // D  SOLICITUD / TAREA / ACTUACIÓN
  RESPUESTA:   5,   // E  RESPUESTA / ESTADO / RESULTADO
  DOCUMENTOS:  6,   // F  DOCUMENTOS / PRÓXIMA ACTUACIÓN
  NOTAS:       7,   // G  NOTAS / OBSERVACIONES
  TOTAL:       7,
}

// ─── Paleta BL ────────────────────────────────────────────────────────────────

const CLR = {
  HEADER_BG:    '#1a2e4a',
  HEADER_TEXT:  '#ffffff',
  SUBHEADER_BG: '#2570ba',
  FILA_IMPAR:   '#f8faff',
  FILA_PAR:     '#ffffff',
  BORDE:        '#dde3ed',
  SECCION_BG:   '#e8f0fa',
  SECCION_TEXT: '#1a2e4a',
  VERDE:        '#d1fae5',
  VERDE_TEXT:   '#065f46',
  ROJO:         '#fee2e2',
  ROJO_TEXT:    '#991b1b',
  AMARILLO:     '#fef9c3',
  AMARILLO_TEXT:'#854d0e',
  AZUL_CLARO:   '#dbeafe',
  AZUL_TEXT:    '#1d4ed8',
}

// ─── Estructura fija de filas ─────────────────────────────────────────────────

const FILAS = {
  TITULO:       1,
  // 2: vacía
  SEC1:         3,   HEADER1:   4,   DATA1_INI: 5,    // Resumen causa (14 filas → 5-18)
  // 19-23: vacías
  SEC2:        24,   HEADER2:  25,   DATA2_INI: 26,   // Contacto (4 filas → 26-29)
  // 30-34: vacías
  SEC3:        35,   HEADER3:  36,   DATA3_INI: 37,   // Seguimiento (variable)
  // +5 vacías después del último dato
  // SEC4 calculado dinámicamente en función del tamaño de seguimiento
  // SEC5 calculado dinámicamente en función del tamaño de SIAU
}

// ─── Nombres de hojas que NO son de causa individual ─────────────────────────

const HOJAS_PRINCIPALES = ['principal', 'dashboard', 'index', 'inicio', 'resumen general']

// ═════════════════════════════════════════════════════════════════════════════
// MENÚ
// ═════════════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Sistema BL')
    .addItem('✨ Reformatear TODAS las hojas',    'reformatearTodas')
    .addSeparator()
    .addItem('📄 Reformatear hoja activa',        'reformatearActiva')
    .addItem('🗂 Reformatear solo Principal',     'reformatearPrincipalSola')
    .addSeparator()
    .addItem('➕ Nueva hoja de causa (plantilla)', 'crearHojaNueva')
    .addToUi()
}

// ═════════════════════════════════════════════════════════════════════════════
// PUNTOS DE ENTRADA
// ═════════════════════════════════════════════════════════════════════════════

function reformatearTodas() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  const hojas = ss.getSheets()
  let ok = 0, err = 0, errores = []

  hojas.forEach(hoja => {
    try {
      _reformatearHoja(hoja)
      ok++
    } catch(e) {
      err++
      errores.push(hoja.getName() + ': ' + e.message)
    }
  })

  const msg = `✅ ${ok} hoja(s) reformateadas correctamente.` +
    (err > 0 ? `\n\n⚠ ${err} error(es):\n${errores.join('\n')}` : '')
  SpreadsheetApp.getUi().alert('Resultado', msg, SpreadsheetApp.getUi().ButtonSet.OK)
}

function reformatearActiva() {
  const hoja = SpreadsheetApp.getActiveSheet()
  try {
    _reformatearHoja(hoja)
    SpreadsheetApp.getUi().alert('✅ Hoja "' + hoja.getName() + '" reformateada.')
  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.message)
  }
}

function reformatearPrincipalSola() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet()
  const hoja = ss.getSheets().find(h => HOJAS_PRINCIPALES.includes(h.getName().toLowerCase()))
            || ss.getSheets()[0]
  _reformatearPrincipal(hoja)
  SpreadsheetApp.getUi().alert('✅ Hoja Principal reformateada.')
}

function crearHojaNueva() {
  const ui   = SpreadsheetApp.getUi()
  const resp = ui.prompt('➕ Nueva hoja de causa', 'Nombre (ej: JUAN PÉREZ):', ui.ButtonSet.OK_CANCEL)
  if (resp.getSelectedButton() !== ui.Button.OK) return
  const nombre = resp.getResponseText().trim().toUpperCase()
  if (!nombre) return

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  if (ss.getSheetByName(nombre)) { ui.alert('⚠ Ya existe una hoja con ese nombre.'); return }

  const hoja = ss.insertSheet(nombre)
  _escribirPlantillaVacia(hoja, nombre)
  ui.alert('✅ Hoja "' + nombre + '" creada con plantilla en blanco.')
  ss.setActiveSheet(hoja)
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function _reformatearHoja(hoja) {
  const nombre = hoja.getName().toLowerCase()
  if (HOJAS_PRINCIPALES.includes(nombre)) {
    _reformatearPrincipal(hoja)
  } else {
    _reformatearCausa(hoja)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// REFORMATEAR HOJA DE CAUSA  (lógica principal)
// ═════════════════════════════════════════════════════════════════════════════

function _reformatearCausa(hoja) {
  // 1. Leer y parsear los datos existentes
  const parsed = _parsearHoja(hoja)

  // 2. Limpiar hoja
  hoja.setFrozenRows(0)
  hoja.setFrozenColumns(0)
  hoja.clear()
  hoja.clearConditionalFormatRules()
  try { hoja.getFilter().remove() } catch(e) {}

  // Garantizar filas suficientes
  const filasNecesarias = 120 + parsed.seguimiento.length + parsed.siau.length + parsed.pjud.length
  if (hoja.getMaxRows() < filasNecesarias) {
    hoja.insertRowsAfter(hoja.getMaxRows(), filasNecesarias - hoja.getMaxRows())
  }

  // 3. Anchos de columna
  hoja.setColumnWidth(COL.MARGEN,     22)
  hoja.setColumnWidth(COL.FECHA,     112)
  hoja.setColumnWidth(COL.FOLIO,     130)
  hoja.setColumnWidth(COL.SOLICITUD, 285)
  hoja.setColumnWidth(COL.RESPUESTA, 205)
  hoja.setColumnWidth(COL.DOCUMENTOS,142)
  hoja.setColumnWidth(COL.NOTAS,     142)

  // 4. Módulo 0 — Título principal
  _tituloPrincipal(hoja, FILAS.TITULO, parsed.nombreCliente || hoja.getName())

  // 5. Módulo 1 — Resumen de la causa
  _tituloSeccion(hoja, FILAS.SEC1, 'RESUMEN DE LA CAUSA')
  _headersSimple(hoja, FILAS.HEADER1)
  _tablaSimple(hoja, FILAS.DATA1_INI, _construirResumen(parsed))

  // 6. Módulo 2 — Datos de contacto
  _tituloSeccion(hoja, FILAS.SEC2, 'DATOS DE CONTACTO')
  _headersSimple(hoja, FILAS.HEADER2)
  _tablaSimple(hoja, FILAS.DATA2_INI, _construirContacto(parsed.contacto))

  // 7. Módulo 3 — Seguimiento Semanal
  _tituloSeccion(hoja, FILAS.SEC3, 'SEGUIMIENTO SEMANAL')
  _headersTabla(hoja, FILAS.HEADER3, 4, ['FECHA', 'TAREA', 'ESTADO', 'NOTAS'])

  const dataSeg = parsed.seguimiento.length > 0 ? parsed.seguimiento : [['', '', '', '']]
  _tablaConDatos(hoja, FILAS.DATA3_INI, dataSeg, 4)
  _formatoCondicionalEstado(hoja, FILAS.DATA3_INI, dataSeg.length, COL.RESPUESTA)

  // Filtro activo en Seguimiento (único filtro por hoja en Google Sheets)
  const finSeg = FILAS.DATA3_INI + dataSeg.length - 1
  hoja.getRange(FILAS.HEADER3, COL.FECHA, finSeg - FILAS.HEADER3 + 1, 4).createFilter()

  // 8. Módulo 4 — SIAU  (empieza 6 filas después del último dato de seguimiento)
  const iniSec4 = finSeg + 6
  _tituloSeccion(hoja, iniSec4, 'MOVIMIENTOS SIAU')
  _headersTabla(hoja, iniSec4 + 1, 6, ['FECHA', 'FOLIO', 'SOLICITUD', 'RESPUESTA', 'DOCUMENTOS', 'NOTAS'])

  const dataSiau = parsed.siau.length > 0 ? parsed.siau : [['', '', '', '', '', '']]
  _tablaConDatos(hoja, iniSec4 + 2, dataSiau, 6)

  // 9. Módulo 5 — PJUD
  const finSiau  = iniSec4 + 2 + dataSiau.length - 1
  const iniSec5  = finSiau + 6
  _tituloSeccion(hoja, iniSec5, 'CONSULTAS PJUD')
  _headersTabla(hoja, iniSec5 + 1, 6,
    ['FECHA', 'N° FOLIO', 'ACTUACIÓN / RESOLUCIÓN', 'RESULTADO', 'PRÓXIMA ACTUACIÓN', 'OBSERVACIONES'])

  const dataPjud = parsed.pjud.length > 0 ? parsed.pjud : [['', '', '', '', '', '']]
  _tablaConDatos(hoja, iniSec5 + 2, dataPjud, 6)

  // 10. Congelar título
  hoja.setFrozenRows(1)
  SpreadsheetApp.flush()
}

// ═════════════════════════════════════════════════════════════════════════════
// EXTRACCIÓN DE DATOS  (detecta automáticamente la estructura existente)
// ═════════════════════════════════════════════════════════════════════════════

function _parsearHoja(hoja) {
  const lastRow = hoja.getLastRow()
  const lastCol = Math.max(hoja.getLastColumn(), 10)
  if (lastRow < 2) return _parsedVacio(hoja.getName())

  const vals = hoja.getRange(1, 1, lastRow, lastCol).getValues()

  // ── Paso 1: localizar índices de inicio de cada sección ──────────────────
  const SEC = { CONTACTO: -1, CAUSA: -1, SEGUIMIENTO: -1, SIAU: -1, PJUD: -1 }

  vals.forEach((fila, i) => {
    const t = fila.slice(0, 12).join(' ').toLowerCase().replace(/[^\w\s]/g, ' ')
    if (SEC.CONTACTO   < 0 && /datos\s+contacto|datos\s+del\s+cliente/.test(t))      SEC.CONTACTO   = i
    if (SEC.CAUSA      < 0 && /(causa\s+ruc|causa\s+rit|datos\s+(de\s+la\s+)?causa)/.test(t)) SEC.CAUSA = i
    if (SEC.SEGUIMIENTO< 0 && /seguimiento\s+semanal|seguimiento/.test(t))            SEC.SEGUIMIENTO= i
    if (SEC.SIAU       < 0 && /movimientos?\s+siau|siau/.test(t))                     SEC.SIAU       = i
    if (SEC.PJUD       < 0 && /movimientos?\s+pjud|consultas?\s+pjud|pjud/.test(t))  SEC.PJUD       = i
  })

  // Helper: fila de inicio de la siguiente sección (para delimitar extracción)
  function nextSec(desde) {
    const candidatos = Object.values(SEC).filter(v => v > desde)
    return candidatos.length > 0 ? Math.min(...candidatos) : vals.length
  }

  // ── Paso 2: nombre del cliente ────────────────────────────────────────────
  let nombreCliente = ''
  const limiteNombre = SEC.CONTACTO >= 0 ? SEC.CONTACTO : Math.min(SEC.CAUSA, 6)
  for (let i = 0; i < Math.min(limiteNombre, 6); i++) {
    const v = (vals[i][1] || '').toString().trim()
    if (v && v.length > 3 && !/rut|celular|correo|cliente|fecha|folio/i.test(v)) {
      nombreCliente = v
      break
    }
  }

  // ── Paso 3: datos de contacto (pares clave-valor) ─────────────────────────
  const contacto = {}
  if (SEC.CONTACTO >= 0) {
    const fin = nextSec(SEC.CONTACTO)
    for (let i = SEC.CONTACTO + 1; i < fin; i++) {
      const k = (vals[i][1] || '').toString().trim()
      const v = (vals[i][2] || '').toString().trim()
      if (k && v && !/fecha|folio|solicitud|parte|tribunal/i.test(k)) {
        contacto[_normalizarClave(k)] = v
      }
    }
  }

  // ── Paso 4: datos de la causa (1 header + 1 fila de datos) ───────────────
  const causa = {}
  if (SEC.CAUSA >= 0) {
    const fin = nextSec(SEC.CAUSA)
    let headers = null
    for (let i = SEC.CAUSA + 1; i < fin; i++) {
      const fila = vals[i]
      if (!fila.slice(1, 10).some(v => v !== null && v !== '' && v !== undefined)) continue
      if (!headers) {
        headers = fila.slice(1, 10).map(v => _normalizarClave((v || '').toString()))
      } else {
        headers.forEach((h, ci) => {
          if (h) causa[h] = _limpiarTexto(fila[ci + 1])
        })
        break
      }
    }
  }

  // ── Paso 5: tablas dinámicas ──────────────────────────────────────────────
  function extraerTabla(secIdx, numCols) {
    const tabla = []
    if (secIdx < 0) return tabla
    const fin = nextSec(secIdx)
    let skipHeaders = true  // la primera fila de datos es la de encabezados → ignorar

    for (let i = secIdx + 1; i < fin; i++) {
      const fila = vals[i]
      const tieneData = fila.slice(1, numCols + 2).some(v =>
        v !== null && v !== undefined && v.toString().trim() !== ''
      )
      if (!tieneData) continue

      if (skipHeaders) {
        skipHeaders = false
        continue  // saltar fila de headers (se reemplazarán con los estándar)
      }

      const row = []
      for (let c = 1; c <= numCols; c++) {
        const cel = fila[c]
        if (cel instanceof Date) {
          row.push(Utilities.formatDate(cel, Session.getScriptTimeZone(), 'dd/MM/yyyy'))
        } else {
          row.push(_limpiarTexto(cel))
        }
      }
      if (row.some(v => v !== '')) tabla.push(row)
    }
    return tabla
  }

  const seguimiento = extraerTabla(SEC.SEGUIMIENTO, 4)
  const siau        = extraerTabla(SEC.SIAU, 6)
  const pjud        = extraerTabla(SEC.PJUD, 6)

  return { nombreCliente, contacto, causa, seguimiento, siau, pjud }
}

// ─── Construir arrays para los módulos de resumen ────────────────────────────

function _construirResumen(parsed) {
  const c = parsed.causa    || {}
  const ct = parsed.contacto || {}

  // Última gestión SIAU
  const ultimoSIAU = parsed.siau.length > 0
    ? (parsed.siau[parsed.siau.length - 1][0] || '') +
      ' – ' + (parsed.siau[parsed.siau.length - 1][2] || '').slice(0, 60)
    : '—'

  // Última gestión PJUD
  const ultimoPJUD = parsed.pjud.length > 0
    ? (parsed.pjud[parsed.pjud.length - 1][0] || '') +
      ' – ' + (parsed.pjud[parsed.pjud.length - 1][2] || '').slice(0, 60)
    : '—'

  // Próxima audiencia: buscar mención en las notas del seguimiento (de reciente a antiguo)
  let proximaAudiencia = '⚠ Completar manualmente'
  for (let i = parsed.seguimiento.length - 1; i >= 0; i--) {
    const notas  = (parsed.seguimiento[i][3] || '')
    const estado = (parsed.seguimiento[i][2] || '')
    const texto  = notas + ' ' + estado
    if (/pr[oó]xima\s+audiencia|pr[oó]xim[ao]/i.test(texto) && texto.trim().length > 5) {
      proximaAudiencia = texto.trim().slice(0, 100)
      break
    }
  }

  return [
    ['Cliente',             parsed.nombreCliente || '—'],
    ['RUT',                 ct['RUT'] || ct['RUT_CLIENTE'] || '—'],
    ['Parte procesal',      c['PARTE'] || '—'],
    ['RUC',                 c['RUC'] || '—'],
    ['RIT',                 c['RIT'] || '—'],
    ['Tribunal',            c['TRIBUNAL'] || '—'],
    ['Fiscalía',            c['FISCALÍA'] || c['FISCALIA'] || '—'],
    ['Área',                c['ÁREA'] || c['AREA'] || '—'],
    ['Materia',             c['MATERIA'] || '—'],
    ['Estado procesal',     c['ETAPA PROCESAL'] || c['ESTADO'] || '—'],
    ['Próxima audiencia',   proximaAudiencia],
    ['Última gestión SIAU', ultimoSIAU],
    ['Última gestión PJUD', ultimoPJUD],
    ['Responsable',         ''],
  ]
}

function _construirContacto(contacto) {
  // Mapeo de claves normalizadas a etiquetas estándar
  const MAPA = {
    'RUT':          'RUT',
    'CELULAR':      'Celular',
    'TELEFONO':     'Celular',
    'CORREO':       'Correo',
    'EMAIL':        'Correo',
    'CLAVE_UNICA':  'Clave Única',
    'CLAVE':        'Clave Única',
    'CLAVE UNICA':  'Clave Única',
    'DIRECCION':    'Dirección',
    'DIRECCIÓN': 'Dirección',
  }

  const resultado = []
  const yaUsados  = new Set()

  // Primero insertar en orden preferido
  const ordenPreferido = ['RUT', 'CELULAR', 'CORREO', 'CLAVE_UNICA', 'DIRECCION']
  ordenPreferido.forEach(clave => {
    if (contacto[clave] && !yaUsados.has(clave)) {
      resultado.push([MAPA[clave] || clave, contacto[clave]])
      yaUsados.add(clave)
    }
  })

  // Agregar el resto
  Object.entries(contacto).forEach(([k, v]) => {
    if (!yaUsados.has(k) && v) {
      resultado.push([MAPA[k] || k, v])
    }
  })

  return resultado.length > 0 ? resultado : [['—', '—']]
}

// ─── Utilidades de texto ──────────────────────────────────────────────────────

function _normalizarClave(texto) {
  return texto.toString().trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar tildes
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
}

function _limpiarTexto(v) {
  if (v === null || v === undefined) return ''
  return v.toString().trim().replace(/\s+/g, ' ')
}

function _parsedVacio(nombre) {
  return { nombreCliente: nombre, contacto: {}, causa: {}, seguimiento: [], siau: [], pjud: [] }
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA VACÍA  (para crear nuevas hojas)
// ═════════════════════════════════════════════════════════════════════════════

function _escribirPlantillaVacia(hoja, nombre) {
  const parsed = _parsedVacio(nombre)
  parsed.seguimiento = [['', '', '', '']]
  parsed.siau        = [['', '', '', '', '', '']]
  parsed.pjud        = [['', '', '', '', '', '']]
  _reformatearCausa(hoja)
}

// ═════════════════════════════════════════════════════════════════════════════
// HOJA PRINCIPAL / DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

function _reformatearPrincipal(hoja) {
  const COLS_PRINCIPAL = [
    'CLIENTE', 'RUT', 'RUC / RIT', 'TRIBUNAL', 'FISCALÍA',
    'ÁREA', 'MATERIA', 'ESTADO', 'RESPONSABLE',
    'PRÓXIMA AUDIENCIA', 'ÚLTIMA REVISIÓN', 'PRÓXIMA ACCIÓN', 'HOJA',
  ]
  const N = COLS_PRINCIPAL.length

  // Leer datos existentes (a partir de la fila 3)
  const lastRow = Math.max(hoja.getLastRow(), 2)
  const rawData = lastRow > 2 ? hoja.getRange(3, 1, lastRow - 2, Math.max(hoja.getLastColumn(), N)).getValues() : []

  // Limpiar
  hoja.setFrozenRows(0)
  hoja.setFrozenColumns(0)
  hoja.clear()
  hoja.clearConditionalFormatRules()
  try { hoja.getFilter().remove() } catch(e) {}
  if (hoja.getMaxRows() < rawData.length + 10) {
    hoja.insertRowsAfter(hoja.getMaxRows(), rawData.length + 10)
  }

  // Anchos
  const anchos = [180, 110, 150, 160, 120, 90, 200, 120, 90, 160, 110, 160, 80]
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w))

  // Fila 1: Título
  hoja.setRowHeight(1, 50)
  const tRng = hoja.getRange(1, 1, 1, N)
  try { tRng.breakApart() } catch(e) {}
  tRng.merge()
    .setValue('   REGISTRO DE CAUSAS — BIANCHILEIVA')
    .setBackground(CLR.HEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')

  // Fila 2: Headers
  hoja.setRowHeight(2, 30)
  hoja.getRange(2, 1, 1, N)
    .setValues([COLS_PRINCIPAL])
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
    .setBorder(true, true, true, true, true, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)

  hoja.setFrozenRows(2)
  hoja.setFrozenColumns(2)

  // Filas de datos
  if (rawData.length > 0) {
    rawData.forEach((fila, idx) => {
      const f  = idx + 3
      const bg = idx % 2 === 0 ? CLR.FILA_IMPAR : CLR.FILA_PAR
      hoja.setRowHeight(f, 26)

      // Escribir hasta N columnas (rellenar con '' si hay menos)
      const row = Array.from({ length: N }, (_, c) => fila[c] !== undefined ? fila[c] : '')
      hoja.getRange(f, 1, 1, N)
        .setValues([row])
        .setBackground(bg)
        .setFontSize(9.5)
        .setFontFamily('Arial')
        .setVerticalAlignment('middle')
        .setBorder(null, true, null, true, false, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
    })

    // Borde inferior tabla
    const ultimaFila = 2 + rawData.length
    hoja.getRange(ultimaFila, 1, 1, N)
      .setBorder(null, true, true, true, false, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
  }

  // Validaciones de estado (col 8)
  const nDatos = Math.max(rawData.length, 1)
  hoja.getRange(3, 8, nDatos, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['En tramitación', 'Abierta', 'Terminada', 'Archivada', 'Suspendida'], true)
      .setAllowInvalid(true).build()
  )

  // Formato condicional: ESTADO (col 8)
  const rEstado = hoja.getRange(3, 8, nDatos, 1)
  const reglasP = [
    { v: 'En tramitación', bg: CLR.AZUL_CLARO,  t: CLR.AZUL_TEXT    },
    { v: 'Abierta',        bg: CLR.VERDE,        t: CLR.VERDE_TEXT   },
    { v: 'Terminada',      bg: CLR.ROJO,         t: CLR.ROJO_TEXT    },
    { v: 'Archivada',      bg: CLR.ROJO,         t: '#7f1d1d'        },
    { v: 'Suspendida',     bg: CLR.AMARILLO,     t: CLR.AMARILLO_TEXT},
  ]
  hoja.setConditionalFormatRules(
    reglasP.map(({ v, bg, t }) =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(v).setBackground(bg).setFontColor(t).setRanges([rEstado]).build()
    )
  )

  // Filtro
  hoja.getRange(2, 1, nDatos + 1, N).createFilter()
  SpreadsheetApp.flush()
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE FORMATO  (compartidas por todos los módulos)
// ═════════════════════════════════════════════════════════════════════════════

function _tituloPrincipal(hoja, fila, texto) {
  hoja.setRowHeight(fila, 50)
  const rng = hoja.getRange(fila, COL.MARGEN, 1, COL.TOTAL + 1)
  try { rng.breakApart() } catch(e) {}
  rng.merge()
    .setValue('   ' + texto.toUpperCase())
    .setBackground(CLR.HEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
}

function _tituloSeccion(hoja, fila, texto) {
  hoja.setRowHeight(fila, 30)
  const rng = hoja.getRange(fila, COL.FECHA, 1, COL.TOTAL - 1)
  try { rng.breakApart() } catch(e) {}
  rng.merge()
    .setValue('  ▸  ' + texto)
    .setBackground(CLR.SECCION_BG)
    .setFontColor(CLR.SECCION_TEXT)
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
    .setBorder(false, true, true, true, false, false,
               CLR.HEADER_BG, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
}

function _headersSimple(hoja, fila) {
  hoja.setRowHeight(fila, 26)
  hoja.getRange(fila, COL.FECHA)
    .setValue('CAMPO')
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')

  const det = hoja.getRange(fila, COL.FOLIO, 1, COL.TOTAL - 2)
  try { det.breakApart() } catch(e) {}
  det.merge()
    .setValue('DETALLE')
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
    .setBorder(true, true, true, true, false, false, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

function _headersTabla(hoja, fila, numCols, etiquetas) {
  hoja.setRowHeight(fila, 28)
  hoja.getRange(fila, COL.FECHA, 1, numCols)
    .setValues([etiquetas])
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
    .setBorder(true, true, true, true, true, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

function _tablaSimple(hoja, filaInicio, datos) {
  datos.forEach((par, idx) => {
    const f  = filaInicio + idx
    const bg = idx % 2 === 0 ? CLR.FILA_IMPAR : CLR.FILA_PAR
    hoja.setRowHeight(f, 24)

    hoja.getRange(f, COL.FECHA)
      .setValue(par[0])
      .setBackground(bg)
      .setFontSize(9.5)
      .setFontWeight('bold')
      .setFontColor(CLR.SECCION_TEXT)
      .setVerticalAlignment('middle')
      .setFontFamily('Arial')

    const det = hoja.getRange(f, COL.FOLIO, 1, COL.TOTAL - 2)
    try { det.breakApart() } catch(e) {}
    det.merge()
      .setValue(par[1])
      .setBackground(bg)
      .setFontSize(9.5)
      .setFontColor('#1a1a2e')
      .setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setFontFamily('Arial')

    hoja.getRange(f, COL.FECHA, 1, COL.TOTAL - 1)
      .setBorder(null, true, null, true, false, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
  })
  const ul = filaInicio + datos.length - 1
  hoja.getRange(ul, COL.FECHA, 1, COL.TOTAL - 1)
    .setBorder(null, true, true, true, false, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

function _tablaConDatos(hoja, filaInicio, datos, numCols) {
  datos.forEach((fila, idx) => {
    const f  = filaInicio + idx
    const bg = idx % 2 === 0 ? CLR.FILA_IMPAR : CLR.FILA_PAR

    for (let c = 0; c < numCols; c++) {
      hoja.getRange(f, COL.FECHA + c)
        .setValue(fila[c] || '')
        .setBackground(bg)
        .setFontSize(9)
        .setFontFamily('Arial')
        .setVerticalAlignment('top')
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    }
    hoja.getRange(f, COL.FECHA, 1, numCols)
      .setBorder(null, true, null, true, false, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)

    // Fechas: col B
    hoja.getRange(f, COL.FECHA).setNumberFormat('DD/MM/YYYY')

    // Folios: monoespaciado (col C)
    hoja.getRange(f, COL.FOLIO).setFontFamily('Courier New').setFontSize(8.5)
  })

  const ul = filaInicio + datos.length - 1
  hoja.getRange(ul, COL.FECHA, 1, numCols)
    .setBorder(null, true, true, true, false, true, CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

function _formatoCondicionalEstado(hoja, filaInicio, numFilas, columna) {
  const rng    = hoja.getRange(filaInicio, columna, numFilas, 1)
  const reglas = hoja.getConditionalFormatRules()

  const colores = [
    { t: 'Listo',           bg: CLR.VERDE,    text: CLR.VERDE_TEXT    },
    { t: 'Completado',      bg: CLR.VERDE,    text: CLR.VERDE_TEXT    },
    { t: 'Aceptada',        bg: CLR.VERDE,    text: CLR.VERDE_TEXT    },
    { t: 'En proceso',      bg: CLR.AZUL_CLARO, text: CLR.AZUL_TEXT  },
    { t: 'Plazo ampliado',  bg: CLR.AZUL_CLARO, text: CLR.AZUL_TEXT  },
    { t: 'No ha llegado',   bg: CLR.ROJO,     text: CLR.ROJO_TEXT     },
    { t: 'Cancelado',       bg: CLR.ROJO,     text: CLR.ROJO_TEXT     },
    { t: 'Pendiente',       bg: CLR.AMARILLO, text: CLR.AMARILLO_TEXT },
    { t: 'Volver a pedir',  bg: CLR.AMARILLO, text: CLR.AMARILLO_TEXT },
    { t: 'No ha lugar',     bg: CLR.ROJO,     text: CLR.ROJO_TEXT     },
    { t: 'Aprobada',        bg: CLR.VERDE,    text: CLR.VERDE_TEXT    },
  ]

  colores.forEach(({ t, bg, text }) => {
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains(t)
        .setBackground(bg)
        .setFontColor(text)
        .setRanges([rng])
        .build()
    )
  })

  hoja.setConditionalFormatRules(reglas)
}
