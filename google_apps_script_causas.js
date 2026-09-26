/**
 * SCRIPT PARA MEJORAR HOJAS DE CAUSAS — Bianchileiva
 *
 * Instrucciones de uso:
 *  1. Abre el Google Sheet → Extensiones → Apps Script
 *  2. Pega todo este código (reemplaza lo que haya)
 *  3. Guarda (Ctrl+S)
 *  4. Ejecuta mejorarTodasLasHojas() la primera vez para formatear todas las hojas existentes
 *  5. El trigger onEdit() se activa automáticamente cada vez que edites el sheet
 *
 * Menú personalizado: aparece como "📋 Causas BL" en la barra del sheet.
 */

// ── Configuración central ────────────────────────────────────────────────────

const CONFIG = {
  // Nombre exacto de la hoja principal de clientes/causas
  HOJA_PRINCIPAL: 'Principal',

  // Columnas esperadas en cada hoja de causa (orden y nombre)
  COLUMNAS_CAUSA: [
    'Fecha',          // A
    'Categoría',      // B
    'Descripción',    // C
    'Responsable',    // D
    'Estado',         // E
    'Folio / Ref.',   // F
    'Notas',          // G
  ],

  // Columnas en la hoja principal
  COLUMNAS_PRINCIPAL: [
    'RIT / RUC',      // A
    'Cliente',        // B
    'Área',           // C
    'Materia',        // D
    'Tribunal',       // E
    'Estado',         // F
    'Responsable',    // G
    'Última revisión',// H
    'Próxima acción', // I
    'Hoja',           // J  ← hipervínculo a la hoja de causa
  ],

  // Opciones para validación de datos
  AREAS:       ['Penal', 'Familia', 'Laboral', 'Civil', 'JPL', 'Administrativo', 'Corte de Apelaciones', 'Corte Suprema'],
  ESTADOS:     ['En tramitación', 'Abierta', 'Terminada', 'Archivada', 'Suspendida'],
  RESPONSABLES:['MT', 'AB', 'CL'],
  PROXIMAS:    ['Revisar PJUD', 'Revisar SIAU', 'Llamar cliente', 'Esperar resolución',
                'Preparar escrito', 'Presentar escrito', 'Insistir fiscalía',
                'Solicitar antecedentes', 'Agendar reunión', 'Revisar documentación',
                'Seguimiento interno', 'Otro'],
  CATEGORIAS:  ['Presentación', 'Resolución', 'Audiencia', 'Oficio', 'Diligencia', 'Documento', 'Revisión', 'Otro'],
  ESTADOS_MOV: ['Pendiente', 'En proceso', 'Completado', 'Cancelado'],

  // Paleta de colores BL
  COLOR: {
    HEADER_BG:    '#1a2e4a',   // azul marino corporativo
    HEADER_TEXT:  '#ffffff',
    SUBHEADER_BG: '#2570ba',   // azul secundario
    FILA_IMPAR:   '#f8faff',
    FILA_PAR:     '#ffffff',
    BORDE:        '#dde3ed',
    VERDE:        '#d1fae5',   // estado activo
    ROJO:         '#fee2e2',   // terminado/archivado
    AMARILLO:     '#fef9c3',   // suspendido
    AZUL_CLARO:   '#dbeafe',   // en tramitación
    GRIS:         '#f3f4f6',
  },
}

// ── Menú personalizado ───────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Causas BL')
    .addItem('✨ Mejorar TODAS las hojas',      'mejorarTodasLasHojas')
    .addSeparator()
    .addItem('📄 Mejorar hoja activa',          'mejorarHojaActiva')
    .addItem('➕ Crear hoja nueva para causa',  'crearHojaCausa')
    .addSeparator()
    .addItem('🔄 Actualizar hoja Principal',    'mejorarHojaPrincipal')
    .addItem('📊 Aplicar formato condicional',  'aplicarFormatoCondicionalTodas')
    .addToUi()
}

// ── Punto de entrada: mejorar todas ─────────────────────────────────────────

function mejorarTodasLasHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const hojas = ss.getSheets()
  const ui = SpreadsheetApp.getUi()

  let mejoradas = 0
  hojas.forEach(hoja => {
    const nombre = hoja.getName()
    if (nombre === CONFIG.HOJA_PRINCIPAL || nombre === 'Principal') {
      mejorarHojaPrincipalSheet(hoja)
    } else {
      mejorarHojaCausaSheet(hoja)
    }
    mejoradas++
  })

  ui.alert(`✅ Listo`, `Se mejoraron ${mejoradas} hojas correctamente.`, ui.ButtonSet.OK)
}

function mejorarHojaActiva() {
  const hoja = SpreadsheetApp.getActiveSheet()
  const nombre = hoja.getName()
  if (nombre === CONFIG.HOJA_PRINCIPAL || nombre === 'Principal') {
    mejorarHojaPrincipalSheet(hoja)
  } else {
    mejorarHojaCausaSheet(hoja)
  }
  SpreadsheetApp.getUi().alert('✅ Hoja mejorada: ' + nombre)
}

function mejorarHojaPrincipal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const hoja = ss.getSheetByName(CONFIG.HOJA_PRINCIPAL)
       || ss.getSheets().find(s => s.getName().toLowerCase().includes('principal'))
       || ss.getSheets()[0]
  mejorarHojaPrincipalSheet(hoja)
  SpreadsheetApp.getUi().alert('✅ Hoja Principal actualizada.')
}

// ── Mejorar hoja PRINCIPAL ───────────────────────────────────────────────────

function mejorarHojaPrincipalSheet(hoja) {
  const C = CONFIG.COLOR

  // 1. Fila de título del sheet (fila 1 fusionada)
  hoja.setRowHeight(1, 40)
  const tituloRange = hoja.getRange(1, 1, 1, CONFIG.COLUMNAS_PRINCIPAL.length)
  tituloRange.merge()
    .setValue('📋 REGISTRO DE CAUSAS — BIANCHILEIVA')
    .setBackground(C.HEADER_BG)
    .setFontColor(C.HEADER_TEXT)
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')

  // 2. Fila de encabezados (fila 2)
  hoja.setRowHeight(2, 32)
  const headerRange = hoja.getRange(2, 1, 1, CONFIG.COLUMNAS_PRINCIPAL.length)
  headerRange
    .setValues([CONFIG.COLUMNAS_PRINCIPAL])
    .setBackground(C.SUBHEADER_BG)
    .setFontColor(C.HEADER_TEXT)
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, C.BORDE, SpreadsheetApp.BorderStyle.SOLID)

  // 3. Fijar las 2 primeras filas
  hoja.setFrozenRows(2)
  hoja.setFrozenColumns(2)

  // 4. Formato de datos (fila 3 en adelante)
  const ultimaFila = Math.max(hoja.getLastRow(), 3)
  const datosRange = hoja.getRange(3, 1, ultimaFila - 2, CONFIG.COLUMNAS_PRINCIPAL.length)

  // Alternar colores de fila
  for (let f = 3; f <= ultimaFila; f++) {
    hoja.getRange(f, 1, 1, CONFIG.COLUMNAS_PRINCIPAL.length)
      .setBackground(f % 2 === 0 ? C.FILA_PAR : C.FILA_IMPAR)
  }

  datosRange
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setBorder(false, false, false, false, true, true, C.BORDE, SpreadsheetApp.BorderStyle.SOLID)

  hoja.setRowHeightsForced(3, ultimaFila - 2, 26)

  // 5. Anchos de columna
  const anchos = [120, 180, 100, 200, 180, 120, 70, 110, 160, 80]
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w))

  // 6. Validación de datos: Área (col C = 3)
  const colArea = hoja.getRange(3, 3, ultimaFila - 2, 1)
  colArea.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.AREAS, true)
      .setAllowInvalid(false)
      .build()
  )

  // 7. Validación de datos: Estado (col F = 6)
  const colEstado = hoja.getRange(3, 6, ultimaFila - 2, 1)
  colEstado.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.ESTADOS, true)
      .setAllowInvalid(false)
      .build()
  )

  // 8. Validación de datos: Responsable (col G = 7)
  const colResp = hoja.getRange(3, 7, ultimaFila - 2, 1)
  colResp.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.RESPONSABLES, true)
      .setAllowInvalid(true)
      .build()
  )

  // 9. Validación de datos: Próxima acción (col I = 9)
  const colProx = hoja.getRange(3, 9, ultimaFila - 2, 1)
  colProx.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.PROXIMAS, true)
      .setAllowInvalid(true)
      .build()
  )

  // 10. Validación: Última revisión (col H = 8) — solo fechas
  const colFecha = hoja.getRange(3, 8, ultimaFila - 2, 1)
  colFecha.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(true)
      .setHelpText('Formato: DD/MM/AAAA')
      .build()
  )
  colFecha.setNumberFormat('DD/MM/YYYY')

  // 11. Formato condicional por estado
  aplicarFormatoCondicionalPrincipal(hoja, ultimaFila)

  // 12. Filtro automático
  if (ultimaFila > 2) {
    try { hoja.getFilter().remove() } catch(e) {}
    hoja.getRange(2, 1, ultimaFila - 1, CONFIG.COLUMNAS_PRINCIPAL.length).createFilter()
  }

  // 13. Col RIT en monoespaciado
  hoja.getRange(3, 1, ultimaFila - 2, 1)
    .setFontFamily('Courier New')
    .setFontSize(9)

  SpreadsheetApp.flush()
}

// ── Formato condicional hoja principal ──────────────────────────────────────

function aplicarFormatoCondicionalPrincipal(hoja, ultimaFila) {
  const C = CONFIG.COLOR
  if (ultimaFila < 3) return

  // Limpiar reglas existentes de formato condicional
  hoja.clearConditionalFormatRules()

  const reglas = []
  const estadosConfig = [
    { valor: 'En tramitación', bg: C.AZUL_CLARO,  text: '#1d4ed8' },
    { valor: 'Abierta',        bg: C.VERDE,        text: '#065f46' },
    { valor: 'Terminada',      bg: C.ROJO,         text: '#991b1b' },
    { valor: 'Archivada',      bg: C.ROJO,         text: '#7f1d1d' },
    { valor: 'Suspendida',     bg: C.AMARILLO,     text: '#854d0e' },
  ]

  estadosConfig.forEach(({ valor, bg, text }) => {
    // Colorear la celda de estado (col F)
    const rango = hoja.getRange(3, 6, ultimaFila - 2, 1)
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(valor)
        .setBackground(bg)
        .setFontColor(text)
        .setRanges([rango])
        .build()
    )
  })

  hoja.setConditionalFormatRules(reglas)
}

// ── Mejorar hoja de CAUSA ────────────────────────────────────────────────────

function mejorarHojaCausaSheet(hoja) {
  const C = CONFIG.COLOR
  const nombre = hoja.getName()
  const nCols = CONFIG.COLUMNAS_CAUSA.length  // siempre 7, evita cruzar columnas inmovilizadas

  // Descongelar filas y columnas ANTES de cualquier merge para evitar el error
  // "No se pueden combinar columnas inmovilizadas con columnas no inmovilizadas"
  hoja.setFrozenRows(0)
  hoja.setFrozenColumns(0)

  // Deshacer merges previos en fila 1 para poder volver a fusionar limpiamente
  try { hoja.getRange(1, 1, 1, nCols).breakApart() } catch(e) {}

  // 1. Fila de título (fila 1): nombre de la causa
  hoja.setRowHeight(1, 44)
  hoja.getRange(1, 1, 1, nCols)
    .merge()
    .setValue('  📁 ' + nombre.toUpperCase())
    .setBackground(C.HEADER_BG)
    .setFontColor(C.HEADER_TEXT)
    .setFontSize(12)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)

  // 2. Encabezados (fila 2)
  hoja.setRowHeight(2, 30)
  const headerRange = hoja.getRange(2, 1, 1, CONFIG.COLUMNAS_CAUSA.length)
  headerRange
    .setValues([CONFIG.COLUMNAS_CAUSA])
    .setBackground(C.SUBHEADER_BG)
    .setFontColor(C.HEADER_TEXT)
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, C.BORDE, SpreadsheetApp.BorderStyle.SOLID)

  // 3. Fijar encabezados
  hoja.setFrozenRows(2)

  // 4. Formato de datos
  const ultimaFila = Math.max(hoja.getLastRow(), 3)
  const datosRange = hoja.getRange(3, 1, ultimaFila - 2, CONFIG.COLUMNAS_CAUSA.length)

  for (let f = 3; f <= ultimaFila; f++) {
    hoja.getRange(f, 1, 1, CONFIG.COLUMNAS_CAUSA.length)
      .setBackground(f % 2 === 0 ? C.FILA_PAR : C.FILA_IMPAR)
  }

  datosRange
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(false, false, false, false, true, true, C.BORDE, SpreadsheetApp.BorderStyle.SOLID)

  hoja.setRowHeightsForced(3, ultimaFila - 2, 28)

  // 5. Anchos de columna
  const anchos = [100, 110, 310, 90, 110, 100, 200]
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w))

  // Col descripción y notas con wrap
  hoja.getRange(3, 3, ultimaFila - 2, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
  hoja.getRange(3, 7, ultimaFila - 2, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)

  // 6. Formato de fecha (col A)
  hoja.getRange(3, 1, ultimaFila - 2, 1)
    .setNumberFormat('DD/MM/YYYY')
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(true)
        .build()
    )

  // 7. Validación: Categoría (col B)
  hoja.getRange(3, 2, ultimaFila - 2, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.CATEGORIAS, true)
      .setAllowInvalid(true)
      .build()
  )

  // 8. Validación: Responsable (col D)
  hoja.getRange(3, 4, ultimaFila - 2, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.RESPONSABLES, true)
      .setAllowInvalid(true)
      .build()
  )

  // 9. Validación: Estado (col E)
  hoja.getRange(3, 5, ultimaFila - 2, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.ESTADOS_MOV, true)
      .setAllowInvalid(true)
      .build()
  )

  // 10. Formato condicional por categoría (col B)
  aplicarFormatoCondicionalCausa(hoja, ultimaFila)

  // 11. Filtro automático
  if (ultimaFila > 2) {
    try { hoja.getFilter().remove() } catch(e) {}
    hoja.getRange(2, 1, ultimaFila - 1, CONFIG.COLUMNAS_CAUSA.length).createFilter()
  }

  // 12. Ordenar por fecha descendente (si hay datos)
  if (ultimaFila > 3) {
    try {
      hoja.getRange(3, 1, ultimaFila - 2, CONFIG.COLUMNAS_CAUSA.length)
        .sort({ column: 1, ascending: false })
    } catch(e) {}
  }

  SpreadsheetApp.flush()
}

// ── Formato condicional hoja de causa ───────────────────────────────────────

function aplicarFormatoCondicionalCausa(hoja, ultimaFila) {
  const C = CONFIG.COLOR
  if (ultimaFila < 3) return

  hoja.clearConditionalFormatRules()

  const categoriaColors = {
    'Audiencia':    { bg: '#ede9fe', text: '#5b21b6' },
    'Resolución':   { bg: '#d1fae5', text: '#064e3b' },
    'Presentación': { bg: '#dbeafe', text: '#1e40af' },
    'Oficio':       { bg: '#fef3c7', text: '#78350f' },
    'Diligencia':   { bg: '#ffedd5', text: '#7c2d12' },
    'Documento':    { bg: '#f1f5f9', text: '#334155' },
    'Revisión':     { bg: '#fce7f3', text: '#831843' },
  }

  const estadoColors = {
    'Completado':  { bg: '#d1fae5', text: '#065f46' },
    'Pendiente':   { bg: '#fef9c3', text: '#854d0e' },
    'En proceso':  { bg: '#dbeafe', text: '#1d4ed8' },
    'Cancelado':   { bg: '#fee2e2', text: '#991b1b' },
  }

  const reglas = []
  const rangoCategoria = hoja.getRange(3, 2, ultimaFila - 2, 1)
  const rangoEstado    = hoja.getRange(3, 5, ultimaFila - 2, 1)

  Object.entries(categoriaColors).forEach(([valor, { bg, text }]) => {
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(valor)
        .setBackground(bg)
        .setFontColor(text)
        .setRanges([rangoCategoria])
        .build()
    )
  })

  Object.entries(estadoColors).forEach(([valor, { bg, text }]) => {
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(valor)
        .setBackground(bg)
        .setFontColor(text)
        .setRanges([rangoEstado])
        .build()
    )
  })

  hoja.setConditionalFormatRules(reglas)
}

// ── Crear nueva hoja de causa desde plantilla ────────────────────────────────

function crearHojaCausa() {
  const ui = SpreadsheetApp.getUi()
  const resp = ui.prompt(
    '➕ Nueva hoja de causa',
    'Ingresa el nombre (ej: C-123-2024 Juan Pérez):',
    ui.ButtonSet.OK_CANCEL
  )
  if (resp.getSelectedButton() !== ui.Button.OK) return

  const nombre = resp.getResponseText().trim()
  if (!nombre) { ui.alert('El nombre no puede estar vacío.'); return }

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  if (ss.getSheetByName(nombre)) {
    ui.alert('⚠️ Ya existe una hoja con ese nombre.')
    return
  }

  // Crear hoja al final
  const hoja = ss.insertSheet(nombre)

  // Encabezados vacíos listos
  hoja.getRange(2, 1, 1, CONFIG.COLUMNAS_CAUSA.length).setValues([CONFIG.COLUMNAS_CAUSA])

  // Primera fila de ejemplo
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')
  hoja.getRange(3, 1, 1, CONFIG.COLUMNAS_CAUSA.length).setValues([[
    hoy, 'Documento', 'Apertura de causa', 'MT', 'Completado', '', 'Hoja creada automáticamente'
  ]])

  // Aplicar formato
  mejorarHojaCausaSheet(hoja)

  // Agregar fila en Principal
  agregarFilaPrincipal(nombre)

  ui.alert(`✅ Hoja "${nombre}" creada y formateada.`)
  ss.setActiveSheet(hoja)
}

// ── Agregar fila en la hoja Principal al crear una causa ────────────────────

function agregarFilaPrincipal(nombreHoja) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet()
  const hoja = ss.getSheetByName(CONFIG.HOJA_PRINCIPAL)
           || ss.getSheets().find(s => s.getName().toLowerCase().includes('principal'))
  if (!hoja) return

  const ultimaFila = Math.max(hoja.getLastRow() + 1, 3)
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')

  // Insertar fila con hipervínculo a la hoja
  const url = `#gid=${ss.getSheetByName(nombreHoja).getSheetId()}`
  hoja.getRange(ultimaFila, 1, 1, CONFIG.COLUMNAS_PRINCIPAL.length).setValues([[
    '', '', '', '', '', 'Abierta', 'MT', hoy, 'Revisar PJUD',
    `=HYPERLINK("${url}","Ir →")`
  ]])

  // Dar formato a la nueva fila
  hoja.getRange(ultimaFila, 1, 1, CONFIG.COLUMNAS_PRINCIPAL.length)
    .setBackground(ultimaFila % 2 === 0 ? CONFIG.COLOR.FILA_PAR : CONFIG.COLOR.FILA_IMPAR)
    .setFontSize(10)
    .setVerticalAlignment('middle')
}

// ── Aplicar formato condicional a TODAS las hojas ───────────────────────────

function aplicarFormatoCondicionalTodas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.getSheets().forEach(hoja => {
    const nombre = hoja.getName()
    const ultimaFila = Math.max(hoja.getLastRow(), 3)
    if (nombre === CONFIG.HOJA_PRINCIPAL || nombre === 'Principal') {
      aplicarFormatoCondicionalPrincipal(hoja, ultimaFila)
    } else {
      aplicarFormatoCondicionalCausa(hoja, ultimaFila)
    }
  })
  SpreadsheetApp.getUi().alert('✅ Formato condicional aplicado a todas las hojas.')
}

// ── Trigger onEdit: dar formato a nuevas filas automáticamente ───────────────

function onEdit(e) {
  const hoja = e.range.getSheet()
  const fila  = e.range.getRow()
  const col   = e.range.getColumn()
  const C     = CONFIG.COLOR

  // Solo actuar en filas de datos (fila 3+)
  if (fila < 3) return

  const nombre = hoja.getName()
  const esPrincipal = nombre === CONFIG.HOJA_PRINCIPAL || nombre === 'Principal'
  const nCols = esPrincipal ? CONFIG.COLUMNAS_PRINCIPAL.length : CONFIG.COLUMNAS_CAUSA.length

  // Dar estilo a la fila editada
  hoja.getRange(fila, 1, 1, nCols)
    .setBackground(fila % 2 === 0 ? C.FILA_PAR : C.FILA_IMPAR)
    .setFontSize(10)
    .setVerticalAlignment('middle')

  // Si es hoja de causa y se edita col A (fecha), asegurar formato DD/MM/YYYY
  if (!esPrincipal && col === 1) {
    e.range.setNumberFormat('DD/MM/YYYY')
  }

  // Si es principal y se edita col H (fecha revisión)
  if (esPrincipal && col === 8) {
    e.range.setNumberFormat('DD/MM/YYYY')
  }
}
