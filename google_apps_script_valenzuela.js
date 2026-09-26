/**
 * SCRIPT ESPECÍFICO: Hoja ADRIÁN VALENZUELA — Sistema BL
 *
 * Cómo usar:
 *  1. Abre el Google Sheet → Extensiones → Apps Script
 *  2. Crea un nuevo archivo (ícono "+") y pega todo este código
 *  3. Guarda (Ctrl+S)
 *  4. Ve a la hoja "ADRIÁN VALENZUELA"
 *  5. Ejecuta la función: reformatearHojaValenzuela()
 *     (Menú superior → Ejecutar → reformatearHojaValenzuela)
 *
 * IMPORTANTE: El script reemplaza TODO el contenido de la hoja activa.
 * Los datos originales quedan preservados en el historial de versiones
 * de Google Sheets (Archivo → Historial de versiones).
 */

// ── Columnas ─────────────────────────────────────────────────────────────────

const COL_V = {
  MARGEN:      1,   // A – margen visual izquierdo
  FECHA:       2,   // B – Fecha / Campo
  FOLIO:       3,   // C – Folio (en tablas simples: fusionar C hasta G)
  SOLICITUD:   4,   // D – Solicitud / Tarea / Actuación / Resolución
  RESPUESTA:   5,   // E – Respuesta / Estado / Resultado
  DOCUMENTOS:  6,   // F – Documentos / Próxima actuación
  NOTAS:       7,   // G – Notas / Observaciones
  TOTAL:       7,   // número de columnas de trabajo (B–G)
}

// ── Paleta de colores — consistente con el script principal BL ────────────────

const CLR = {
  HEADER_BG:    '#1a2e4a',   // azul marino corporativo
  HEADER_TEXT:  '#ffffff',
  SUBHEADER_BG: '#2570ba',   // azul secundario
  FILA_IMPAR:   '#f8faff',
  FILA_PAR:     '#ffffff',
  BORDE:        '#dde3ed',
  SECCION_BG:   '#e8f0fa',   // fondo título de sección
  SECCION_TEXT: '#1a2e4a',
  VERDE:        '#d1fae5',
  ROJO:         '#fee2e2',
  AMARILLO:     '#fef9c3',
  AZUL_CLARO:   '#dbeafe',
}

// ── Estructura de filas ───────────────────────────────────────────────────────

const FILAS_V = {
  TITULO:           1,
  // fila 2 vacía
  MOD1_SECCION:     3,
  MOD1_HEADER:      4,
  MOD1_DATA_INI:    5,    // 14 datos → filas 5–18
  // filas 19–23 vacías
  MOD2_SECCION:    24,
  MOD2_HEADER:     25,
  MOD2_DATA_INI:   26,    // 4 datos → filas 26–29
  // filas 30–34 vacías
  MOD3_SECCION:    35,
  MOD3_HEADER:     36,
  MOD3_DATA_INI:   37,    // 26 entradas → filas 37–62
  // filas 63–67 vacías
  MOD4_SECCION:    68,
  MOD4_HEADER:     69,
  MOD4_DATA_INI:   70,    // 25 entradas → filas 70–94
  // filas 95–99 vacías
  MOD5_SECCION:   100,
  MOD5_HEADER:    101,
  MOD5_DATA_INI:  102,    // 11 entradas → filas 102–112
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════

function reformatearHojaValenzuela() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet()
  const hoja = ss.getSheetByName('ADRIÁN VALENZUELA')
             || ss.getSheetByName('ADRIAN VALENZUELA')
             || ss.getActiveSheet()

  // ── Preparar hoja ──────────────────────────────────────────────────────────
  hoja.setFrozenRows(0)
  hoja.setFrozenColumns(0)
  hoja.clear()
  hoja.clearConditionalFormatRules()
  try { hoja.getFilter().remove() } catch (e) {}

  // Asegurar filas suficientes
  if (hoja.getMaxRows() < 130) hoja.insertRowsAfter(hoja.getMaxRows(), 130 - hoja.getMaxRows())

  // ── Anchos de columna ──────────────────────────────────────────────────────
  hoja.setColumnWidth(COL_V.MARGEN,     22)
  hoja.setColumnWidth(COL_V.FECHA,     112)
  hoja.setColumnWidth(COL_V.FOLIO,     130)
  hoja.setColumnWidth(COL_V.SOLICITUD, 285)
  hoja.setColumnWidth(COL_V.RESPUESTA, 205)
  hoja.setColumnWidth(COL_V.DOCUMENTOS,142)
  hoja.setColumnWidth(COL_V.NOTAS,     142)

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 0 — TÍTULO PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════
  _tituloPrincipal(hoja, FILAS_V.TITULO, 'ADRIÁN ENRIQUE VALENZUELA ARIAS')

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 1 — RESUMEN DE LA CAUSA
  // ═══════════════════════════════════════════════════════════════════════════
  _tituloSeccion(hoja, FILAS_V.MOD1_SECCION, 'RESUMEN DE LA CAUSA')
  _headersSimple(hoja, FILAS_V.MOD1_HEADER)

  _tablaSimple(hoja, FILAS_V.MOD1_DATA_INI, [
    ['Cliente',             'Adrián Enrique Valenzuela Arias'],
    ['RUT',                 '17.992.240-1'],
    ['Parte procesal',      'Imputado (Defensa)'],
    ['RUC',                 '2425146678-1'],
    ['RIT',                 '1166-2025'],
    ['Tribunal',            'JG San Fernando'],
    ['Fiscalía',            'San Bernardo'],
    ['Área',                'Penal'],
    ['Materia',             'VIF – Delito de amenaza y desacato'],
    ['Estado procesal',     'En tramitación'],
    ['Próxima audiencia',   '11-jun-2026  ·  11:30 hrs  ·  Sala 2'],
    ['Última gestión SIAU', '27-may-2026 – Solicitud diligencias investigación (folio 602310253675)'],
    ['Última gestión PJUD', '20-may-2026 – Certificación remisión audio audiencia formalización (F-49)'],
    ['Responsable',         'Macarena Taverne Velasco'],
  ])

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 2 — DATOS DE CONTACTO
  // ═══════════════════════════════════════════════════════════════════════════
  _tituloSeccion(hoja, FILAS_V.MOD2_SECCION, 'DATOS DE CONTACTO')
  _headersSimple(hoja, FILAS_V.MOD2_HEADER)

  _tablaSimple(hoja, FILAS_V.MOD2_DATA_INI, [
    ['Celular',      '+56 9 3010 5369'],
    ['Correo',       'adrianvalenzuelaarias@gmail.com'],
    ['Clave Única',  'Casadepapel1139.'],
    ['Dirección',    'Miraflores N° 1139, Chimbarongo'],
  ])

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 3 — SEGUIMIENTO SEMANAL
  // ═══════════════════════════════════════════════════════════════════════════
  _tituloSeccion(hoja, FILAS_V.MOD3_SECCION, 'SEGUIMIENTO SEMANAL')
  _headersTabla(hoja, FILAS_V.MOD3_HEADER, 4,
    ['FECHA', 'TAREA', 'ESTADO', 'NOTAS'])

  const seguimiento = [
    ['10/11/2025', 'Llamar BICRIM San Fernando. Ver si se endosó la IP a algún funcionario.',                                                                                       'Listo',                                                                              ''],
    ['17/11/2025', 'Llamar a la BICRIM San Fernando. Ver si fue endosada la IP de tomar declaraciones a los testigos a algún funcionario.',                                         'Llamé. Dijeron que no tienen una causa con ese RUC.',                                ''],
    ['24/11/2025', 'Revisar solicitudes. Volver a llamar a la BICRIM San Fernando.',                                                                                               '',                                                                                   ''],
    ['01/12/2025', 'Revisar en la carpeta las diligencias realizadas por BICRIM.',                                                                                                 '',                                                                                   ''],
    ['08/12/2025', 'Pedí nueva copia de la IP del 08-oct.',                                                                                                                        'No ha llegado.',                                                                     ''],
    ['15/12/2025', 'Revisar en la carpeta las diligencias realizadas por BICRIM. Hacer MINUTA AUDIENCIA MC.',                                                                      '',                                                                                   ''],
    ['22/12/2025', 'Interpusieron querella criminal en su contra. Revisar si los hechos son los mismos de la formalización.',                                                      'Son los mismos hechos.',                                                             ''],
    ['29/12/2025', 'Oficio a la Municipalidad de Chimbarongo para que manden los videos del día del desacato.',                                                                    'Aceptada.',                                                                          ''],
    ['30/12/2025', 'Subido escrito de oficios.',                                                                                                                                   '',                                                                                   ''],
    ['05/01/2026', 'Revisar cuando llegue: IP declaraciones / Oficio videos municipalidad.',                                                                                       'Llamé al SIP. No tienen ninguna IP.',                                                ''],
    ['12/01/2026', 'Revisar cuando llegue: IP declaraciones / Oficio videos municipalidad.',                                                                                       '',                                                                                   ''],
    ['19/01/2026', 'No han pedido las imágenes de la municipalidad.',                                                                                                              'Pedirlo con carácter de urgente.',                                                   'Llamé al SIP. No tienen ninguna IP.'],
    ['26/01/2026', 'Solicito copias de las últimas diligencias.',                                                                                                                  'Ver si son las cámaras de la municipalidad. Sino, volver a pedirlas.',               ''],
    ['23/02/2026', 'Hacer índice copia carpeta.',                                                                                                                                  'Listo.',                                                                             ''],
    ['02/03/2026', 'Llamar SIP: IP declaraciones / Oficio videos municipalidad.',                                                                                                  'Llamé al SIP: dijeron que llamara a la BICRIM. Llamé a la BICRIM: no tienen causa con ese RUC.', ''],
    ['16/03/2026', 'Solicitar copia de audio de audiencia de formalización.',                                                                                                      'Cuando llegue, transcribirla.',                                                      ''],
    ['23/03/2026', 'Pedir cambio de fecha de audiencia.',                                                                                                                          'Lo cambiaron para el 08-abr.',                                                       'Pedir que sea por zoom.'],
    ['02/04/2026', 'Reunión para preparar la audiencia.',                                                                                                                          '',                                                                                   ''],
    ['03/04/2026', 'Llamar SIP: IP declaraciones / Oficio videos municipalidad.',                                                                                                  'Llamé al SIP: dijeron que llamara a la BICRIM. Llamé a la BICRIM: no tienen causa con ese RUC.', ''],
    ['08/04/2026', 'Audiencia revisión MC y cierre.',                                                                                                                              'Plazo ampliado en 60 días.',                                                         'Próxima audiencia: 11-jun-2026 · 11:30 · Sala 2.'],
    ['13/04/2026', 'Volver a llamar al SIP y a la BICRIM antes de la reunión con la fiscal.',                                                                                      'Sale que el teléfono no existe. Se mandó mail.',                                     ''],
    ['06/05/2026', 'Recibí llamada del +56 72 298 3201 pero tarde, no pude contestar.',                                                                                            'Volver a pedir entrevista.',                                                         ''],
    ['20/05/2026', 'Subido escrito copia de audios.',                                                                                                                              '',                                                                                   ''],
    ['25/05/2026', 'Transcribir audiencia de formalización.',                                                                                                                      '',                                                                                   ''],
    ['26/05/2026', 'Subir nuevo SIAU.',                                                                                                                                            '',                                                                                   ''],
    ['26/05/2026', 'Seguir llamando a la BICRIM por los testigos.',                                                                                                                '',                                                                                   ''],
  ]

  _tablaConDatos(hoja, FILAS_V.MOD3_DATA_INI, seguimiento, 4)
  _formatoCondicionalEstado(hoja, FILAS_V.MOD3_DATA_INI, seguimiento.length, COL_V.RESPUESTA)

  // Filtro activo en Seguimiento (único filtro permitido por hoja en Google Sheets)
  const finSeg = FILAS_V.MOD3_DATA_INI + seguimiento.length - 1
  hoja.getRange(FILAS_V.MOD3_HEADER, COL_V.FECHA, finSeg - FILAS_V.MOD3_HEADER + 1, 4)
      .createFilter()

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 4 — MOVIMIENTOS SIAU
  // ═══════════════════════════════════════════════════════════════════════════
  _tituloSeccion(hoja, FILAS_V.MOD4_SECCION, 'MOVIMIENTOS SIAU')
  _headersTabla(hoja, FILAS_V.MOD4_HEADER, 6,
    ['FECHA', 'FOLIO', 'SOLICITUD', 'RESPUESTA', 'DOCUMENTOS', 'NOTAS'])

  const siau = [
    ['23/07/2025', '60239134073',  'Activar/Anular acreditación de representación.',                                                                                                                                         '',                                                                                              '',                                    ''],
    ['23/07/2025', '60239134195',  'Reiterar solicitud de acreditación. Se acompaña resolución que acredita patrocinio y poder de Adrián Valenzuela Arias a la abogada.',                                                    '',                                                                                              '',                                    ''],
    ['24/07/2025', '60239139430',  'Solicito copia completa de la carpeta investigativa.',                                                                                                                                   'Aprobada. Copias disponibles a partir del 18-ago-2025.',                                        '1754336593_FULL_2425146678-1.pdf',     ''],
    ['16/09/2025', '60239335709',  'Solicito información sobre diligencia del 15-sep (marca VIF).',                                                                                                                          'No ha lugar. Se responde por teléfono: es una marca VIF.',                                      '',                                    ''],
    ['03/10/2025', '60239394114',  'Solicito examen toxicológico al representado. La denunciante sostiene que sería consumidor de drogas (falso).',                                                                          'No ha lugar. La diligencia no dice relación con el tipo penal.',                                '',                                    ''],
    ['08/10/2025', '60239409382',  'Solicito se cite a declarar al imputado y testigos: Constanza Castro, Felipe Marchant, Nicole Arce. En caso de IP a PDI, contactar a Macarena Taverne: mtaverne@bianchileiva.cl.',      'Enviada IP OFICIO IP2025-037120, plazo 30 días.',                                               'Drive: IP2025-037120',                'Pedir que se vuelva a mandar esta IP.'],
    ['13/10/2025', '60239426067',  'Solicito copia de la IP del 08-oct-2025.',                                                                                                                                               'Aprobada. Copias disponibles en 15 días hábiles.',                                              'No llegaron los documentos.',         'Volver a pedirla. Preguntar a qué BICRIM fue remitida y a qué funcionario fue endosada.'],
    ['05/11/2025', '60239518000',  'Reitero solicitud de copia de IP del 08-oct-2025 (ya transcurrieron 15 días hábiles).',                                                                                                  'Aprobada. Copias disponibles a partir del 27-nov-2025.',                                        'Llegaron. Subidas al drive.',         ''],
    ['05/11/2025', '60239518057',  'Solicito se informe a qué BICRIM fue remitida la IP del 08-oct-2025.',                                                                                                                   'No ha lugar. Fue a BICRIM San Fernando. Se instruye pedir cuenta, plazo 10 días.',              '',                                    ''],
    ['25/11/2025', '60239593460',  'Solicito información sobre diligencias del 21-nov: "Envío SITAD" y "Requerimiento de Información".',                                                                                     'Ingresar como solicitud específica de antecedentes.',                                           '',                                    'Vuelto a pedir en solicitud del 02-dic-2025.'],
    ['02/12/2025', '60239621457',  'Reitero solicitud de información sobre diligencias del 21-nov.',                                                                                                                         'Aprobada. Copias disponibles en 15 días hábiles.',                                              'Llegaron.',                           '22-dic: llegó, subida al drive.'],
    ['10/12/2025', '60239644395',  'Solicito copia de IP del 08-oct-2025 (archivo anterior no se podía visualizar).',                                                                                                        'Aprobada. Copias disponibles en 15 días hábiles.',                                              'Llegaron.',                           '23-dic: llegó, subida al drive.'],
    ['19/12/2025', '60239682741',  'Reitero solicitud de IP para citar a declarar al imputado y testigos. Informo que BICRIM San Fernando nunca recibió la IP anterior.',                                                    'Se instruye pedir cuenta nuevamente a SIP, plazo 30 días.',                                     '',                                    'Di mis datos de contacto. NO hay nada nuevo.'],
    ['31/12/2025', '60239711933',  'Solicito se lleve a cabo el oficio a la Municipalidad de Chimbarongo (videos cámaras de seguridad del 21-dic entre 20:30 y 20:50 hrs).',                                                 'Téngase presente, se requerirá en los términos indicados.',                                     '',                                    'El doc adjunto es nuestra solicitud de oficios.'],
    ['27/01/2026', '60239805634',  'Solicito copia de las diligencias del 17-ene y 20-ene-2026.',                                                                                                                            'Aprobada. Copias disponibles en 15 días hábiles.',                                              'No se pueden ver.',                   'Vueltas a pedir.'],
    ['16/02/2026', '60239878409',  'Reitero solicitud de copia de diligencias del 17-ene y 20-ene-2026.',                                                                                                                    'Se enviarán las copias al correo electrónico.',                                                 'Correo de la Angélica. Llegó.',       ''],
    ['06/04/2026', '602310058431', 'Solicito copia de las diligencias del 25-mar-2026.',                                                                                                                                     'Aprobada. Copias disponibles en 15 días hábiles.',                                              '',                                    'No ha llegado.'],
    ['06/04/2026', '602310058490', 'Pido cuenta del oficio del 31-dic-2025 sobre cámaras de Municipalidad de Chimbarongo.',                                                                                                  'No ha lugar. Ya fue instruido pedir cuenta de dicho requerimiento.',                            '',                                    ''],
    ['06/04/2026', '602310058573', 'Pido cuenta de solicitud del 19-dic-2025 de reenvío de IP para citar a testigos y declaración del imputado.',                                                                            'No ha lugar. Fue instruido realizar 2do pide cuenta, plazo 20 días.',                           '',                                    ''],
    ['06/04/2026', '602310058642', 'Solicito entrevista telefónica para conversar estado de la investigación.',                                                                                                               'Agenda entrevista para 14-abr-2026 a las 17:00 hrs. Atendedor: Abogada Karol Aguilar.',         '',                                    'Nunca llamaron.'],
    ['20/04/2026', '602310113623', 'Reagendamiento de entrevista (no fui contactada el 14-abr).',                                                                                                                            'Agendada para 06-may-2026, 15:30 hrs. Atendedor: Abogada Karol Aguilar. Telefónica.',           '',                                    'Me llamaron tarde, no pude contestar.'],
    ['06/05/2026', '602310179802', 'Nueva solicitud de entrevista telefónica. Recibí llamada del +56 72 298 3201 a las 16:16, pero estaba en otro compromiso.',                                                              'Agenda entrevista para 15-may-2026, 12:30 hrs. Atendedor: Abogada Karol Aguilar.',              '',                                    'Tampoco llamaron.'],
    ['14/05/2026', '602310210179', 'Solicito copia del movimiento del 11-may-2026 "Decisiones, Otras decisiones / Otras".',                                                                                                  'Aprobada. Copias disponibles a partir del 08-jun-2026.',                                        '',                                    '25-may: no han llegado.'],
    ['25/05/2026', '602310242651', 'Solicito nuevamente entrevista telefónica (no fui contactada el 06-may ni el 15-may).',                                                                                                  '',                                                                                              '',                                    'Llamaron 26-may-2026.'],
    ['27/05/2026', '602310253675', 'Conforme a entrevista del 26-may-2026, se adjuntan solicitudes sobre oficios a Municipalidad de Chimbarongo y respuestas. Se solicita: copia del oficio despachado, copia del pide cuenta y nuevo pide cuenta a la Municipalidad.', '', '', ''],
  ]

  _tablaConDatos(hoja, FILAS_V.MOD4_DATA_INI, siau, 6)

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 5 — CONSULTAS PJUD
  // ═══════════════════════════════════════════════════════════════════════════
  _tituloSeccion(hoja, FILAS_V.MOD5_SECCION, 'CONSULTAS PJUD')
  _headersTabla(hoja, FILAS_V.MOD5_HEADER, 6,
    ['FECHA', 'N° FOLIO', 'ACTUACIÓN / RESOLUCIÓN', 'RESULTADO', 'PRÓXIMA ACTUACIÓN', 'OBSERVACIONES'])

  const pjud = [
    ['14/04/2025', 'F-1',  'Acta de audiencia preparatoria VIF.',                                                                                                                                         '',                                                                                                                                           '',                                           ''],
    ['22/07/2025', '–',    'Tiene presente patrocinio y poder. Adrián Valenzuela Arias.',                                                                                                                  '',                                                                                                                                           '',                                           ''],
    ['22/07/2025', '–',    'Audiencia de formalización de la investigación.',                                                                                                                              '',                                                                                                                                           '',                                           ''],
    ['22/12/2025', '–',    'Audiencia de revisión de medidas cautelares.',                                                                                                                                 'Se mantienen las MC. Fecha de revisión: 26-mar-2026, 11:00, Sala 2.',                                                                        '26-mar-2026 · Revisión MC.',                 'Se dice genéricamente que el imputado no respetó las MC. Un hecho negativo no se puede probar. Se debe especificar dónde y cuándo fueron los incumplimientos.'],
    ['22/12/2025', 'F-29', 'Resolución. Previo a proveer, solicita mayores antecedentes.',                                                                                                                 '',                                                                                                                                           '',                                           ''],
    ['08/04/2026', 'F-44', 'Acta audiencia revisión MC y/o cierre.',                                                                                                                                      'Tribunal mantiene MC. Defensa solicita ampliación plazo investigación 60 días (pendiente: IP testigos del 08-oct-2025 y oficio Municipalidad Chimbarongo).', '11-jun-2026 · 11:30 · Sala 2 · Seguimiento MC / Cierre investigación.', 'Ley 21.675. Plazo ampliado en 60 días.'],
    ['10/04/2026', 'F-45', 'Abogada de María José solicita comparecer por zoom.',                                                                                                                          '',                                                                                                                                           '',                                           ''],
    ['10/04/2026', 'F-46', 'Autoriza conexión por zoom.',                                                                                                                                                 '',                                                                                                                                           '',                                           ''],
    ['20/05/2026', 'F-47', 'Escrito nuestro: solicita cumplir lo ordenado respecto a la remisión del audio de audiencia de formalización.',                                                                '',                                                                                                                                           '',                                           ''],
    ['20/05/2026', 'F-48', 'Resolución: como se pide, dese cumplimiento a lo resuelto con fecha 16-mar-2026.',                                                                                            'Audio enviado por mail el 20-may-2026.',                                                                                                      '',                                           ''],
    ['20/05/2026', 'F-49', 'Certificación: se remite link de audio de audiencia del 22-sep-2025 a Macarena Taverne Velasco vía correo electrónico.',                                                      '',                                                                                                                                           '',                                           ''],
  ]

  _tablaConDatos(hoja, FILAS_V.MOD5_DATA_INI, pjud, 6)

  // ── Congelar fila de título ────────────────────────────────────────────────
  hoja.setFrozenRows(1)

  SpreadsheetApp.flush()
  SpreadsheetApp.getUi().alert(
    '✅ Listo',
    'Hoja "ADRIÁN VALENZUELA" restructurada correctamente.\n\n' +
    '• Filtro activo: SEGUIMIENTO SEMANAL\n' +
    '• Para filtrar SIAU o PJUD: Datos → Vistas de filtro → Crear nueva vista de filtro',
    SpreadsheetApp.getUi().ButtonSet.OK
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES DE FORMATO
// ═════════════════════════════════════════════════════════════════════════════

/** Fila 1: título principal de la hoja (fondo azul marino, texto grande) */
function _tituloPrincipal(hoja, fila, texto) {
  hoja.setRowHeight(fila, 50)
  const rng = hoja.getRange(fila, COL_V.MARGEN, 1, COL_V.TOTAL + 1)
  try { rng.breakApart() } catch (e) {}
  rng.merge()
    .setValue('   ' + texto)
    .setBackground(CLR.HEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
}

/** Fila de separación de sección (fondo azul claro, borde lateral izquierdo grueso) */
function _tituloSeccion(hoja, fila, texto) {
  hoja.setRowHeight(fila, 30)
  const rng = hoja.getRange(fila, COL_V.FECHA, 1, COL_V.TOTAL - 1)
  try { rng.breakApart() } catch (e) {}
  rng.merge()
    .setValue('  ▸  ' + texto)
    .setBackground(CLR.SECCION_BG)
    .setFontColor(CLR.SECCION_TEXT)
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setBorder(false, true, true, true, false, false,
               CLR.HEADER_BG, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
    .setFontFamily('Arial')
}

/** Headers para tablas de 2 columnas (Resumen, Contacto): CAMPO | DETALLE */
function _headersSimple(hoja, fila) {
  hoja.setRowHeight(fila, 26)

  hoja.getRange(fila, COL_V.FECHA)
    .setValue('CAMPO')
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')

  const detalle = hoja.getRange(fila, COL_V.FOLIO, 1, COL_V.TOTAL - 2)
  try { detalle.breakApart() } catch (e) {}
  detalle.merge()
    .setValue('DETALLE')
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
    .setBorder(true, true, true, true, false, false,
               CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

/** Headers para tablas de n columnas (Seguimiento, SIAU, PJUD) */
function _headersTabla(hoja, fila, numCols, etiquetas) {
  hoja.setRowHeight(fila, 28)
  const rng = hoja.getRange(fila, COL_V.FECHA, 1, numCols)
  rng.setValues([etiquetas])
    .setBackground(CLR.SUBHEADER_BG)
    .setFontColor(CLR.HEADER_TEXT)
    .setFontSize(9)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Arial')
    .setBorder(true, true, true, true, true, true,
               CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

/** Tabla de 2 columnas con filas de ancho fijo (Resumen y Contacto) */
function _tablaSimple(hoja, filaInicio, datos) {
  datos.forEach((par, idx) => {
    const f  = filaInicio + idx
    const bg = idx % 2 === 0 ? CLR.FILA_IMPAR : CLR.FILA_PAR
    hoja.setRowHeight(f, 24)

    hoja.getRange(f, COL_V.FECHA)
      .setValue(par[0])
      .setBackground(bg)
      .setFontSize(9.5)
      .setFontWeight('bold')
      .setFontColor(CLR.SECCION_TEXT)
      .setVerticalAlignment('middle')
      .setFontFamily('Arial')

    const celda = hoja.getRange(f, COL_V.FOLIO, 1, COL_V.TOTAL - 2)
    try { celda.breakApart() } catch (e) {}
    celda.merge()
      .setValue(par[1])
      .setBackground(bg)
      .setFontSize(9.5)
      .setFontColor('#1a1a2e')
      .setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setFontFamily('Arial')

    // Borde lateral de toda la fila
    hoja.getRange(f, COL_V.FECHA, 1, COL_V.TOTAL - 1)
      .setBorder(null, true, null, true, false, true,
                 CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
  })

  // Borde inferior del bloque
  const ultima = filaInicio + datos.length - 1
  hoja.getRange(ultima, COL_V.FECHA, 1, COL_V.TOTAL - 1)
    .setBorder(null, true, true, true, false, true,
               CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

/** Tabla de datos con n columnas, texto wrap y alternancia de filas */
function _tablaConDatos(hoja, filaInicio, datos, numCols) {
  datos.forEach((fila, idx) => {
    const f  = filaInicio + idx
    const bg = idx % 2 === 0 ? CLR.FILA_IMPAR : CLR.FILA_PAR

    for (let c = 0; c < numCols; c++) {
      hoja.getRange(f, COL_V.FECHA + c)
        .setValue(fila[c] || '')
        .setBackground(bg)
        .setFontSize(9)
        .setFontFamily('Arial')
        .setVerticalAlignment('top')
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    }

    hoja.getRange(f, COL_V.FECHA, 1, numCols)
      .setBorder(null, true, null, true, false, true,
                 CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)

    // Columna FECHA: formato DD/MM/YYYY
    hoja.getRange(f, COL_V.FECHA).setNumberFormat('DD/MM/YYYY')

    // Columna FOLIO (C): fuente monoespaciada
    hoja.getRange(f, COL_V.FOLIO)
      .setFontFamily('Courier New')
      .setFontSize(8.5)
      .setHorizontalAlignment('left')
  })

  // Borde inferior del bloque
  const ultima = filaInicio + datos.length - 1
  hoja.getRange(ultima, COL_V.FECHA, 1, numCols)
    .setBorder(null, true, true, true, false, true,
               CLR.BORDE, SpreadsheetApp.BorderStyle.SOLID)
}

/** Formato condicional para la columna ESTADO del Seguimiento Semanal */
function _formatoCondicionalEstado(hoja, filaInicio, numFilas, columna) {
  const rng = hoja.getRange(filaInicio, columna, numFilas, 1)
  const reglas = hoja.getConditionalFormatRules()

  const colores = [
    { texto: 'Listo',              bg: '#d1fae5', text: '#065f46' },
    { texto: 'Aceptada',           bg: '#d1fae5', text: '#065f46' },
    { texto: 'Pendiente',          bg: '#fef9c3', text: '#854d0e' },
    { texto: 'No ha llegado',      bg: '#fee2e2', text: '#991b1b' },
    { texto: 'Volver a pedir',     bg: '#fef9c3', text: '#854d0e' },
    { texto: 'Plazo ampliado',     bg: '#dbeafe', text: '#1d4ed8' },
  ]

  colores.forEach(({ texto, bg, text }) => {
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains(texto)
        .setBackground(bg)
        .setFontColor(text)
        .setRanges([rng])
        .build()
    )
  })

  hoja.setConditionalFormatRules(reglas)
}
