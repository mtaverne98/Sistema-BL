import { createContext, useContext, useState, useCallback } from 'react'

// ── Data compartida ────────────────────────────────────────────────────────────
export const TAREAS_INIT = [
  {
    id:'ta01', titulo:'Escrito de contestación demanda de alimentos',
    cliente:'Ana Paula Reyes Soto', causa_rit:'F-1234-2025', causa_ruc:'2300123456-7',
    categoria:'Escrito', prioridad:'Alta', fecha_vencimiento:'2026-05-21',
    responsable:'MT', estado:'En progreso',
    notas:'Incluir 3 precedentes jurisprudenciales Corte Apelaciones 2024. Revisar monto demandado.',
    subtareas:[
      { id:'s1', texto:'Revisar demanda original y documentos adjuntos',          completada:true  },
      { id:'s2', texto:'Buscar jurisprudencia aplicable (Corte Apelaciones 2024)', completada:true  },
      { id:'s3', texto:'Redactar escrito de contestación',                         completada:false },
      { id:'s4', texto:'Revisión final y firma',                                   completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-19', hora:'09:15', autor:'MT', tipo:'creacion',   desc:'Tarea creada'                            },
      { id:'a2', fecha:'2026-05-20', hora:'14:30', autor:'AB', tipo:'estado',     desc:'Estado → En progreso'                    },
      { id:'a3', fecha:'2026-05-20', hora:'16:00', autor:'MT', tipo:'comentario', desc:'Revisados 2 de 3 precedentes. Falta uno.' },
    ],
  },
  {
    id:'ta02', titulo:'Revisar resoluciones activas en PJUD',
    cliente:'Héctor Morales Jiménez', causa_rit:'O-456-2025', causa_ruc:'2200987654-3',
    categoria:'PJUD', prioridad:'Media', fecha_vencimiento:'2026-05-22',
    responsable:'CL', estado:'Pendiente',
    notas:'Verificar estado notificación y plazos de respuesta. Descargar resolución.',
    subtareas:[
      { id:'s1', texto:'Ingresar a PJUD y revisar expediente',    completada:false },
      { id:'s2', texto:'Verificar notificaciones pendientes',      completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-20', hora:'10:00', autor:'CL', tipo:'creacion', desc:'Tarea creada' },
    ],
  },
  {
    id:'ta03', titulo:'Responder oficio SIAU N°234-2025',
    cliente:'Lorena Navarro Pérez', causa_rit:'C-789-2024', causa_ruc:'2100654321-0',
    categoria:'SIAU', prioridad:'Alta', fecha_vencimiento:'2026-05-23',
    responsable:'AB', estado:'Pendiente',
    notas:'Plazo legal 5 días hábiles. Solicita antecedentes del expediente.',
    subtareas:[
      { id:'s1', texto:'Descargar oficio SIAU del sistema',           completada:false },
      { id:'s2', texto:'Preparar respuesta con antecedentes',         completada:false },
      { id:'s3', texto:'Ingresar respuesta en sistema SIAU',          completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-21', hora:'08:30', autor:'AB', tipo:'creacion', desc:'Tarea creada por oficio recibido' },
    ],
  },
  {
    id:'ta04', titulo:'Preparar defensa audiencia control de detención',
    cliente:'Rodrigo Carmona Muñoz', causa_rit:'P-321-2025', causa_ruc:'2400321654-8',
    categoria:'Audiencia', prioridad:'Alta', fecha_vencimiento:'2026-05-22',
    responsable:'MT', estado:'En progreso',
    notas:'Audiencia 22 may 08:00 Juzgado de Garantía. Argumentar medidas cautelares alternativas.',
    subtareas:[
      { id:'s1', texto:'Revisar antecedentes penales del imputado',        completada:true  },
      { id:'s2', texto:'Preparar argumentación medidas alternativas',      completada:false },
      { id:'s3', texto:'Coordinar declaración de familiares testigos',     completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-21', hora:'09:00', autor:'MT', tipo:'creacion', desc:'Tarea creada'            },
      { id:'a2', fecha:'2026-05-21', hora:'11:20', autor:'MT', tipo:'progreso', desc:'Antecedentes revisados'  },
    ],
  },
  {
    id:'ta05', titulo:'Solicitar antecedentes documentales al cliente',
    cliente:'María José Contreras Rojas', causa_rit:'F-5678-2024', causa_ruc:'2000789012-5',
    categoria:'Seguimiento cliente', prioridad:'Baja', fecha_vencimiento:'2026-05-25',
    responsable:'AB', estado:'Esperando antecedentes',
    notas:'Necesita liquidaciones de sueldo del demandado últimos 12 meses.',
    subtareas:[
      { id:'s1', texto:'Enviar email con lista de documentos requeridos', completada:true  },
      { id:'s2', texto:'Confirmar recepción y revisar documentos',        completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-18', hora:'10:00', autor:'AB', tipo:'creacion', desc:'Tarea creada'                    },
      { id:'a2', fecha:'2026-05-18', hora:'14:00', autor:'AB', tipo:'estado',   desc:'Estado → Esperando antecedentes' },
    ],
  },
  {
    id:'ta06', titulo:'Gestión cobro segunda cuota honorarios',
    cliente:'Patricia Lagos Vidal', causa_rit:'O-234-2025', causa_ruc:'2300456789-1',
    categoria:'Cobranza', prioridad:'Media', fecha_vencimiento:'2026-05-24',
    responsable:'CL', estado:'Pendiente',
    notas:'Honorarios segunda cuota $250.000 pendiente. Enviar recordatorio por email.',
    subtareas:[
      { id:'s1', texto:'Emitir boleta de honorarios', completada:false },
      { id:'s2', texto:'Enviar al cliente por email',  completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-21', hora:'10:00', autor:'CL', tipo:'creacion', desc:'Tarea creada' },
    ],
  },
  {
    id:'ta07', titulo:'Preparar minuta segunda sesión mediación familiar',
    cliente:'María José Contreras Rojas', causa_rit:'F-5678-2024', causa_ruc:'2000789012-5',
    categoria:'Documento', prioridad:'Baja', fecha_vencimiento:'2026-05-27',
    responsable:'MT', estado:'En revisión',
    notas:'Incluir acuerdos parciales sobre tenencia. Pendiente sección régimen de alimentos.',
    subtareas:[
      { id:'s1', texto:'Redactar sección tenencia acordada',    completada:true  },
      { id:'s2', texto:'Redactar sección régimen de visitas',    completada:false },
      { id:'s3', texto:'Enviar a mediadora para validación',     completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-20', hora:'09:00', autor:'MT', tipo:'creacion', desc:'Tarea creada'         },
      { id:'a2', fecha:'2026-05-21', hora:'10:30', autor:'AB', tipo:'estado',   desc:'Estado → En revisión' },
    ],
  },
  {
    id:'ta08', titulo:'Analizar liquidación de sueldo demandado',
    cliente:'Héctor Morales Jiménez', causa_rit:'O-456-2025', causa_ruc:'2200987654-3',
    categoria:'Escrito', prioridad:'Alta', fecha_vencimiento:'2026-05-18',
    responsable:'CL', estado:'En progreso',
    notas:'URGENTE: vencida. Requiere análisis para juicio oral del 21 mayo.',
    subtareas:[
      { id:'s1', texto:'Descargar liquidaciones de los últimos 12 meses', completada:true  },
      { id:'s2', texto:'Verificar cálculo de indemnización',               completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-15', hora:'09:00', autor:'CL', tipo:'creacion', desc:'Tarea creada'                            },
      { id:'a2', fecha:'2026-05-18', hora:'16:00', autor:'MT', tipo:'alerta',   desc:'Tarea vencida. Requiere atención urgente' },
    ],
  },
  {
    id:'ta09', titulo:'Solicitar certificado antecedentes PDI',
    cliente:'Sebastián Fuentes Herrera', causa_rit:'P-876-2025', causa_ruc:'2500876543-2',
    categoria:'Administrativo', prioridad:'Media', fecha_vencimiento:'2026-05-19',
    responsable:'MT', estado:'En progreso',
    notas:'Solicitar historial policial ante PDI para causa penal en trámite.',
    subtareas:[
      { id:'s1', texto:'Completar formulario de solicitud en PDI online', completada:false },
      { id:'s2', texto:'Pagar arancel y enviar solicitud',                 completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-16', hora:'11:00', autor:'MT', tipo:'creacion', desc:'Tarea creada' },
    ],
  },
  {
    id:'ta10', titulo:'Ingreso demanda laboral sistema PJUD',
    cliente:'Patricia Lagos Vidal', causa_rit:'O-234-2025', causa_ruc:'2300456789-1',
    categoria:'PJUD', prioridad:'Alta', fecha_vencimiento:'2026-05-26',
    responsable:'AB', estado:'Lista para envío',
    notas:'Demanda lista para ingreso. Verificar aranceles y documentos adjuntos antes de ingresar.',
    subtareas:[
      { id:'s1', texto:'Verificar demanda y todos los anexos', completada:true  },
      { id:'s2', texto:'Pagar arancel del juzgado',             completada:true  },
      { id:'s3', texto:'Ingresar al sistema PJUD',              completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-19', hora:'09:00', autor:'AB', tipo:'creacion', desc:'Tarea creada'              },
      { id:'a2', fecha:'2026-05-21', hora:'10:00', autor:'AB', tipo:'estado',   desc:'Estado → Lista para envío' },
    ],
  },
  {
    id:'ta11', titulo:'Coordinar reunión con perito psicólogo',
    cliente:'Camila Espinoza Torres', causa_rit:'F-9012-2025', causa_ruc:'2100234567-9',
    categoria:'Reunión', prioridad:'Media', fecha_vencimiento:'2026-05-28',
    responsable:'CL', estado:'Pendiente',
    notas:'Perito debe emitir informe antes del 15/06. Coordinar agenda con urgencia.',
    subtareas:[
      { id:'s1', texto:'Contactar perito por email con disponibilidad', completada:false },
      { id:'s2', texto:'Confirmar fecha y enviar documentos del caso',  completada:false },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-21', hora:'13:00', autor:'CL', tipo:'creacion', desc:'Tarea creada' },
    ],
  },
  {
    id:'ta12', titulo:'Registrar pago de honorarios — 2ª cuota',
    cliente:'Rodrigo Carmona Muñoz', causa_rit:'P-321-2025', causa_ruc:'2400321654-8',
    categoria:'Cobranza', prioridad:'Baja', fecha_vencimiento:'2026-05-10',
    responsable:'MT', estado:'Completada',
    notas:'Honorarios recibidos el 09/05/2026 vía transferencia. Registrado.',
    subtareas:[
      { id:'s1', texto:'Verificar transferencia bancaria', completada:true },
      { id:'s2', texto:'Emitir boleta de honorarios',       completada:true },
      { id:'s3', texto:'Archivar comprobante',              completada:true },
    ],
    actividad:[
      { id:'a1', fecha:'2026-05-09', hora:'10:00', autor:'MT', tipo:'creacion',   desc:'Tarea creada'            },
      { id:'a2', fecha:'2026-05-10', hora:'12:00', autor:'MT', tipo:'completada', desc:'Marcada como completada' },
    ],
  },
]

export const AUDIENCIAS_INIT = [
  {
    id:'au01',
    cliente:'Ana Paula Reyes Soto',
    causa_rit:'F-1234-2025', causa_ruc:'2300123456-7',
    tipo:'Audiencia preparatoria',
    fecha:'2026-05-21', hora:'09:30',
    tribunal:'Juzgado de Familia de Santiago', sala:'Sala 3',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Programada',
    notas:'Llevar prueba documental y lista de testigos. Confirmar asistencia del perito psicólogo.',
    asiste:['MT','AB'],
    resultado:'', minuta:'',
  },
  {
    id:'au02',
    cliente:'Héctor Morales Jiménez',
    causa_rit:'O-456-2025', causa_ruc:'2200987654-3',
    tipo:'Juicio oral laboral',
    fecha:'2026-05-21', hora:'15:00',
    tribunal:'Juzgado del Trabajo de Santiago', sala:'Sala 1',
    modalidad:'Zoom',
    zoom_link:'https://zoom.us/j/89234567890',
    zoom_id:'892 3456 7890', zoom_pass:'JL2025',
    estado:'Programada',
    notas:'Cliente confirma asistencia. Revisar liquidaciones de sueldo y carta de despido. Testigos citados.',
    asiste:['CL'],
    resultado:'', minuta:'',
  },
  {
    id:'au03',
    cliente:'Lorena Navarro Pérez',
    causa_rit:'C-789-2024', causa_ruc:'2100654321-0',
    tipo:'Audiencia de conciliación',
    fecha:'2026-05-22', hora:'10:00',
    tribunal:'Juzgado Civil de Providencia', sala:'Sala 5',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Programada',
    notas:'Propuesta de acuerdo preparada. Coordinar punto de reunión previo con cliente a las 09:00.',
    asiste:['AB'],
    resultado:'', minuta:'',
  },
  {
    id:'au04',
    cliente:'Rodrigo Carmona Muñoz',
    causa_rit:'P-321-2025', causa_ruc:'2400321654-8',
    tipo:'Audiencia de control de detención',
    fecha:'2026-05-22', hora:'08:00',
    tribunal:'Juzgado de Garantía de Santiago', sala:'Sala 2',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Programada',
    notas:'Solicitar medidas cautelares alternativas. Imputado sin antecedentes previos. Arraigo familiar acreditado.',
    asiste:['MT'],
    resultado:'', minuta:'',
  },
  {
    id:'au05',
    cliente:'María José Contreras Rojas',
    causa_rit:'F-5678-2024', causa_ruc:'2000789012-5',
    tipo:'Audiencia de mediación familiar',
    fecha:'2026-05-24', hora:'11:30',
    tribunal:'Centro de Mediación Familiar de Santiago', sala:'Sala 4',
    modalidad:'Zoom',
    zoom_link:'https://zoom.us/j/76543210987',
    zoom_id:'765 4321 0987', zoom_pass:'MED24',
    estado:'Programada',
    notas:'Segunda sesión. Acuerdo parcial sobre tenencia. Pendiente acuerdo sobre régimen de alimentos y comunicación directa.',
    asiste:['MT','CL'],
    resultado:'', minuta:'',
  },
  {
    id:'au06',
    cliente:'Patricia Lagos Vidal',
    causa_rit:'O-234-2025', causa_ruc:'2300456789-1',
    tipo:'Audiencia preparatoria laboral',
    fecha:'2026-05-26', hora:'09:00',
    tribunal:'Juzgado del Trabajo de Ñuñoa', sala:'Sala 3',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Programada',
    notas:'Despido injustificado. Tres testigos confirman irregularidades. Llevar contratos y todas las liquidaciones.',
    asiste:['AB','CL'],
    resultado:'', minuta:'',
  },
  {
    id:'au07',
    cliente:'Ana Paula Reyes Soto',
    causa_rit:'F-1234-2025', causa_ruc:'2300123456-7',
    tipo:'Juicio oral de familia',
    fecha:'2026-06-03', hora:'09:00',
    tribunal:'Juzgado de Familia de Santiago', sala:'Sala 3',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Programada',
    notas:'Juicio sobre alimentos. Llevar informe social y liquidaciones de sueldo del demandado. Solicitar apremio si corresponde.',
    asiste:['MT'],
    resultado:'', minuta:'',
  },
  {
    id:'au08',
    cliente:'Sebastián Fuentes Herrera',
    causa_rit:'P-876-2025', causa_ruc:'2500876543-2',
    tipo:'Audiencia de formalización',
    fecha:'2026-05-15', hora:'14:00',
    tribunal:'Juzgado de Garantía de Maipú', sala:'Sala 1',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Realizada',
    notas:'Solicitar medidas cautelares alternativas. Antecedentes penales inexistentes.',
    asiste:['MT'],
    resultado:'Imputado formalizado por robo con intimidación. Se decretó prisión preventiva por 60 días. Próxima audiencia de juicio oral fijada para el 01 de julio de 2026 a las 09:00.',
    minuta:'',
  },
  {
    id:'au09',
    cliente:'Camila Espinoza Torres',
    causa_rit:'F-9012-2025', causa_ruc:'2100234567-9',
    tipo:'Audiencia sobre medidas cautelares',
    fecha:'2026-05-18', hora:'10:30',
    tribunal:'Juzgado de Familia de Las Condes', sala:'Sala 2',
    modalidad:'Zoom',
    zoom_link:'https://zoom.us/j/55512345678',
    zoom_id:'555 1234 5678', zoom_pass:'FAM25',
    estado:'Realizada',
    notas:'Solicitar medida de alejamiento por VIF. Llevar fotografías y constancia policial.',
    asiste:['AB'],
    resultado:'Se decretó medida de alejamiento de 200 metros por 6 meses. Cliente satisfecha con la resolución. Audiencia de revisión de medida en 3 meses.',
    minuta:'',
  },
  {
    id:'au10',
    cliente:'Lorena Navarro Pérez',
    causa_rit:'C-103-2025', causa_ruc:'2200103456-6',
    tipo:'Audiencia de prueba',
    fecha:'2026-05-10', hora:'11:00',
    tribunal:'Juzgado Civil de Santiago', sala:'Sala 7',
    modalidad:'Presencial',
    zoom_link:'', zoom_id:'', zoom_pass:'',
    estado:'Suspendida',
    notas:'Parte demandada solicitó suspensión. Verificar nueva fecha con secretaría del tribunal.',
    asiste:['CL'],
    resultado:'Suspendida a solicitud de la parte demandada por enfermedad acreditada del abogado contrario. Nueva fecha pendiente de asignación por el tribunal.',
    minuta:'',
  },
]

export const PLAZOS_INIT = [
  {
    id: 'pl01',
    titulo: 'Responder oficio SIAU N°234-2025',
    cliente: 'Lorena Navarro Pérez',
    causa_rit: 'C-789-2024', causa_ruc: '2100654321-0',
    tipo: 'SIAU',
    fecha_vencimiento: '2026-05-21',
    responsable: 'AB',
    estado: 'Activo',
    notas: 'Plazo legal 5 días hábiles desde notificación. SIAU solicita antecedentes completos del expediente y poder notarial del cliente.',
    hitos: [
      { fecha: '2026-05-08', titulo: 'Notificación inicial demanda cobro de honorarios', tipo: 'notificacion' },
      { fecha: '2026-05-12', titulo: 'Resolución tribunal ordena antecedentes', tipo: 'resolucion' },
      { fecha: '2026-05-14', titulo: 'Recepción oficio SIAU N°234-2025', tipo: 'notificacion' },
      { fecha: '2026-05-21', titulo: 'Vencimiento plazo respuesta SIAU', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-14', hora: '09:00', autor: 'AB', tipo: 'creacion',   desc: 'Plazo creado al recibir oficio SIAU N°234-2025' },
      { id: 'a2', fecha: '2026-05-19', hora: '14:30', autor: 'MT', tipo: 'comentario', desc: 'Documentos del expediente listos, falta poder notarial' },
    ],
  },
  {
    id: 'pl02',
    titulo: 'Contestar demanda laboral por despido injustificado',
    cliente: 'Patricia Lagos Vidal',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    tipo: 'Procesal',
    fecha_vencimiento: '2026-05-22',
    responsable: 'AB',
    estado: 'Activo',
    notas: 'Art. 452 CT: plazo de 5 días para contestar. Demanda notificada el 15/05. Incluir todas las causales de despido y prueba documental.',
    hitos: [
      { fecha: '2026-05-10', titulo: 'Presentación demanda laboral', tipo: 'escrito' },
      { fecha: '2026-05-15', titulo: 'Notificación personal de la demanda', tipo: 'notificacion' },
      { fecha: '2026-05-22', titulo: 'Vencimiento plazo contestación (5 días hábiles)', tipo: 'vencimiento' },
      { fecha: '2026-05-26', titulo: 'Audiencia preparatoria laboral', tipo: 'audiencia' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-15', hora: '11:00', autor: 'AB', tipo: 'creacion',   desc: 'Plazo creado al recibir notificación de demanda' },
      { id: 'a2', fecha: '2026-05-20', hora: '09:30', autor: 'CL', tipo: 'comentario', desc: 'Contratos y liquidaciones revisados. Preparando contestación.' },
    ],
  },
  {
    id: 'pl03',
    titulo: 'Presentar escrito medidas cautelares en causa penal',
    cliente: 'Rodrigo Carmona Muñoz',
    causa_rit: 'P-321-2025', causa_ruc: '2400321654-8',
    tipo: 'Procesal',
    fecha_vencimiento: '2026-05-22',
    responsable: 'MT',
    estado: 'Activo',
    notas: 'Audiencia de control de detención 22 mayo 08:00. Presentar escrito antes de la audiencia solicitando medidas alternativas. Arraigo familiar acreditado.',
    hitos: [
      { fecha: '2026-05-20', titulo: 'Detención imputado en flagrancia', tipo: 'notificacion' },
      { fecha: '2026-05-21', titulo: 'Audiencia de formalización', tipo: 'audiencia' },
      { fecha: '2026-05-22', titulo: 'Vencimiento plazo + Audiencia control detención', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-21', hora: '07:00', autor: 'MT', tipo: 'creacion', desc: 'Plazo urgente creado para audiencia mañana' },
    ],
  },
  {
    id: 'pl04',
    titulo: 'Ingresar demanda de alimentos al PJUD',
    cliente: 'Ana Paula Reyes Soto',
    causa_rit: 'F-1234-2025', causa_ruc: '2300123456-7',
    tipo: 'PJUD',
    fecha_vencimiento: '2026-05-23',
    responsable: 'AB',
    estado: 'Activo',
    notas: 'Demanda lista para ingreso PJUD. Verificar aranceles y adjuntar: acta matrimonio, certificado nacimiento hijos, liquidaciones sueldo demandado.',
    hitos: [
      { fecha: '2026-05-15', titulo: 'Reunión inicial con cliente — mandato firmado', tipo: 'tarea' },
      { fecha: '2026-05-19', titulo: 'Demanda redactada y revisada', tipo: 'escrito' },
      { fecha: '2026-05-21', titulo: 'Pago arancel tribunal confirmado', tipo: 'tarea' },
      { fecha: '2026-05-23', titulo: 'Fecha límite ingreso PJUD', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-15', hora: '10:00', autor: 'AB', tipo: 'creacion',  desc: 'Plazo fijado por compromiso con cliente' },
      { id: 'a2', fecha: '2026-05-21', hora: '11:00', autor: 'AB', tipo: 'progreso',  desc: 'Arancel pagado. Pendiente revisión final documentos.' },
    ],
  },
  {
    id: 'pl05',
    titulo: 'Interponer recurso de apelación — juicio laboral',
    cliente: 'Héctor Morales Jiménez',
    causa_rit: 'O-456-2025', causa_ruc: '2200987654-3',
    tipo: 'Procesal',
    fecha_vencimiento: '2026-05-25',
    responsable: 'CL',
    estado: 'Activo',
    notas: 'Art. 477 CT: 5 días para apelar desde notificación sentencia. Sentencia desfavorable notificada el 20/05. Revisar fundamentos del recurso.',
    hitos: [
      { fecha: '2026-05-15', titulo: 'Sentencia de primera instancia dictada', tipo: 'resolucion' },
      { fecha: '2026-05-20', titulo: 'Notificación sentencia a las partes', tipo: 'notificacion' },
      { fecha: '2026-05-25', titulo: 'Vencimiento plazo apelación (5 días hábiles)', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-20', hora: '16:00', autor: 'CL', tipo: 'creacion',   desc: 'Sentencia desfavorable. Plazo apelación creado.' },
      { id: 'a2', fecha: '2026-05-21', hora: '09:00', autor: 'MT', tipo: 'comentario', desc: 'Revisando fundamentos para recurso.' },
    ],
  },
  {
    id: 'pl06',
    titulo: 'Solicitar certificado de antecedentes al Registro Civil',
    cliente: 'Rodrigo Carmona Muñoz',
    causa_rit: 'P-321-2025', causa_ruc: '2400321654-8',
    tipo: 'Administrativo',
    fecha_vencimiento: '2026-05-27',
    responsable: 'MT',
    estado: 'Activo',
    notas: 'Necesario para presentar ante tribunal como prueba de arraigo. El tribunal lo requirió expresamente en audiencia del 22/05.',
    hitos: [
      { fecha: '2026-05-22', titulo: 'Tribunal requiere certificado en audiencia', tipo: 'audiencia' },
      { fecha: '2026-05-27', titulo: 'Fecha límite presentación ante tribunal', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-22', hora: '10:00', autor: 'MT', tipo: 'creacion', desc: 'Requerido por tribunal en audiencia de control' },
    ],
  },
  {
    id: 'pl07',
    titulo: 'Responder oficio SIAU N°301-2025 — causa penal',
    cliente: 'Sebastián Fuentes Herrera',
    causa_rit: 'P-876-2025', causa_ruc: '2500876543-2',
    tipo: 'SIAU',
    fecha_vencimiento: '2026-05-29',
    responsable: 'MT',
    estado: 'Activo',
    notas: 'SIAU solicita informe sobre estado actual de la causa y medidas adoptadas. Plazo 5 días hábiles desde notificación.',
    hitos: [
      { fecha: '2026-05-15', titulo: 'Audiencia de formalización realizada', tipo: 'audiencia' },
      { fecha: '2026-05-22', titulo: 'Recepción oficio SIAU N°301-2025', tipo: 'notificacion' },
      { fecha: '2026-05-29', titulo: 'Vencimiento plazo respuesta SIAU', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-22', hora: '11:30', autor: 'MT', tipo: 'creacion', desc: 'Plazo creado al recibir oficio SIAU' },
    ],
  },
  {
    id: 'pl08',
    titulo: 'Presentar lista de testigos para juicio oral laboral',
    cliente: 'Héctor Morales Jiménez',
    causa_rit: 'O-456-2025', causa_ruc: '2200987654-3',
    tipo: 'Procesal',
    fecha_vencimiento: '2026-06-02',
    responsable: 'CL',
    estado: 'Activo',
    notas: 'Art. 454 CT: presentar lista de testigos y documentos 5 días antes de la audiencia del juicio oral. Audiencia fijada el 07/06/2026.',
    hitos: [
      { fecha: '2026-05-21', titulo: 'Juicio oral primera instancia', tipo: 'audiencia' },
      { fecha: '2026-05-25', titulo: 'Sentencia y notificación apelación', tipo: 'resolucion' },
      { fecha: '2026-06-02', titulo: 'Plazo presentar testigos y documentos', tipo: 'vencimiento' },
      { fecha: '2026-06-07', titulo: 'Juicio oral segunda instancia', tipo: 'audiencia' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-21', hora: '17:00', autor: 'CL', tipo: 'creacion', desc: 'Plazo fijado al finalizar juicio oral' },
    ],
  },
  {
    id: 'pl09',
    titulo: 'Presentar demanda de divorcio por culpa',
    cliente: 'Camila Espinoza Torres',
    causa_rit: 'F-9012-2025', causa_ruc: '2100234567-9',
    tipo: 'Procesal',
    fecha_vencimiento: '2026-06-15',
    responsable: 'AB',
    estado: 'Activo',
    notas: 'Compromiso con cliente para presentar demanda antes del 15/06. Documentación casi completa, falta informe psicólogo.',
    hitos: [
      { fecha: '2026-05-18', titulo: 'Medida de alejamiento decretada', tipo: 'resolucion' },
      { fecha: '2026-05-28', titulo: 'Reunión con perito psicólogo (informe VIF)', tipo: 'tarea' },
      { fecha: '2026-06-15', titulo: 'Presentación demanda divorcio por culpa', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-15', hora: '14:00', autor: 'AB', tipo: 'creacion', desc: 'Plazo comprometido con cliente en primera reunión' },
    ],
  },
  {
    id: 'pl10',
    titulo: 'Renovar contrato de honorarios — causa laboral',
    cliente: 'Patricia Lagos Vidal',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    tipo: 'Contractual',
    fecha_vencimiento: '2026-06-10',
    responsable: 'CL',
    estado: 'Activo',
    notas: 'Contrato actual vence el 10 de junio. Actualizar honorarios por avance del proceso y nueva etapa de juicio oral.',
    hitos: [
      { fecha: '2026-03-10', titulo: 'Contrato inicial de honorarios firmado', tipo: 'creacion' },
      { fecha: '2026-06-10', titulo: 'Vencimiento contrato — renovación requerida', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-10', hora: '09:00', autor: 'CL', tipo: 'creacion', desc: 'Plazo de renovación registrado' },
    ],
  },
  {
    id: 'pl11',
    titulo: 'Presentar escrito de réplica — causa civil cobro de pesos',
    cliente: 'Lorena Navarro Pérez',
    causa_rit: 'C-789-2024', causa_ruc: '2100654321-0',
    tipo: 'Procesal',
    fecha_vencimiento: '2026-05-15',
    responsable: 'AB',
    estado: 'Activo',
    notas: '⚠️ VENCIDO. Plazo de réplica vencido el 15/05. Contactar tribunal para evaluar opciones procesales.',
    hitos: [
      { fecha: '2026-05-01', titulo: 'Dúplica del demandado presentada', tipo: 'escrito' },
      { fecha: '2026-05-05', titulo: 'Notificación dúplica al demandante', tipo: 'notificacion' },
      { fecha: '2026-05-15', titulo: 'Vencimiento plazo réplica (VENCIDO)', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-05', hora: '10:00', autor: 'AB', tipo: 'creacion', desc: 'Plazo de réplica registrado' },
      { id: 'a2', fecha: '2026-05-16', hora: '09:30', autor: 'MT', tipo: 'alerta',   desc: 'Plazo vencido sin presentar escrito. Requiere gestión urgente.' },
    ],
  },
  {
    id: 'pl12',
    titulo: 'Responder oficio SIAU N°201-2025',
    cliente: 'Patricia Lagos Vidal',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    tipo: 'SIAU',
    fecha_vencimiento: '2026-05-18',
    responsable: 'CL',
    estado: 'Activo',
    notas: '⚠️ VENCIDO hace 3 días. Contactar SIAU para regularizar situación. Riesgo de sanción administrativa.',
    hitos: [
      { fecha: '2026-05-13', titulo: 'Recepción oficio SIAU N°201-2025', tipo: 'notificacion' },
      { fecha: '2026-05-18', titulo: 'Vencimiento plazo respuesta (VENCIDO)', tipo: 'vencimiento' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-13', hora: '14:00', autor: 'CL', tipo: 'creacion', desc: 'Plazo creado al recibir oficio' },
      { id: 'a2', fecha: '2026-05-19', hora: '08:00', autor: 'AB', tipo: 'alerta',   desc: 'PLAZO VENCIDO — pendiente regularizar con SIAU' },
    ],
  },
  {
    id: 'pl13',
    titulo: 'Ingreso certificación de tramitación al PJUD',
    cliente: 'Patricia Lagos Vidal',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    tipo: 'PJUD',
    fecha_vencimiento: '2026-05-10',
    responsable: 'AB',
    estado: 'Completado',
    notas: 'Certificación de tramitación ingresada exitosamente en PJUD el 09/05/2026.',
    hitos: [
      { fecha: '2026-05-05', titulo: 'Solicitud certificación requerida por tribunal', tipo: 'resolucion' },
      { fecha: '2026-05-09', titulo: 'Certificación ingresada en PJUD', tipo: 'tarea' },
      { fecha: '2026-05-10', titulo: 'Confirmación de recepción', tipo: 'notificacion' },
    ],
    actividad: [
      { id: 'a1', fecha: '2026-05-05', hora: '11:00', autor: 'AB', tipo: 'creacion',   desc: 'Plazo creado por requerimiento tribunal' },
      { id: 'a2', fecha: '2026-05-09', hora: '15:30', autor: 'AB', tipo: 'completada', desc: 'Ingresado exitosamente en PJUD' },
    ],
  },
]

// ── PJUD Data ──────────────────────────────────────────────────────────────────
export const PJUD_INIT = [
  {
    id: 'pjud_c01', cliente: 'Patricia Lagos Vidal',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    tribunal: 'Juzgado de Letras del Trabajo de Santiago', tipo_causa: 'Laboral', responsable: 'AB',
    movimientos: [
      {
        id: 'm01_01', fecha: '2026-05-15', folio: 'T-20261523-A', presenta: 'Nosotros',
        solicitud: 'Presentación de escrito de contestación de demanda laboral por despido injustificado. Se acompañan: contrato de trabajo, finiquito, liquidaciones de sueldo (marzo–abril 2025) y carta aviso de término de contrato.',
        respuesta: 'Proveyó: Téngase por contestada la demanda en los términos señalados. Fíjase audiencia preparatoria para el día 26 de mayo de 2026, a las 10:00 horas, sala N°3. Notifíquese a las partes.',
        fecha_respuesta: '2026-05-16', fecha_notificacion: '2026-05-17',
        accion_requerida: 'Preparar antecedentes para audiencia preparatoria del 26/05',
        consecuencia_procesal: 'Audiencia preparatoria fijada: 26/05/2026 · 10:00 h · Sala N°3',
        estado: 'Respondida', tiene_documento: true,
        documento_desc: 'Contestación de demanda + 4 documentos', notas: 'Revisar antes de audiencia preparatoria del 26/05.', responsable: 'AB',
      },
      {
        id: 'm01_02', fecha: '2026-05-20', folio: 'T-20261601-B', presenta: 'Nosotros',
        solicitud: 'Solicitud de patrocinio y poder a favor de Andrea Bianchi Lagos, abogada, RUT 12.345.678-9, para representar a la parte demandada en todos los actos del juicio, conforme al artículo 7° del CPC.',
        respuesta: '', fecha_respuesta: null, fecha_notificacion: null,
        accion_requerida: 'Seguimiento pendiente de providencia del tribunal',
        consecuencia_procesal: null,
        estado: 'Pendiente', tiene_documento: true,
        documento_desc: 'Escritura de patrocinio y poder notarial', notas: 'Presentado el 20/05. Esperando providencia.', responsable: 'AB',
      },
      {
        id: 'm01_03', fecha: '2026-05-08', folio: 'T-20261489-C', presenta: 'Nosotros',
        solicitud: 'Solicitud de suspensión de audiencia preparatoria fijada para el 15 de mayo de 2026, por agenda del tribunal y necesidad de obtener antecedentes adicionales.',
        respuesta: 'Resolución: No ha lugar. La audiencia se mantiene en la fecha fijada. La parte solicitante podrá acreditarse mediante poder especial. Notifíquese.',
        fecha_respuesta: '2026-05-09', fecha_notificacion: null,
        accion_requerida: null, consecuencia_procesal: null,
        estado: 'Respondida', tiene_documento: false,
        documento_desc: null, notas: '', responsable: 'AB',
      },
      {
        id: 'm01_04', fecha: '2026-04-28', folio: 'T-20261321-D', presenta: 'Tribunal',
        solicitud: 'Constancia de notificación de demanda por correo certificado conforme al Art. 454 N°2 del Código del Trabajo.',
        respuesta: 'Proveyó: Téngase por notificada la demanda. Corre el plazo legal para contestar de conformidad al artículo 452 del Código del Trabajo.',
        fecha_respuesta: '2026-04-29', fecha_notificacion: '2026-04-30',
        accion_requerida: null, consecuencia_procesal: 'Plazo de 5 días hábiles para contestar demanda',
        estado: 'Respondida', tiene_documento: false,
        documento_desc: null, notas: '', responsable: 'MT',
      },
    ],
  },
  {
    id: 'pjud_c02', cliente: 'Lorena Navarro Pérez',
    causa_rit: 'C-789-2024', causa_ruc: '2100654321-0',
    tribunal: 'Cuarto Juzgado Civil de Santiago', tipo_causa: 'Civil', responsable: 'AB',
    movimientos: [
      {
        id: 'm02_01', fecha: '2026-05-21', folio: 'C-20261234-A', presenta: 'Nosotros',
        solicitud: 'Solicitud urgente de nuevo plazo para presentar escrito de réplica. Se alega imposibilidad material por enfermedad grave del abogado actuante, acreditada con certificado médico.',
        respuesta: '', fecha_respuesta: null, fecha_notificacion: null,
        accion_requerida: 'Gestionar respuesta urgente del tribunal — monitoreo diario',
        consecuencia_procesal: null,
        estado: 'Urgente', tiene_documento: true,
        documento_desc: 'Certificado médico + solicitud', notas: '⚠️ Requiere respuesta urgente. Seguimiento diario.', responsable: 'MT',
      },
      {
        id: 'm02_02', fecha: '2026-05-18', folio: 'C-20261198-B', presenta: 'Nosotros',
        solicitud: 'Presentación escrito de dúplica en causa sobre cobro de honorarios profesionales por $28.500.000. Se adjunta documentación acreditando falta de prestación de los servicios cobrados.',
        respuesta: '', fecha_respuesta: null, fecha_notificacion: null,
        accion_requerida: null, consecuencia_procesal: null,
        estado: 'Sin respuesta', tiene_documento: true,
        documento_desc: 'Escrito dúplica + facturas (6)', notas: 'Sin respuesta desde el 18/05. Monitorear providencia.', responsable: 'AB',
      },
      {
        id: 'm02_03', fecha: '2026-05-12', folio: 'C-20261089-C', presenta: 'Nosotros',
        solicitud: 'Solicitud de medida precautoria de retención de fondos en cuenta corriente del demandado hasta concurrencia de UF 450, conforme al artículo 290 N°2 del CPC.',
        respuesta: 'Resolución: Se rechaza la medida precautoria solicitada por no haberse acompañado antecedentes que constituyan presunción grave del derecho que se reclama. Notifíquese.',
        fecha_respuesta: '2026-05-13', fecha_notificacion: null,
        accion_requerida: 'Evaluar alternativas de aseguramiento de activos con la cliente',
        consecuencia_procesal: null,
        estado: 'Respondida', tiene_documento: false,
        documento_desc: null, notas: 'Solicitud rechazada. Evaluar alternativas con cliente.', responsable: 'AB',
      },
      {
        id: 'm02_04', fecha: '2026-04-30', folio: 'C-20260987-D', presenta: 'Nosotros',
        solicitud: 'Presentación escrito de réplica en causa sobre cobro de honorarios. Se impugnan los argumentos de la contestación y se ratifican fundamentos de la acción con jurisprudencia de apoyo.',
        respuesta: 'Proveyó: Téngase por presentado el escrito de réplica. Se confiere traslado para dúplica por el plazo legal. Notifíquese.',
        fecha_respuesta: '2026-05-01', fecha_notificacion: null,
        accion_requerida: null, consecuencia_procesal: null,
        estado: 'Respondida', tiene_documento: true,
        documento_desc: 'Escrito réplica + jurisprudencia', notas: '', responsable: 'AB',
      },
    ],
  },
  {
    id: 'pjud_c03', cliente: 'Héctor Morales Jiménez',
    causa_rit: 'O-456-2025', causa_ruc: '2200987654-3',
    tribunal: 'Juzgado de Letras del Trabajo de Santiago', tipo_causa: 'Laboral', responsable: 'CL',
    movimientos: [
      {
        id: 'm03_01', fecha: '2026-05-20', folio: 'T-20261588-A', presenta: 'Nosotros',
        solicitud: 'Interposición de recurso de apelación en contra de sentencia definitiva de primera instancia. Se funda en errónea aplicación del artículo 477 del Código del Trabajo respecto al cálculo de las indemnizaciones.',
        respuesta: '', fecha_respuesta: null, fecha_notificacion: null,
        accion_requerida: 'Aguardar resolución sobre concesión o denegación del recurso',
        consecuencia_procesal: null,
        estado: 'Pendiente', tiene_documento: true,
        documento_desc: 'Recurso de apelación', notas: 'Pendiente que tribunal resuelva si concede el recurso.', responsable: 'CL',
      },
      {
        id: 'm03_02', fecha: '2026-05-15', folio: 'T-20261512-B', presenta: 'Tribunal',
        solicitud: 'Notificación de sentencia definitiva en juicio oral laboral. Se acompaña copia íntegra para hacer correr el plazo para recurrir.',
        respuesta: 'Sentencia definitiva: Se acoge la demanda en todas sus partes. Se condena al demandado al pago de $12.450.000 por indemnización sustitutiva del aviso previo, indemnización por años de servicio y feriado proporcional, más reajustes e intereses. Notifíquese personalmente.',
        fecha_respuesta: '2026-05-15', fecha_notificacion: '2026-05-20',
        accion_requerida: 'Interponer recurso de apelación — plazo 5 días hábiles desde notificación',
        consecuencia_procesal: 'Inicio plazo apelación desde notificación el 20/05/2026 — vence 25/05',
        estado: 'Respondida', tiene_documento: true,
        documento_desc: 'Sentencia definitiva (texto íntegro)', notas: 'Sentencia desfavorable. Apelación interpuesta el 20/05.', responsable: 'CL',
      },
      {
        id: 'm03_03', fecha: '2026-05-10', folio: 'T-20261445-C', presenta: 'Nosotros',
        solicitud: 'Presentación de lista de testigos para juicio oral del 13 de mayo de 2026. Se proponen 3 testigos: Jorge Muñoz Pérez, Carmen Díaz Rojas y Felipe Torres Soto.',
        respuesta: 'Proveyó: Téngase por presentada la lista de testigos. Cítese a los testigos individualizados para la audiencia de juicio oral del día 13 de mayo.',
        fecha_respuesta: '2026-05-11', fecha_notificacion: null,
        accion_requerida: null, consecuencia_procesal: null,
        estado: 'Respondida', tiene_documento: false,
        documento_desc: null, notas: '', responsable: 'CL',
      },
      {
        id: 'm03_04', fecha: '2026-04-25', folio: 'T-20261287-D', presenta: 'Nosotros',
        solicitud: 'Solicitud de certificado de ejecutoria de resolución que fijó audiencia preparatoria, para acreditar tramitación ante terceros.',
        respuesta: 'Proveyó: Se accede a lo solicitado. Se otorga certificado de ejecutoria. Retírelo en secretaría del tribunal previa cancelación del arancel correspondiente.',
        fecha_respuesta: '2026-04-26', fecha_notificacion: null,
        accion_requerida: null, consecuencia_procesal: null,
        estado: 'Respondida', tiene_documento: true,
        documento_desc: 'Certificado de ejecutoria', notas: 'Retirado el 27/04. Original en expediente físico.', responsable: 'MT',
      },
    ],
  },
  {
    id: 'pjud_c04', cliente: 'Ana Paula Reyes Soto',
    causa_rit: 'F-1234-2025', causa_ruc: '2300123456-7',
    tribunal: 'Segundo Juzgado de Familia de Santiago', tipo_causa: 'Familia', responsable: 'AB',
    movimientos: [
      {
        id: 'm04_01', fecha: '2026-05-21', folio: 'F-20261567-A', presenta: 'Nosotros',
        solicitud: 'Presentación de demanda de alimentos para hijo menor Martín Reyes Vidal (7 años), Art. 321 CC. Suma demandada: $450.000 mensuales. Se adjuntan certificado de nacimiento y liquidaciones del demandado.',
        respuesta: '', fecha_respuesta: null, fecha_notificacion: null,
        accion_requerida: 'Aguardar providencia y fijación de audiencia preparatoria',
        consecuencia_procesal: null,
        estado: 'Pendiente', tiene_documento: true,
        documento_desc: 'Demanda + cert. nacimiento + liquidaciones', notas: 'Ingresada el 21/05. Esperando proveer.', responsable: 'AB',
      },
      {
        id: 'm04_02', fecha: '2026-05-10', folio: 'F-20261389-B', presenta: 'Nosotros',
        solicitud: 'Solicitud de medida cautelar de alimentos provisorios de $200.000 mensuales, conforme al artículo 22 de la Ley 14.908.',
        respuesta: 'Resolución: Se accede a los alimentos provisorios por $180.000 mensuales a contar del día primero del mes siguiente. Notifíquese al demandado personalmente en el domicilio indicado.',
        fecha_respuesta: '2026-05-11', fecha_notificacion: '2026-05-12',
        accion_requerida: 'Gestionar notificación personal del demandado',
        consecuencia_procesal: 'Alimentos provisorios $180.000/mes a partir del 01/06/2026',
        estado: 'Respondida', tiene_documento: false,
        documento_desc: null, notas: 'Alimentos provisorios $180.000. Pendiente notificar al demandado.', responsable: 'AB',
      },
      {
        id: 'm04_03', fecha: '2026-04-28', folio: 'F-20261201-C', presenta: 'Nosotros',
        solicitud: 'Mandato judicial y poder especial a favor de Andrea Bianchi Lagos para representar a la demandante en todos los actos del presente juicio de alimentos.',
        respuesta: 'Proveyó: Téngase por constituido el patrocinio y poder conforme a los artículos 6° y 7° del CPC. Procédase conforme a derecho.',
        fecha_respuesta: '2026-04-29', fecha_notificacion: null,
        accion_requerida: null, consecuencia_procesal: null,
        estado: 'Respondida', tiene_documento: true,
        documento_desc: 'Poder especial notarial', notas: '', responsable: 'AB',
      },
    ],
  },
]

// ── REVISIONES_INIT ───────────────────────────────────────────────────────────
export const REVISIONES_INIT = {
  '2026-W21': {
    'c01': {
      revisada: true, fecha: '2026-05-19', responsable: 'MT',
      nota: 'Causa preparada para audiencia de juicio del 28/05. Lista de testigos lista (3 confirmados). Pendiente coordinar con el perito su declaración técnica. PJUD sin novedades relevantes.',
      proxima_accion: 'Preparar escrito',
    },
    'c03': {
      revisada: true, fecha: '2026-05-20', responsable: 'AB',
      nota: 'Trámite de disolución SpA avanza según cronograma. Acuerdo firmado por todos los socios. Pendiente: publicación en Diario Oficial antes del 30/05 y protocolización notarial del acuerdo.',
      proxima_accion: 'Seguimiento interno',
    },
    'c09': {
      revisada: true, fecha: '2026-05-21', responsable: 'CL',
      nota: 'Divorcio encaminado con acuerdo regulatorio completo presentado. Audiencia preparatoria fijada 10/06. Pendiente revisar cláusula de bienes comunes y confirmar con el cónyuge.',
      proxima_accion: 'Llamar cliente',
    },
  },
  '2026-W20': {
    'c01': {
      revisada: true, fecha: '2026-05-12', responsable: 'MT',
      nota: 'Revisión PJUD: causa sin novedades. Audiencia preparatoria exitosa realizada. Puntos de prueba fijados correctamente. Testigos identificados.',
      proxima_accion: 'Revisar PJUD',
    },
    'c03': {
      revisada: true, fecha: '2026-05-11', responsable: 'AB',
      nota: 'Acuerdo de disolución firmado en reunión con socios. Iniciando trámites formales ante el Tribunal de Comercio. Sin oposición.',
      proxima_accion: 'Seguimiento interno',
    },
    'c05': {
      revisada: true, fecha: '2026-05-12', responsable: 'CL',
      nota: 'Tutela laboral activa. Medida cautelar en análisis por el tribunal. Enviados correos electrónicos adicionales como prueba complementaria. Cliente informada.',
      proxima_accion: 'Revisar PJUD',
    },
    'c06': {
      revisada: true, fecha: '2026-05-13', responsable: 'AB',
      nota: 'Contestación de demanda presentada correctamente. Audiencia preparatoria fijada para 15/06. Pendiente obtener tasación del inmueble antes de la audiencia.',
      proxima_accion: 'Revisar documentación',
    },
    'c08': {
      revisada: true, fecha: '2026-05-11', responsable: 'MT',
      nota: 'Período de prueba activo. Perito coordinado para visita a terreno el 20/05. Informe final esperado para el 15/06. Demandada ofrece acuerdo pero insuficiente.',
      proxima_accion: 'Esperar resolución',
    },
    'c09': {
      revisada: true, fecha: '2026-05-12', responsable: 'CL',
      nota: 'Demanda de divorcio presentada con acuerdo regulatorio. Procesando trámites iniciales. Cliente satisfecha con el avance. Bien encaminado.',
      proxima_accion: 'Agendar reunión',
    },
    'c11': {
      revisada: true, fecha: '2026-05-13', responsable: 'MT',
      nota: 'Causa laboral por accidente de trabajo. Informe médico de la Mutual anexado correctamente. Pendiente resolución de incapacidad definitiva de la Mutual.',
      proxima_accion: 'Solicitar antecedentes',
    },
    'c14': {
      revisada: true, fecha: '2026-05-12', responsable: 'AB',
      nota: 'Negociación colectiva activa. Propuesta de contrato colectivo enviada al sindicato (IPC+1.5%). Segunda sesión mesa negociación pendiente. Posición del sindicato aún en IPC+4%.',
      proxima_accion: 'Revisar PJUD',
    },
  },
}

// ── SIAU_INIT ──────────────────────────────────────────────────────────────────
export const SIAU_INIT = [
  {
    id: 'siau_c01', cliente: 'Rodrigo Carmona Muñoz',
    causa_rit: 'P-321-2025', causa_ruc: '2400321654-8',
    fiscalia: 'Fiscalía Centro Norte de Santiago',
    fiscal: 'Sr. Francisco Morales Reyes',
    fiscal_email: 'fmorales@fiscaliadechile.cl',
    fiscal_phone: '(02) 2965 0100 ext. 312',
    tipo_causa: 'Penal', materia: 'Robo con violencia · Art. 436 CP',
    responsable: 'MT',
    solicitudes: [
      {
        id: 's01_01', fecha: '2026-04-10', folio: 'SIAU-2026-1021',
        tipo: 'Copia de carpeta investigativa',
        solicitud: 'Se solicita copia íntegra de la carpeta investigativa del Ruc 2400321654-8, incluyendo actas, registros de diligencias, informes periciales y cualquier antecedente recabado durante la investigación, para efectos de ejercer adecuadamente el derecho a defensa del imputado conforme al artículo 182 del Código Procesal Penal.',
        respuesta: 'Se accede a lo solicitado. Se otorgan copias simples de la carpeta investigativa Ruc 2400321654-8, con excepción de las diligencias decretadas como secretas conforme al artículo 182 CPP. Retírelas en la Fiscalía Centro Norte, Av. Libertador Bernardo O\'Higgins 1449, Oficina 312.',
        fecha_respuesta: '2026-04-15', estado: 'Respondida',
        tiene_documento: true, documento_desc: 'Copia carpeta investigativa (parcial)',
        notas: 'Retirada el 16/04. Parte decretada secreta. Evaluar alzamiento.',
        responsable: 'MT', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-10', texto: 'Solicitud ingresada vía SIAU', autor: 'MT', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-15', texto: 'Fiscalía responde: accede parcialmente. Parte de carpeta decretada secreta', autor: 'MT', tipo: 'respuesta' },
          { id: 't03', fecha: '2026-04-16', texto: 'Copias retiradas en Fiscalía Centro Norte, Oficina 312', autor: 'MT', tipo: 'nota' },
        ],
      },
      {
        id: 's01_02', fecha: '2026-04-20', folio: 'SIAU-2026-1154',
        tipo: 'Solicitud de entrevista / audiencia',
        solicitud: 'Se solicita audiencia con el Fiscal Sr. Francisco Morales Reyes, para tratar aspectos relativos a la defensa del imputado en la causa Ruc 2400321654-8, en particular la procedencia de formalización y las medidas cautelares solicitadas.',
        respuesta: '', fecha_respuesta: null, estado: 'Sin respuesta',
        tiene_documento: false, documento_desc: null,
        notas: 'Nunca llamaron. 3 intentos de contacto telefónico fallidos.',
        responsable: 'MT', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-20', texto: 'Solicitud de entrevista con Fiscal Morales Reyes ingresada', autor: 'MT', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-25', texto: 'Sin respuesta. Primer llamado telefónico sin éxito', autor: 'MT', tipo: 'alerta' },
          { id: 't03', fecha: '2026-04-30', texto: 'Funcionaria indica que el fiscal tiene agenda llena, revisará', autor: 'MT', tipo: 'seguimiento' },
          { id: 't04', fecha: '2026-05-05', texto: 'Tercer llamado. Nadie contesta extensión directa', autor: 'MT', tipo: 'alerta' },
          { id: 't05', fecha: '2026-05-10', texto: 'Se envía correo a fiscaliacentronorte@fiscaliadechile.cl reiterando urgencia', autor: 'MT', tipo: 'seguimiento' },
          { id: 't06', fecha: '2026-05-15', texto: 'Nunca llamaron. Sin respuesta desde la Fiscalía', autor: 'MT', tipo: 'alerta' },
        ],
      },
      {
        id: 's01_03', fecha: '2026-04-25', folio: 'SIAU-2026-1198',
        tipo: 'Solicitud de diligencias',
        solicitud: 'Se solicita a la Fiscalía decretar diligencia de peritaje psicológico del imputado, a fin de acreditar que al momento de los hechos su capacidad volitiva se encontraba disminuida, antecedente relevante para la determinación de la pena conforme al artículo 11 N°1 del Código Penal.',
        respuesta: 'No ha lugar. Las diligencias solicitadas no son pertinentes para los fines de la investigación en esta etapa procesal. Sin perjuicio del derecho de la defensa de solicitarlo en audiencia de preparación del juicio oral.',
        fecha_respuesta: '2026-04-28', estado: 'No ha lugar',
        tiene_documento: false, documento_desc: null,
        notas: 'Rechazada. Considerar reiterar en audiencia de preparación.',
        responsable: 'MT', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-25', texto: 'Solicitud de peritaje psicológico ingresada', autor: 'MT', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-28', texto: 'No ha lugar — pueden reiterarlo en audiencia de preparación', autor: 'MT', tipo: 'respuesta' },
        ],
      },
      {
        id: 's01_04', fecha: '2026-05-15', folio: 'SIAU-2026-1489',
        tipo: 'Solicitud de documentos específicos',
        solicitud: 'Se solicita copia del informe de alcoholemia practicado al imputado al momento de su detención el 18 de marzo de 2026, a fin de incorporarlo como prueba de descargo conforme al artículo 295 del Código Procesal Penal.',
        respuesta: '', fecha_respuesta: null, estado: 'Pendiente',
        tiene_documento: false, documento_desc: null,
        notas: 'Presentada el 15/05. Esperando que Fiscalía remita informe.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-05-15', texto: 'Solicitud de informe de alcoholemia ingresada', autor: 'AB', tipo: 'solicitud' },
        ],
      },
      {
        id: 's01_05', fecha: '2026-05-20', folio: 'SIAU-2026-1589',
        tipo: 'Solicitud de entrevista / audiencia',
        solicitud: 'REITERACIÓN URGENTE. Se reitera por segunda vez la solicitud de entrevista con el Fiscal Sr. Francisco Morales Reyes (folio SIAU-2026-1154, 20/04/2026). Transcurridos más de 30 días sin respuesta. Audiencia de formalización fijada para el 28 de mayo de 2026, lo que hace imprescindible coordinar la estrategia de defensa con carácter urgente.',
        respuesta: '', fecha_respuesta: null, estado: 'Urgente',
        tiene_documento: false, documento_desc: null,
        notas: '⚠️ Reiteración urgente. Audiencia formalización 28/05. Sin respuesta es inviable preparar la defensa.',
        responsable: 'MT', vinculada_a: 's01_02',
        timeline: [
          { id: 't01', fecha: '2026-05-20', texto: 'Segunda reiteración de solicitud de entrevista', autor: 'MT', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-05-21', texto: 'Se llama directamente a la jefatura de la Fiscalía Centro Norte', autor: 'MT', tipo: 'seguimiento' },
        ],
      },
    ],
  },
  {
    id: 'siau_c02', cliente: 'Sebastián Fuentes Herrera',
    causa_rit: 'P-876-2025', causa_ruc: '2500876543-2',
    fiscalia: 'Fiscalía Sur de Santiago',
    fiscal: 'Sra. Carmen Díaz Varela',
    fiscal_email: 'cdiaz@fiscaliadechile.cl',
    fiscal_phone: '(02) 2965 0200 ext. 218',
    tipo_causa: 'Penal', materia: 'Amenazas reiteradas y lesiones leves · Art. 296 y 399 CP',
    responsable: 'AB',
    solicitudes: [
      {
        id: 's02_01', fecha: '2026-03-15', folio: 'SIAU-2026-0712',
        tipo: 'Solicitud de información',
        solicitud: 'En representación de la víctima, se solicita informar el estado de avance de la investigación por amenazas y lesiones, las diligencias realizadas hasta la fecha, y si se ha formalizado cargos contra el imputado.',
        respuesta: 'Se informa que la investigación se encuentra en etapa de recopilación de antecedentes. Se han practicado 2 declaraciones de testigos. Pendiente el informe de lesiones del Servicio Médico Legal. La Fiscalía estimará la procedencia de formalización una vez reunidos antecedentes suficientes.',
        fecha_respuesta: '2026-03-20', estado: 'Respondida',
        tiene_documento: false, documento_desc: null,
        notas: 'Respuesta satisfactoria. Pendiente informe SML.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-03-15', texto: 'Solicitud de información sobre estado de investigación', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-03-20', texto: 'Fiscalía informa: 2 testigos declarados, pendiente informe SML', autor: 'AB', tipo: 'respuesta' },
        ],
      },
      {
        id: 's02_02', fecha: '2026-04-05', folio: 'SIAU-2026-0934',
        tipo: 'Copia de carpeta investigativa',
        solicitud: 'Se solicita copia de la carpeta investigativa del Ruc 2500876543-2, en calidad de víctima representada, a fin de evaluar las diligencias practicadas y verificar la incorporación del informe pericial del SML.',
        respuesta: 'Se accede a la solicitud. Se otorga copia íntegra de la carpeta investigativa, incluyendo el informe de lesiones del SML N°2026-4521, declaraciones testimoniales y registro de la denuncia original.',
        fecha_respuesta: '2026-04-08', estado: 'Respondida',
        tiene_documento: true, documento_desc: 'Carpeta investigativa + Informe SML N°2026-4521',
        notas: 'Informe SML confirma lesiones leves. Buen antecedente para la formalización.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-05', texto: 'Solicitud de copia de carpeta investigativa', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-08', texto: 'Fiscalía accede íntegramente. Incluye Informe SML N°2026-4521', autor: 'AB', tipo: 'respuesta' },
          { id: 't03', fecha: '2026-04-09', texto: 'Copia retirada en Fiscalía Sur, Vicuña Mackenna 270', autor: 'AB', tipo: 'nota' },
        ],
      },
      {
        id: 's02_03', fecha: '2026-04-20', folio: 'SIAU-2026-1089',
        tipo: 'Solicitud de entrevista / audiencia',
        solicitud: 'Se solicita entrevista con la Fiscal Sra. Carmen Díaz Varela, para presentar antecedentes adicionales sobre hechos de amenazas posteriores a la denuncia original, ocurridos los días 10 y 15 de abril de 2026, y solicitar el aumento de medidas de protección vigentes.',
        respuesta: '', fecha_respuesta: null, estado: 'Sin respuesta',
        tiene_documento: true, documento_desc: 'Capturas pantalla amenazas WhatsApp (14 imgs)',
        notas: 'Nunca llamaron. Hechos nuevos que podrían cambiar la calificación del delito.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-20', texto: 'Solicitud de entrevista para presentar nuevos antecedentes', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-27', texto: 'Sin respuesta. Llamado telefónico — línea ocupada', autor: 'AB', tipo: 'alerta' },
          { id: 't03', fecha: '2026-05-04', texto: 'Se concurre presencialmente. Funcionario indica que lo pondrá en agenda del fiscal', autor: 'AB', tipo: 'seguimiento' },
          { id: 't04', fecha: '2026-05-12', texto: 'Nunca llamaron. Seguimiento sin resultado', autor: 'AB', tipo: 'alerta' },
        ],
      },
      {
        id: 's02_04', fecha: '2026-05-10', folio: 'SIAU-2026-1345',
        tipo: 'Solicitud de diligencias',
        solicitud: 'Se solicita practicar peritaje informático sobre el dispositivo móvil del imputado, a fin de extraer los mensajes de WhatsApp que constituyen amenazas reiteradas contra la víctima, conforme al artículo 219 del Código Procesal Penal.',
        respuesta: 'No ha lugar. La diligencia solicitada requiere autorización judicial. La Fiscalía podrá evaluar su solicitud al juez de garantía en la audiencia de formalización si estima pertinente.',
        fecha_respuesta: '2026-05-14', estado: 'No ha lugar',
        tiene_documento: false, documento_desc: null,
        notas: 'Rechazada. Requiere solicitud judicial. Preparar para audiencia.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-05-10', texto: 'Solicitud de peritaje informático dispositivo móvil imputado', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-05-14', texto: 'No ha lugar — requiere autorización judicial del juez de garantía', autor: 'AB', tipo: 'respuesta' },
        ],
      },
      {
        id: 's02_05', fecha: '2026-05-20', folio: 'SIAU-2026-1578',
        tipo: 'Solicitud de información',
        solicitud: 'Se solicita informar fecha estimada para la audiencia de formalización y si la Fiscalía ha solicitado medidas cautelares adicionales para la víctima, considerando la existencia de nuevos hechos de amenazas ocurridos en abril de 2026.',
        respuesta: '', fecha_respuesta: null, estado: 'Pendiente',
        tiene_documento: false, documento_desc: null,
        notas: 'Ingresada el 20/05. Urge conocer fecha de formalización.',
        responsable: 'CL', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-05-20', texto: 'Solicitud de información sobre fecha de formalización', autor: 'CL', tipo: 'solicitud' },
        ],
      },
    ],
  },
  {
    id: 'siau_c03', cliente: 'Isabel Rodríguez Vega',
    causa_rit: 'P-112-2026', causa_ruc: '2600112233-4',
    fiscalia: 'Fiscalía Oriente de Santiago',
    fiscal: 'Sr. Patricio Valdés Arriagada',
    fiscal_email: 'pvaldes@fiscaliadechile.cl',
    fiscal_phone: '(02) 2965 0300 ext. 447',
    tipo_causa: 'Penal', materia: 'Estafa · Art. 468 CP · $8.400.000',
    responsable: 'AB',
    solicitudes: [
      {
        id: 's03_01', fecha: '2026-04-02', folio: 'SIAU-2026-0823',
        tipo: 'Solicitud de información',
        solicitud: 'Querellante solicita información sobre el estado actual de la investigación por estafa, si se ha identificado al imputado, cuáles han sido las diligencias practicadas y en qué etapa procesal se encuentra la causa.',
        respuesta: 'Se informa que la investigación se encuentra activa. El imputado ha sido individualizado como Carlos Eduardo Pinto Yáñez, RUT 15.432.765-K. Se han practicado: registro de domicilio, incautación de documentos y declaración de 4 testigos. La Fiscalía evalúa la procedencia de formalización.',
        fecha_respuesta: '2026-04-07', estado: 'Respondida',
        tiene_documento: false, documento_desc: null,
        notas: 'Imputado identificado. Registro y declaraciones practicadas.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-02', texto: 'Solicitud de información sobre estado de investigación', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-07', texto: 'Fiscalía informa: imputado identificado (Pinto Yáñez, RUT 15.432.765-K)', autor: 'AB', tipo: 'respuesta' },
        ],
      },
      {
        id: 's03_02', fecha: '2026-04-15', folio: 'SIAU-2026-0991',
        tipo: 'Copia de carpeta investigativa',
        solicitud: 'Se solicita copia de la carpeta investigativa Ruc 2600112233-4, en calidad de querellante, incluyendo registros de incautación, declaraciones testimoniales e informes de diligencias practicadas por la PDI.',
        respuesta: 'Se accede parcialmente. Se otorgan copias de declaraciones y registro de incautación. Los informes de PDI se encuentran reservados mientras continúa la investigación activa, conforme al art. 182 CPP.',
        fecha_respuesta: '2026-04-18', estado: 'Respondida',
        tiene_documento: true, documento_desc: 'Declaraciones + acta de incautación',
        notas: 'Parcialmente concedida. Informes PDI reservados. Retirado 19/04.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-15', texto: 'Solicitud de copia de carpeta como querellante', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-04-18', texto: 'Accedida parcialmente. Informes PDI reservados (art. 182 CPP)', autor: 'AB', tipo: 'respuesta' },
          { id: 't03', fecha: '2026-04-19', texto: 'Documentos retirados en Fiscalía Oriente', autor: 'AB', tipo: 'nota' },
        ],
      },
      {
        id: 's03_03', fecha: '2026-04-28', folio: 'SIAU-2026-1212',
        tipo: 'Solicitud de entrevista / audiencia',
        solicitud: 'Se solicita entrevista con el Fiscal Sr. Patricio Valdés Arriagada para presentar documentación adicional: correos electrónicos, transferencias bancarias y contratos falsos aportados por la querellante (18 documentos), que constituyen prueba directa de la estafa.',
        respuesta: '', fecha_respuesta: null, estado: 'Sin respuesta',
        tiene_documento: true, documento_desc: 'Correos + comprobantes bancarios (18 docs)',
        notas: 'Nunca llamaron. Tenemos documentos clave que la Fiscalía no ha revisado.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-04-28', texto: 'Solicitud de entrevista para presentar 18 documentos de prueba', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-05-05', texto: 'Sin respuesta. Llamada: fiscal tiene mucha carga de trabajo', autor: 'AB', tipo: 'alerta' },
          { id: 't03', fecha: '2026-05-12', texto: 'Se envían documentos escaneados al correo de la Fiscalía Oriente', autor: 'AB', tipo: 'seguimiento' },
          { id: 't04', fecha: '2026-05-18', texto: 'Nunca llamaron. Sin confirmación de recepción del correo', autor: 'AB', tipo: 'alerta' },
        ],
      },
      {
        id: 's03_04', fecha: '2026-05-05', folio: 'SIAU-2026-1298',
        tipo: 'Solicitud de diligencias',
        solicitud: 'Se solicita peritaje contable sobre documentos societarios del imputado, a fin de acreditar la estructura de empresa ficticia utilizada para perpetrar la estafa y dimensionar el volumen total de víctimas y monto defraudado.',
        respuesta: 'No ha lugar en esta etapa. La Fiscalía Oriente cuenta con sus propios peritos y las diligencias han sido instruidas conforme al plan investigativo.',
        fecha_respuesta: '2026-05-09', estado: 'No ha lugar',
        tiene_documento: false, documento_desc: null,
        notas: 'Fiscalía tiene peritos propios. Monitorear si el peritaje oficial es suficiente.',
        responsable: 'AB', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-05-05', texto: 'Solicitud de peritaje contable documentos societarios', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-05-09', texto: 'No ha lugar — Fiscalía cuenta con peritos propios', autor: 'AB', tipo: 'respuesta' },
        ],
      },
      {
        id: 's03_05', fecha: '2026-05-15', folio: 'SIAU-2026-1456',
        tipo: 'Solicitud de información',
        solicitud: 'Se solicita informar si existen otras víctimas identificadas en la misma causa o causas relacionadas con el imputado Carlos Eduardo Pinto Yáñez, RUT 15.432.765-K, con el fin de coordinar acciones conjuntas de persecución penal.',
        respuesta: '', fecha_respuesta: null, estado: 'Pendiente',
        tiene_documento: false, documento_desc: null,
        notas: 'Sospechas de más víctimas. Información relevante para dimensionar la estafa.',
        responsable: 'CL', vinculada_a: null,
        timeline: [
          { id: 't01', fecha: '2026-05-15', texto: 'Solicitud de información sobre otras posibles víctimas', autor: 'CL', tipo: 'solicitud' },
        ],
      },
      {
        id: 's03_06', fecha: '2026-05-21', folio: 'SIAU-2026-1601',
        tipo: 'Solicitud de entrevista / audiencia',
        solicitud: 'REITERACIÓN URGENTE (tercera vez). Se reitera por tercera vez la solicitud de entrevista con el Fiscal Sr. Patricio Valdés Arriagada (folio SIAU-2026-1212, 28/04/2026). Transcurridos más de 23 días sin respuesta. Los 18 documentos aportados son ESENCIALES para la formalización. Se solicita respuesta en plazo máximo de 48 horas.',
        respuesta: '', fecha_respuesta: null, estado: 'Urgente',
        tiene_documento: false, documento_desc: null,
        notas: '⚠️ Tercera reiteración. Documentación crítica sin que Fiscalía la haya revisado. Considerar queja ante fiscal regional.',
        responsable: 'AB', vinculada_a: 's03_03',
        timeline: [
          { id: 't01', fecha: '2026-05-21', texto: 'Tercera reiteración de solicitud de entrevista', autor: 'AB', tipo: 'solicitud' },
          { id: 't02', fecha: '2026-05-21', texto: 'Se informa situación directamente al Fiscal Regional de la Fiscalía Oriente', autor: 'AB', tipo: 'seguimiento' },
        ],
      },
    ],
  },
]

// ── REUNIONES_INIT ────────────────────────────────────────────────────────────
export const REUNIONES_INIT = [
  {
    id: 'ru01',
    fecha: '2026-05-28',
    hora_inicio: '09:00',
    hora_fin: null,
    estado: 'Programada',
    tipo: 'Reunión semanal',
    participantes: ['MT', 'AB', 'CL'],
    bandeja: [
      { id: 'b01', texto: 'Estado causa Carmona — formalización 28/05, estrategia defensa', tipo: 'causa', autor: 'MT', fecha: '2026-05-21', discutido: false },
      { id: 'b02', texto: 'Plazo vencido réplica Navarro (C-789-2024) — gestión urgente tribunal', tipo: 'urgente', autor: 'AB', fecha: '2026-05-22', discutido: false },
      { id: 'b03', texto: 'Cobro honorarios Lagos Vidal — 2ª cuota pendiente', tipo: 'administrativo', autor: 'CL', fecha: '2026-05-20', discutido: false },
      { id: 'b04', texto: 'Recurso de apelación laboral Morales — presentación antes del 25/05', tipo: 'causa', autor: 'CL', fecha: '2026-05-22', discutido: false },
    ],
    causas_discutidas: [],
    decisiones: [],
    tareas_ids: [],
    proxima_accion: '',
    proxima_reunion: null,
    minuta: '',
  },
  {
    id: 'ru02',
    fecha: '2026-05-21',
    hora_inicio: '09:00',
    hora_fin: '10:15',
    estado: 'Finalizada',
    tipo: 'Reunión semanal',
    participantes: ['MT', 'AB', 'CL'],
    bandeja: [
      { id: 'b01', texto: 'Actualización causa penal Fuentes Herrera — audiencia formalización realizada', tipo: 'causa', autor: 'AB', fecha: '2026-05-15', discutido: true },
      { id: 'b02', texto: 'Revisar distribución de carga de trabajo semana 22', tipo: 'administrativo', autor: 'MT', fecha: '2026-05-18', discutido: true },
      { id: 'b03', texto: 'Expediente Espinoza Torres — coordinación con perito psicólogo urgente', tipo: 'causa', autor: 'CL', fecha: '2026-05-19', discutido: true },
    ],
    causas_discutidas: [
      { id: 'cd01', rit: 'P-321-2025', cliente: 'Rodrigo Carmona Muñoz', materia: 'Penal — Robo con violencia', nota: 'Formalización programada para el 28/05. MT lidera la defensa. Estrategia: medidas cautelares alternativas. Preparar escrito de arraigo con declaraciones familiares y certificado antecedentes.', responsable: 'MT' },
      { id: 'cd02', rit: 'F-9012-2025', cliente: 'Camila Espinoza Torres', materia: 'Familia — VIF y divorcio', nota: 'Medida de alejamiento vigente 6 meses. AB coordinando reunión con perito psicólogo esta semana. Informe necesario antes del 15/06 para demanda de divorcio por culpa.', responsable: 'AB' },
      { id: 'cd03', rit: 'O-456-2025', cliente: 'Héctor Morales Jiménez', materia: 'Laboral — despido injustificado', nota: 'Sentencia desfavorable en primera instancia. CL evaluó fundamentos del recurso de apelación. Plazo apelación vence 25/05. Recurso en preparación — buen argumento por forma y fondo del despido.', responsable: 'CL' },
    ],
    decisiones: [
      { id: 'd01', texto: 'MT presentará escrito de arraigo para causa Carmona antes del 27/05', responsable: 'MT', fecha_limite: '2026-05-27', completada: false },
      { id: 'd02', texto: 'AB coordinará reunión con perito psicólogo antes del viernes 22/05', responsable: 'AB', fecha_limite: '2026-05-22', completada: true },
      { id: 'd03', texto: 'CL finalizará recurso de apelación causa Morales antes del 24/05', responsable: 'CL', fecha_limite: '2026-05-24', completada: false },
      { id: 'd04', texto: 'Enviar recordatorio de honorarios pendientes a Lagos Vidal esta semana', responsable: 'MT', fecha_limite: '2026-05-23', completada: false },
    ],
    tareas_ids: ['ta01', 'ta11'],
    proxima_accion: 'Próxima reunión jueves 28/05 a las 09:00. Traer avance recurso de apelación Morales y estado causa Carmona post-formalización.',
    proxima_reunion: '2026-05-28',
    minuta: 'Reunión del 21/05/2026 · 09:00 a 10:15. Asistieron Macarena Taverne, Angélica Bianchi y Catalina Leiva.\n\nPrincipal foco: preparación formalización Carmona (28/05), apelación laboral Morales (plazo 25/05) y coordinación con perito Espinoza Torres.\n\nSe distribuyeron tareas con plazos específicos y se fijó próxima reunión para el jueves 28/05.',
  },
  {
    id: 'ru03',
    fecha: '2026-05-14',
    hora_inicio: '09:00',
    hora_fin: '09:50',
    estado: 'Finalizada',
    tipo: 'Reunión semanal',
    participantes: ['MT', 'AB', 'CL'],
    bandeja: [
      { id: 'b01', texto: 'Ingreso demanda laboral Lagos Vidal al PJUD — coordinación final', tipo: 'causa', autor: 'AB', fecha: '2026-05-12', discutido: true },
      { id: 'b02', texto: 'Nuevos antecedentes causa Fuentes Herrera — capturas WhatsApp amenazas abril', tipo: 'urgente', autor: 'AB', fecha: '2026-05-13', discutido: true },
      { id: 'b03', texto: 'Revisión distribución de causas y carga horaria general del estudio', tipo: 'administrativo', autor: 'MT', fecha: '2026-05-13', discutido: true },
    ],
    causas_discutidas: [
      { id: 'cd01', rit: 'O-234-2025', cliente: 'Patricia Lagos Vidal', materia: 'Laboral — despido injustificado', nota: 'Demanda lista para ingreso. AB confirmó que todos los documentos están adjuntos. Arancel ya pagado. Se acuerda ingresar al PJUD antes del 16/05.', responsable: 'AB' },
      { id: 'cd02', rit: 'P-876-2025', cliente: 'Sebastián Fuentes Herrera', materia: 'Penal — Amenazas y lesiones', nota: 'AB presenta capturas WhatsApp de nuevas amenazas del 10 y 15 de abril. Se acuerda solicitar entrevista urgente con fiscal Díaz Varela para ampliar medidas de protección.', responsable: 'AB' },
    ],
    decisiones: [
      { id: 'd01', texto: 'AB ingresará demanda laboral Lagos Vidal al PJUD antes del 16/05', responsable: 'AB', fecha_limite: '2026-05-16', completada: true },
      { id: 'd02', texto: 'AB solicitará entrevista urgente con fiscal Díaz Varela por nuevas amenazas', responsable: 'AB', fecha_limite: '2026-05-17', completada: true },
      { id: 'd03', texto: 'MT revisará y actualizará estado de todos los plazos activos', responsable: 'MT', fecha_limite: '2026-05-21', completada: true },
    ],
    tareas_ids: ['ta10'],
    proxima_accion: 'Reunión semanal jueves 21/05 a las 09:00. Traer actualización causa Fuentes Herrera y avance demanda Lagos Vidal.',
    proxima_reunion: '2026-05-21',
    minuta: 'Reunión del 14/05/2026 · 09:00 a 09:50. Temas principales: ingreso demanda laboral Lagos Vidal y nuevos antecedentes causa penal Fuentes Herrera. Se delegaron tareas concretas con plazos definidos.',
  },
  {
    id: 'ru04',
    fecha: '2026-05-07',
    hora_inicio: '09:00',
    hora_fin: '10:00',
    estado: 'Finalizada',
    tipo: 'Reunión semanal',
    participantes: ['MT', 'AB', 'CL'],
    bandeja: [
      { id: 'b01', texto: 'Revisión general estado de causas activas y prioridades semana', tipo: 'general', autor: 'MT', fecha: '2026-05-05', discutido: true },
      { id: 'b02', texto: 'Planificación audiencias semana del 14/05', tipo: 'audiencia', autor: 'CL', fecha: '2026-05-06', discutido: true },
    ],
    causas_discutidas: [
      { id: 'cd01', rit: 'F-1234-2025', cliente: 'Ana Paula Reyes Soto', materia: 'Familia — alimentos', nota: 'Audiencia preparatoria 21/05. MT preparará lista de testigos y documentación completa. Confirmar asistencia del perito psicólogo antes del 18/05.', responsable: 'MT' },
    ],
    decisiones: [
      { id: 'd01', texto: 'MT preparará toda la documentación para audiencia Reyes Soto del 21/05', responsable: 'MT', fecha_limite: '2026-05-20', completada: true },
      { id: 'd02', texto: 'CL realizará revisión general de honorarios pendientes y cobros', responsable: 'CL', fecha_limite: '2026-05-14', completada: true },
    ],
    tareas_ids: [],
    proxima_accion: 'Reunión semanal jueves 14/05 a las 09:00.',
    proxima_reunion: '2026-05-14',
    minuta: 'Reunión del 07/05/2026 · 09:00 a 10:00. Revisión general del estado del estudio y planificación de audiencias de la semana siguiente.',
  },
]

// ── PLANTILLAS_INIT ───────────────────────────────────────────────────────────
export const PLANTILLAS_INIT = [
  {
    id: 'tmpl01', nombre: 'Demanda de alimentos', tipo: 'Demanda', categoria: 'Familia',
    descripcion: 'Demanda completa para juicio de alimentos, Art. 321 CC y Ley 14.908.',
    variables: ['{{CLIENTE}}','{{RIT}}','{{TRIBUNAL}}','{{ABOGADA}}','{{DEMANDADO}}','{{MONTO}}','{{FECHA}}'],
    contenido: `EN LO PRINCIPAL: Deduce demanda de alimentos. OTROSÍ: Solicita alimentos provisorios.

SEÑOR JUEZ DE FAMILIA:

{{CLIENTE}}, representada por la abogada {{ABOGADA}}, en causa RIT {{RIT}}, ante Ud. respetuosamente digo:

Que vengo en deducir demanda de alimentos en contra de {{DEMANDADO}}, conforme a lo dispuesto en los artículos 321 y siguientes del Código Civil y la Ley N° 14.908.

PETICIÓN CONCRETA: Solicito se fije una pensión de alimentos de \${{MONTO}} mensuales, más reajuste IPC, a favor de mi representada.

OTROSÍ: Solicito como alimentos provisorios la suma de \${{MONTO}} mensuales mientras dure el presente juicio.`,
  },
  {
    id: 'tmpl02', nombre: 'Recurso de apelación', tipo: 'Recurso', categoria: 'General',
    descripcion: 'Recurso de apelación genérico para materias civil, laboral o familia.',
    variables: ['{{CLIENTE}}','{{RIT}}','{{TRIBUNAL_ALZADA}}','{{ABOGADA}}','{{FECHA_SENTENCIA}}'],
    contenido: `RECURSO DE APELACIÓN

SEÑOR PRESIDENTE DE LA {{TRIBUNAL_ALZADA}}:

{{ABOGADA}}, abogada, en representación de {{CLIENTE}}, en autos RIT {{RIT}}, interpone recurso de apelación en contra de la sentencia definitiva de fecha {{FECHA_SENTENCIA}}, conforme a los siguientes fundamentos:

FUNDAMENTOS DEL RECURSO

Primero: La sentencia recurrida infringe el artículo [X] al no considerar los elementos de prueba acompañados en autos.

Segundo: Los hechos establecidos no justifican la conclusión de derecho a la que arriba el sentenciador.

PETICIÓN: Solicita revocar la sentencia apelada y en su lugar dictar sentencia favorable a mi parte.`,
  },
  {
    id: 'tmpl03', nombre: 'Solicitud SIAU', tipo: 'Escrito judicial', categoria: 'Penal',
    descripcion: 'Solicitud estándar al Sistema de Información y Atención Ciudadana de la Fiscalía.',
    variables: ['{{CLIENTE}}','{{RUC}}','{{FISCALIA}}','{{FISCAL}}','{{TIPO_SOLICITUD}}','{{ABOGADA}}','{{FECHA}}'],
    contenido: `SOLICITUD SIAU N° [FOLIO]

{{FISCALIA}}
Atención: {{FISCAL}}
Fecha: {{FECHA}}

De: {{ABOGADA}}, abogada defensora de {{CLIENTE}}
Re: {{TIPO_SOLICITUD}} — RUC {{RUC}}

Por medio de la presente, y en ejercicio de los derechos que la ley confiere a los intervinientes del proceso penal, solicito respetuosamente:

{{TIPO_SOLICITUD}}

Lo anterior es necesario para ejercer adecuadamente el derecho a defensa técnica consagrado en el artículo 8° del Código Procesal Penal.

Saluda atentamente,
{{ABOGADA}}`,
  },
  {
    id: 'tmpl04', nombre: 'Minuta de reunión', tipo: 'Minuta', categoria: 'Interno',
    descripcion: 'Minuta formal de reunión con secciones estándar.',
    variables: ['{{FECHA}}','{{PARTICIPANTES}}','{{TEMAS}}','{{DECISIONES}}','{{PROXIMA_REUNION}}'],
    contenido: `MINUTA DE REUNIÓN

Fecha: {{FECHA}}
Participantes: {{PARTICIPANTES}}
Lugar: Estudio Bianchi Leiva Abogadas

TEMAS TRATADOS

{{TEMAS}}

DECISIONES TOMADAS

{{DECISIONES}}

COMPROMISOS Y PLAZOS

[Detallar compromisos adquiridos y responsables]

PRÓXIMA REUNIÓN

{{PROXIMA_REUNION}}`,
  },
  {
    id: 'tmpl05', nombre: 'Escrito de medidas cautelares', tipo: 'Escrito judicial', categoria: 'Penal',
    descripcion: 'Solicitud de medidas cautelares alternativas a la prisión preventiva.',
    variables: ['{{CLIENTE}}','{{RIT}}','{{TRIBUNAL}}','{{ABOGADA}}','{{MEDIDAS_SOLICITADAS}}'],
    contenido: `EN LO PRINCIPAL: Solicita medidas cautelares alternativas. OTROSÍ: Acredita arraigo.

SEÑOR JUEZ DE GARANTÍA:

{{ABOGADA}}, abogada defensora de {{CLIENTE}}, en causa RIT {{RIT}}, ante Ud. dice:

Que conforme a lo dispuesto en el artículo 155 del Código Procesal Penal, solicita la imposición de las siguientes medidas cautelares en sustitución de la prisión preventiva:

{{MEDIDAS_SOLICITADAS}}

FUNDAMENTOS

Mi representado presenta arraigo suficiente, no registra antecedentes penales previos, y cuenta con vínculos familiares estables que garantizan su comparecencia a los actos del procedimiento.

PETICIÓN: Que se acojan las medidas cautelares alternativas solicitadas.`,
  },
  {
    id: 'tmpl06', nombre: 'Contrato de honorarios', tipo: 'Contrato', categoria: 'Interno',
    descripcion: 'Contrato estándar de prestación de servicios jurídicos y honorarios profesionales.',
    variables: ['{{CLIENTE}}','{{RUT_CLIENTE}}','{{ABOGADA}}','{{CAUSA}}','{{HONORARIOS}}','{{FECHA}}'],
    contenido: `CONTRATO DE PRESTACIÓN DE SERVICIOS JURÍDICOS

En Santiago, a {{FECHA}}, entre:

CLIENTE: {{CLIENTE}}, RUT {{RUT_CLIENTE}}, en adelante "el cliente".
ABOGADA: {{ABOGADA}}, abogada, Colegio de Abogados de Chile.

OBJETO: La abogada se obliga a prestar servicios jurídicos de representación judicial y extrajudicial en la causa {{CAUSA}}.

HONORARIOS: Se fijan honorarios en \${{HONORARIOS}}, pagaderos en cuotas según el siguiente calendario: [detallar cuotas].

GASTOS: Los gastos procesales (tasas, notificaciones, peritos) serán de cargo del cliente y serán informados previamente.

CONFIDENCIALIDAD: Ambas partes se obligan a guardar estricta confidencialidad sobre la información del presente caso.

Para constancia, firman:

_________________________              _________________________
El Cliente                              La Abogada`,
  },
  {
    id: 'tmpl07', nombre: 'Querella criminal', tipo: 'Querella', categoria: 'Penal',
    descripcion: 'Querella criminal estándar con exposición de hechos y calificación jurídica.',
    variables: ['{{QUERELLANTE}}','{{QUERELLADO}}','{{DELITO}}','{{TRIBUNAL}}','{{ABOGADA}}','{{HECHOS}}','{{FECHA_HECHOS}}'],
    contenido: `QUERELLA CRIMINAL

SEÑOR JUEZ DE GARANTÍA:

{{ABOGADA}}, abogada, en representación de {{QUERELLANTE}}, ante Ud. interpone querella criminal en contra de {{QUERELLADO}}, por el delito de {{DELITO}}.

I. HECHOS

{{HECHOS}}

II. CALIFICACIÓN JURÍDICA

Los hechos expuestos son constitutivos del delito de {{DELITO}}, previsto y sancionado en el artículo [X] del Código Penal/Ley [X].

III. DILIGENCIAS INVESTIGATIVAS

Solicita: 1) Declaración del querellado; 2) Incautación de documentos; 3) Pericia informática sobre dispositivos.

PETICIÓN: Admitir la presente querella a tramitación y practicar las diligencias solicitadas.`,
  },
]

// ── DOCUMENTOS_INIT ───────────────────────────────────────────────────────────
export const DOCUMENTOS_INIT = [
  {
    id: 'doc01',
    nombre: 'Escrito de contestación demanda laboral',
    tipo: 'Escrito judicial',
    fecha_creacion: '2026-05-15',
    fecha_modificacion: '2026-05-20',
    estado: 'finalizado',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    cliente: 'Patricia Lagos Vidal',
    tribunal: 'Juzgado del Trabajo de Ñuñoa',
    responsable: 'AB',
    etiquetas: ['laboral', 'contestación'],
    favorito: true,
    contenido: `EN LO PRINCIPAL: Contesta demanda laboral. OTROSÍ: Acompaña documentos.

SEÑOR JUEZ DEL JUZGADO DEL TRABAJO DE ÑUÑOA:

EMPRESAS FABRICANTES S.A., en autos "Lagos Vidal Patricia c/Empresas Fabricantes S.A.", RIT O-234-2025, a Ud. dice:

I. HECHOS

La demandante prestó servicios desde el 15 de enero de 2020 como ejecutiva comercial. Su contrato fue terminado el 31 de marzo de 2025 conforme al artículo 161 del Código del Trabajo. Mi representada pagó íntegramente las indemnizaciones correspondientes por años de servicio y aviso previo.

II. FUNDAMENTOS JURÍDICOS

El artículo 161 del Código del Trabajo autoriza al empleador a poner término al contrato por necesidades de la empresa. La reestructuración del área comercial constituyó una causa legítima, acreditada con los documentos que se acompañan.

III. PETICIÓN

Solicita rechazar la demanda en todas sus partes, con expresa condenación en costas.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-15', autor: 'AB', nota: 'Versión inicial redactada', contenido: '(Versión inicial — borrador)' },
      { id: 'v2', numero: 2, fecha: '2026-05-18', autor: 'MT', nota: 'Revisión fundamentos jurídicos y petición', contenido: '(Revisión jurídica)' },
      { id: 'v3', numero: 3, fecha: '2026-05-20', autor: 'AB', nota: 'Versión final lista para presentar', contenido: '(Versión final)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'MT', fecha: '2026-05-16', hora: '10:30', texto: 'Incluir jurisprudencia CS rol 45.123-2023 sobre necesidades de la empresa. El argumento principal es sólido.' },
      { id: 'c2', autor: 'CL', fecha: '2026-05-18', hora: '14:15', texto: 'Revisado y conforme. Argumento sobre indemnización correcto. Listo para presentar.' },
    ],
    relaciones: { reunion_ids: ['ru02'], tarea_ids: ['ta10'], audiencia_ids: ['au06'] },
  },
  {
    id: 'doc02',
    nombre: 'Recurso de apelación — juicio laboral Morales',
    tipo: 'Recurso',
    fecha_creacion: '2026-05-20',
    fecha_modificacion: '2026-05-22',
    estado: 'borrador',
    causa_rit: 'O-456-2025', causa_ruc: '2200987654-3',
    cliente: 'Héctor Morales Jiménez',
    tribunal: 'Corte de Apelaciones de Santiago',
    responsable: 'CL',
    etiquetas: ['laboral', 'apelación', 'urgente'],
    favorito: false,
    contenido: `RECURSO DE APELACIÓN

SEÑORA PRESIDENTA DE LA CORTE DE APELACIONES DE SANTIAGO:

CATALINA LEIVA, abogada, en representación de HÉCTOR MORALES JIMÉNEZ, en causa RIT O-456-2025, interpone recurso de apelación en contra de la sentencia definitiva de primera instancia de fecha 20 de mayo de 2026.

I. INFRACCIÓN DE LEY

La sentencia recurrida infringe el artículo 177 del Código del Trabajo al calcular incorrectamente el promedio de remuneraciones para la base de indemnización. El tribunal de primera instancia excluyó erróneamente la comisión de ventas del promedio de los últimos tres meses.

II. INFLUENCIA EN LO DISPOSITIVO

La incorrecta determinación de la base de cálculo redujo la indemnización en aproximadamente $1.800.000, perjudicando a mi representado.

PETICIÓN: Que la Corte revoque la sentencia apelada y fije la indemnización conforme al promedio correcto de remuneraciones.

[PENDIENTE: agregar jurisprudencia de Corte Suprema y cálculo correcto]`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-20', autor: 'CL', nota: 'Borrador inicial — estructura base', contenido: '(Borrador inicial)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'MT', fecha: '2026-05-21', hora: '09:15', texto: 'Revisar plazo: vence el 25/05. Prioridad alta. Agregar el cálculo del promedio correcto con todas las liquidaciones.' },
    ],
    relaciones: { reunion_ids: ['ru02'], tarea_ids: [], audiencia_ids: [] },
  },
  {
    id: 'doc03',
    nombre: 'Demanda de alimentos — Ana Paula Reyes',
    tipo: 'Demanda',
    fecha_creacion: '2026-05-21',
    fecha_modificacion: '2026-05-21',
    estado: 'presentado',
    causa_rit: 'F-1234-2025', causa_ruc: '2300123456-7',
    cliente: 'Ana Paula Reyes Soto',
    tribunal: 'Segundo Juzgado de Familia de Santiago',
    responsable: 'AB',
    etiquetas: ['familia', 'alimentos', 'presentado'],
    favorito: false,
    contenido: `EN LO PRINCIPAL: Deduce demanda de alimentos. OTROSÍ: Solicita alimentos provisorios de $200.000.

SEÑOR JUEZ DE FAMILIA:

ANA PAULA REYES SOTO, en representación de su hijo menor MARTÍN REYES VIDAL (7 años), representada por la abogada Angélica Bianchi Lagos, en causa RIT F-1234-2025, ante Ud. dice:

I. LEGITIMACIÓN ACTIVA

Soy la madre y representante legal del menor Martín Reyes Vidal, hijo del demandado don Roberto Reyes Mardones.

II. NECESIDADES DEL ALIMENTARIO

El menor requiere $450.000 mensuales para alimentación, vestuario, salud, educación y esparcimiento, conforme a la prueba documental acompañada.

III. CAPACIDADES DEL DEMANDADO

El demandado percibe remuneración mensual de $1.850.000 según liquidaciones de sueldo adjuntas, pudiendo cumplir sin dificultad la pensión solicitada.

PETICIÓN: Fijar pensión de alimentos de $450.000 mensuales. OTROSÍ: Fijar alimentos provisorios de $200.000 mensuales.

Presentado el 21 de mayo de 2026 en Juzgado de Familia de Santiago. N° ingreso: F-20261567-A.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-10', autor: 'AB', nota: 'Redacción inicial', contenido: '(v1)' },
      { id: 'v2', numero: 2, fecha: '2026-05-21', autor: 'AB', nota: 'Versión presentada al tribunal', contenido: '(v2 presentada)' },
    ],
    comentarios: [],
    relaciones: { reunion_ids: [], tarea_ids: [], audiencia_ids: ['au01','au07'] },
  },
  {
    id: 'doc04',
    nombre: 'Solicitud medida cautelar de alejamiento VIF',
    tipo: 'Escrito judicial',
    fecha_creacion: '2026-05-16',
    fecha_modificacion: '2026-05-16',
    estado: 'presentado',
    causa_rit: 'F-9012-2025', causa_ruc: '2100234567-9',
    cliente: 'Camila Espinoza Torres',
    tribunal: 'Juzgado de Familia de Las Condes',
    responsable: 'AB',
    etiquetas: ['familia', 'VIF', 'cautelar'],
    favorito: false,
    contenido: `EN LO PRINCIPAL: Solicita medida cautelar de alejamiento. OTROSÍ: Acompaña pruebas.

SEÑOR JUEZ DE FAMILIA DE LAS CONDES:

En causa RIT F-9012-2025, la suscrita abogada en representación de CAMILA ESPINOZA TORRES, a Ud. dice:

I. ANTECEDENTES

Mi representada ha sido víctima de violencia intrafamiliar reiterada por parte de su cónyuge, cuya última manifestación ocurrió el 15 de mayo de 2026, con lesiones leves documentadas y denuncia policial adjunta.

II. MEDIDA SOLICITADA

Conforme al artículo 92 de la Ley N° 19.968, se solicita: medida cautelar de alejamiento de 200 metros de distancia del domicilio de la víctima, por un plazo de 6 meses.

PETICIÓN: Decretar medida de alejamiento de 200 metros por 6 meses. OTROSÍ: Se acompañan fotografías (8) y constancia policial N° 2356-2026.

Resultado: ACOGIDA. Medida decretada el 18/05/2026 por 6 meses.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-16', autor: 'AB', nota: 'Redacción y presentación', contenido: '(v1 presentada)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'AB', fecha: '2026-05-18', hora: '11:00', texto: 'ACOGIDA. Medida de alejamiento 200m por 6 meses desde el 18/05/2026. Cliente notificada y conforme.' },
    ],
    relaciones: { reunion_ids: [], tarea_ids: [], audiencia_ids: ['au09'] },
  },
  {
    id: 'doc05',
    nombre: 'Escrito de arraigo y medidas alternativas',
    tipo: 'Escrito judicial',
    fecha_creacion: '2026-05-22',
    fecha_modificacion: '2026-05-22',
    estado: 'borrador',
    causa_rit: 'P-321-2025', causa_ruc: '2400321654-8',
    cliente: 'Rodrigo Carmona Muñoz',
    tribunal: 'Juzgado de Garantía de Santiago',
    responsable: 'MT',
    etiquetas: ['penal', 'cautelar', 'urgente'],
    favorito: true,
    contenido: `EN LO PRINCIPAL: Solicita medidas cautelares alternativas. OTROSÍ: Acredita arraigo familiar y laboral.

SEÑOR JUEZ DE GARANTÍA DE SANTIAGO:

MACARENA TAVERNE, abogada defensora de RODRIGO CARMONA MUÑOZ, en causa RIT P-321-2025, a Ud. dice:

I. ANTECEDENTES DEL IMPUTADO

Mi representado, de 34 años, no registra antecedentes penales previos, tiene arraigo familiar estable (esposa e hijo de 3 años) y laboral (contrato de trabajo vigente que se acompaña), todo lo cual acredita su compromiso con el proceso.

II. MEDIDAS ALTERNATIVAS SOLICITADAS

Conforme al artículo 155 del CPP, solicito: a) Firma mensual ante el tribunal; b) Prohibición de salida del país; c) Arresto domiciliario nocturno.

III. IMPROCEDENCIA DE PRISIÓN PREVENTIVA

La prisión preventiva es desproporcionada atendida la pena probable para el delito imputado y el arraigo acreditado. El imputado no representa un peligro para la investigación ni para la víctima.

PETICIÓN: Sustituir medida cautelar de prisión preventiva por las alternativas señaladas.

[PENDIENTE: adjuntar certificados PDI y declaraciones familiares]`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-22', autor: 'MT', nota: 'Borrador urgente — audiencia 28/05', contenido: '(v1 borrador)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'MT', fecha: '2026-05-22', hora: '08:30', texto: 'URGENTE: Audiencia formalización 28/05. Necesito certificado antecedentes PDI y declaración de la esposa antes del 27/05.' },
    ],
    relaciones: { reunion_ids: ['ru02'], tarea_ids: ['ta01'], audiencia_ids: [] },
  },
  {
    id: 'doc06',
    nombre: 'Contrato de honorarios — Patricia Lagos Vidal',
    tipo: 'Contrato',
    fecha_creacion: '2026-03-10',
    fecha_modificacion: '2026-03-10',
    estado: 'finalizado',
    causa_rit: 'O-234-2025', causa_ruc: '2300456789-1',
    cliente: 'Patricia Lagos Vidal',
    tribunal: null,
    responsable: 'CL',
    etiquetas: ['honorarios', 'contrato'],
    favorito: false,
    contenido: `CONTRATO DE PRESTACIÓN DE SERVICIOS JURÍDICOS

En Santiago, a 10 de marzo de 2026, entre:

CLIENTE: Patricia Lagos Vidal, RUT 14.444.555-5, en adelante "la cliente".
ABOGADA: Catalina Leiva, abogada, Colegio de Abogados A.G.

OBJETO: Representación judicial y extrajudicial en causa por despido injustificado contra Empresas Fabricantes S.A., RIT O-234-2025, ante el Juzgado del Trabajo de Ñuñoa.

HONORARIOS: $1.200.000 totales, pagaderos en 3 cuotas: $400.000 al inicio, $400.000 al término de la audiencia preparatoria, y $400.000 al término del juicio oral.

GASTOS PROCESALES: De cargo exclusivo de la cliente. Se informará previamente de cualquier gasto.

DURACIÓN: Hasta la terminación del juicio, incluyendo instancia de apelación si correspondiere.

CONFIDENCIALIDAD: Ambas partes se obligan a guardar estricta reserva sobre los antecedentes del caso.

Firmado en dos ejemplares del mismo tenor y valor.

_________________________              _________________________
Patricia Lagos Vidal                    Catalina Leiva
    RUT 14.444.555-5                        Abogada`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-03-10', autor: 'CL', nota: 'Contrato firmado', contenido: '(v1 final)' },
    ],
    comentarios: [],
    relaciones: { reunion_ids: [], tarea_ids: [], audiencia_ids: [] },
  },
  {
    id: 'doc07',
    nombre: 'Minuta acuerdo parcial mediación familiar',
    tipo: 'Minuta',
    fecha_creacion: '2026-05-19',
    fecha_modificacion: '2026-05-21',
    estado: 'revision',
    causa_rit: 'F-5678-2024', causa_ruc: '2000789012-5',
    cliente: 'María José Contreras Rojas',
    tribunal: 'Centro de Mediación Familiar de Santiago',
    responsable: 'CL',
    etiquetas: ['familia', 'mediación', 'acuerdo'],
    favorito: false,
    contenido: `MINUTA DE ACUERDO PARCIAL — SEGUNDA SESIÓN DE MEDIACIÓN

Causa: F-5678-2024
Fecha: 24 de mayo de 2026
Mediadora: Sra. Carmen Fuentes
Partes: María José Contreras Rojas y Rodrigo Venegas Pinto

ACUERDOS ALCANZADOS

1. CUIDADO PERSONAL
Las partes acuerdan que el cuidado personal de los menores Diego (8 años) y Valentina (5 años) será ejercido por la madre, doña María José Contreras Rojas.

2. RÉGIMEN DE VISITAS
El padre tendrá régimen de relación directa y regular: fines de semana alternos (viernes 18:00 a domingo 20:00) y mitad de vacaciones de verano e invierno.

PUNTOS PENDIENTES DE ACUERDO

1. RÉGIMEN DE ALIMENTOS: Las partes no han llegado a acuerdo sobre el monto. La madre solicita $320.000; el padre ofrece $180.000. Pendiente para tercera sesión.

2. BIENES COMUNES: Acuerdo sobre departamento común pendiente de tasación.

PRÓXIMA SESIÓN: Por confirmar.

NOTA: Este documento es una minuta de trabajo para revisión por las partes antes de formalizarse el acuerdo.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-19', autor: 'CL', nota: 'Borrador post primera sesión', contenido: '(v1)' },
      { id: 'v2', numero: 2, fecha: '2026-05-21', autor: 'CL', nota: 'Actualizada con acuerdos segunda sesión', contenido: '(v2)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'MT', fecha: '2026-05-21', hora: '16:00', texto: 'Revisar la cláusula de vacaciones — cliente solicita también incluir Fiestas Patrias como período compartido.' },
    ],
    relaciones: { reunion_ids: [], tarea_ids: ['ta07'], audiencia_ids: ['au05'] },
  },
  {
    id: 'doc08',
    nombre: 'Querella por amenazas reiteradas',
    tipo: 'Querella',
    fecha_creacion: '2026-03-14',
    fecha_modificacion: '2026-03-14',
    estado: 'presentado',
    causa_rit: 'P-876-2025', causa_ruc: '2500876543-2',
    cliente: 'Sebastián Fuentes Herrera',
    tribunal: 'Juzgado de Garantía de Maipú',
    responsable: 'AB',
    etiquetas: ['penal', 'querella', 'amenazas'],
    favorito: false,
    contenido: `QUERELLA CRIMINAL POR AMENAZAS REITERADAS Y LESIONES LEVES

SEÑOR JUEZ DE GARANTÍA DE MAIPÚ:

ANGÉLICA BIANCHI LAGOS, abogada, en representación de SEBASTIÁN FUENTES HERRERA, ante Ud. interpone querella criminal en contra de JORGE IBÁÑEZ REYES, por los delitos de amenazas reiteradas (Art. 296 N°3 CP) y lesiones leves (Art. 399 CP).

I. HECHOS

Que el imputado, ex conviviente de la víctima, ha proferido amenazas verbales graves de muerte en múltiples ocasiones durante los meses de enero a marzo de 2026. Con fecha 10 de marzo de 2026 agredió físicamente a la víctima causándole lesiones leves certificadas por el SML, informe N° 2026-4521.

II. CALIFICACIÓN JURÍDICA

Los hechos son constitutivos de: a) Amenazas reiteradas del artículo 296 N°3 del CP; b) Lesiones leves del artículo 399 del CP.

III. DILIGENCIAS INVESTIGATIVAS SOLICITADAS

Declaración del imputado, testigos presenciales (3 individualizados), incautación de teléfono celular para pericia de mensajes de WhatsApp.

PETICIÓN: Que se admita la presente querella y se practiquen las diligencias indicadas.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-03-14', autor: 'AB', nota: 'Versión presentada', contenido: '(v1 presentada)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'AB', fecha: '2026-03-15', hora: '09:00', texto: 'Querella admitida. RUC asignado: 2500876543-2. Fiscalía Sur de Santiago, Fiscal Carmen Díaz Varela.' },
    ],
    relaciones: { reunion_ids: ['ru03'], tarea_ids: [], audiencia_ids: [] },
  },
  {
    id: 'doc09',
    nombre: 'Solicitud copia carpeta investigativa SIAU',
    tipo: 'Escrito judicial',
    fecha_creacion: '2026-04-10',
    fecha_modificacion: '2026-04-10',
    estado: 'presentado',
    causa_rit: 'P-321-2025', causa_ruc: '2400321654-8',
    cliente: 'Rodrigo Carmona Muñoz',
    tribunal: 'Fiscalía Centro Norte de Santiago',
    responsable: 'MT',
    etiquetas: ['penal', 'SIAU', 'carpeta investigativa'],
    favorito: false,
    contenido: `SOLICITUD SIAU N° SIAU-2026-1021

Fiscalía Centro Norte de Santiago
Atención: Sr. Francisco Morales Reyes, Fiscal
Fecha: 10 de abril de 2026

De: Macarena Taverne, abogada defensora de Rodrigo Carmona Muñoz
Re: Solicitud de copia de carpeta investigativa — RUC 2400321654-8

Que en mi calidad de defensora del imputado en la presente causa, y en ejercicio de los derechos consagrados en el artículo 182 del Código Procesal Penal, solicito respetuosamente:

Copia íntegra de la carpeta investigativa del RUC 2400321654-8, incluyendo: actas de diligencias, registros de declaraciones, informes periciales y cualquier antecedente recabado durante la investigación.

Lo anterior es necesario para ejercer adecuadamente el derecho a defensa técnica consagrado en el artículo 8° del Código Procesal Penal.

RESULTADO: Solicitud acogida parcialmente el 15/04/2026. Copias retiradas el 16/04/2026. Parte decretada secreta conforme Art. 182 CPP.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-04-10', autor: 'MT', nota: 'Solicitud presentada', contenido: '(v1)' },
    ],
    comentarios: [
      { id: 'c1', autor: 'MT', fecha: '2026-04-16', hora: '15:00', texto: 'Copias retiradas. Parte de la carpeta decretada secreta. Evaluar solicitud de alzamiento del secreto.' },
    ],
    relaciones: { reunion_ids: [], tarea_ids: [], audiencia_ids: [] },
  },
  {
    id: 'doc10',
    nombre: 'Informe de avance causa penal — Carmona',
    tipo: 'Informe',
    fecha_creacion: '2026-05-22',
    fecha_modificacion: '2026-05-22',
    estado: 'borrador',
    causa_rit: 'P-321-2025', causa_ruc: '2400321654-8',
    cliente: 'Rodrigo Carmona Muñoz',
    tribunal: null,
    responsable: 'MT',
    etiquetas: ['penal', 'interno', 'informe'],
    favorito: false,
    contenido: `INFORME DE AVANCE — CAUSA PENAL RODRIGO CARMONA MUÑOZ
RIT P-321-2025 | RUC 2400321654-8
Fecha: 22 de mayo de 2026
Abogada: Macarena Taverne

ESTADO ACTUAL DE LA CAUSA

La causa se encuentra en etapa de investigación formalizada. Audiencia de formalización programada para el 28 de mayo de 2026.

GESTIONES REALIZADAS

1. Solicitud y obtención parcial de copia carpeta investigativa (abr/2026)
2. Solicitud de entrevista con Fiscal Morales Reyes — sin respuesta (2 reiteraciones)
3. Solicitud informe alcoholemia — pendiente de respuesta
4. Preparación escrito de arraigo y medidas cautelares alternativas

ESTADO SIAU

Total solicitudes: 5. Respondidas: 2. Pendientes: 2. Urgentes: 1.

PRÓXIMAS ACCIONES

1. Presentar escrito de arraigo y medidas cautelares antes del 27/05
2. Audiencia formalización 28/05 — estrategia: medidas alternativas
3. Solicitar antecedentes PDI y certificado de nacimiento hijo
4. Reiterar solicitud entrevista fiscal

OBSERVACIONES

El caso presenta complejidades por la falta de respuesta de la Fiscalía. Se recomienda escalar a nivel jerárquico si no hay respuesta antes del 26/05.`,
    versiones: [
      { id: 'v1', numero: 1, fecha: '2026-05-22', autor: 'MT', nota: 'Informe borrador para reunión', contenido: '(v1 borrador)' },
    ],
    comentarios: [],
    relaciones: { reunion_ids: ['ru01'], tarea_ids: ['ta01'], audiencia_ids: [] },
  },
]

// ── GASTOS_INIT ───────────────────────────────────────────────────────────────
export const GASTOS_INIT = [
  // Mayo 2026
  { id:'g01', fecha:'2026-05-22', categoria:'TAG',             notas:'Fiscalía Centro Norte',       monto:3940,  estado:'pendiente' },
  { id:'g02', fecha:'2026-05-22', categoria:'Estacionamiento', notas:'Juzgado de Garantía',          monto:4500,  estado:'pendiente' },
  { id:'g03', fecha:'2026-05-21', categoria:'Uber',            notas:'Audiencia San Miguel',         monto:8900,  estado:'pendiente' },
  { id:'g04', fecha:'2026-05-20', categoria:'Trámite',          notas:'Reunión cliente Lagos',        monto:3800,  estado:'pendiente' },
  { id:'g05', fecha:'2026-05-19', categoria:'Notaría',         notas:'Legalización poderes',        monto:12000, estado:'pendiente' },
  { id:'g06', fecha:'2026-05-15', categoria:'Bencina',         notas:'Audiencia Maipú',             monto:18500, estado:'pendiente' },
  { id:'g07', fecha:'2026-05-14', categoria:'Fotocopias',      notas:'Carpeta investigativa Carmona',monto:2400,  estado:'pendiente' },
  { id:'g08', fecha:'2026-05-12', categoria:'Peaje',           notas:'Autopista Sur ida y vuelta',  monto:1800,  estado:'pendiente' },
  { id:'g09', fecha:'2026-05-08', categoria:'Audiencia',       notas:'Materiales audiencia Familia',monto:5500,  estado:'pendiente' },
  { id:'g10', fecha:'2026-05-05', categoria:'TAG',             notas:'Juzgado de Familia',          monto:3940,  estado:'cobrado'   },
  // Abril 2026
  { id:'g11', fecha:'2026-04-28', categoria:'Uber',            notas:'Fiscalía Sur',                monto:9200,  estado:'pagado'    },
  { id:'g12', fecha:'2026-04-25', categoria:'TAG',             notas:'Audiencia ordinaria laboral',  monto:3940,  estado:'pagado'    },
  { id:'g13', fecha:'2026-04-22', categoria:'Bencina',         notas:'Viaje San Bernardo',          monto:22000, estado:'pagado'    },
  { id:'g14', fecha:'2026-04-20', categoria:'Notaría',         notas:'Protocolización contrato',    monto:15000, estado:'pagado'    },
  { id:'g15', fecha:'2026-04-18', categoria:'Trámite',          notas:'Reunión cliente Contreras',   monto:4200,  estado:'pagado'    },
  { id:'g16', fecha:'2026-04-15', categoria:'Estacionamiento', notas:'Corte de Apelaciones',        monto:3500,  estado:'cobrado'   },
  { id:'g17', fecha:'2026-04-10', categoria:'Fotocopias',      notas:'Expediente laboral Morales',  monto:3100,  estado:'cobrado'   },
  { id:'g18', fecha:'2026-04-08', categoria:'Otros',           notas:'Material de oficina',         monto:6800,  estado:'cobrado'   },
]

// ── Workspace revisarJueves localStorage key ───────────────────────────────────
const WS_KEY = 'bl_workspace_v1'
function wsAddRevisarJueves(texto) {
  try {
    const raw = localStorage.getItem(WS_KEY)
    const ws  = raw ? JSON.parse(raw) : {}
    const item = { id: Math.random().toString(36).slice(2, 9), text: texto, done: false }
    ws.revisarJueves = [...(ws.revisarJueves || []), item]
    localStorage.setItem(WS_KEY, JSON.stringify(ws))
  } catch {}
}

// ── Context ────────────────────────────────────────────────────────────────────
const SistemaContext = createContext(null)

export function SistemaProvider({ children }) {
  const [tareas,            setTareas]            = useState(TAREAS_INIT)
  const [audiencias,        setAudiencias]        = useState(AUDIENCIAS_INIT)
  const [plazos,            setPlazos]            = useState(PLAZOS_INIT)
  const [pjudCausas,        setPjudCausas]        = useState(PJUD_INIT)
  const [siauCausas,        setSiauCausas]        = useState(SIAU_INIT)
  const [revisionesSemana,  setRevisionesSemana]  = useState(REVISIONES_INIT)
  const [reuniones,         setReuniones]         = useState(REUNIONES_INIT)
  const [documentos,        setDocumentos]        = useState(DOCUMENTOS_INIT)
  const [gastos,            setGastos]            = useState(GASTOS_INIT)

  const updateTarea = useCallback((id, cambios) =>
    setTareas(prev => prev.map(t => t.id === id ? { ...t, ...cambios } : t)), [])

  const updateAudiencia = useCallback((id, cambios) =>
    setAudiencias(prev => prev.map(a => a.id === id ? { ...a, ...cambios } : a)), [])

  const updatePlazo = useCallback((id, cambios) =>
    setPlazos(prev => prev.map(p => p.id === id ? { ...p, ...cambios } : p)), [])

  const addTarea = useCallback((newTarea) =>
    setTareas(prev => [newTarea, ...prev]), [])

  const addPlazo = useCallback((newPlazo) =>
    setPlazos(prev => [newPlazo, ...prev]), [])

  const updatePjudMovimiento = useCallback((causaId, movId, cambios) =>
    setPjudCausas(prev => prev.map(c =>
      c.id === causaId
        ? { ...c, movimientos: c.movimientos.map(m => m.id === movId ? { ...m, ...cambios } : m) }
        : c
    )), [])

  const addPjudMovimiento = useCallback((causaId, newMov) =>
    setPjudCausas(prev => prev.map(c =>
      c.id === causaId
        ? { ...c, movimientos: [newMov, ...c.movimientos] }
        : c
    )), [])

  const updateSiauSolicitud = useCallback((causaId, solId, cambios) =>
    setSiauCausas(prev => prev.map(c =>
      c.id === causaId
        ? { ...c, solicitudes: c.solicitudes.map(s => s.id === solId ? { ...s, ...cambios } : s) }
        : c
    )), [])

  const addSiauSolicitud = useCallback((causaId, newSol) =>
    setSiauCausas(prev => prev.map(c =>
      c.id === causaId
        ? { ...c, solicitudes: [newSol, ...c.solicitudes] }
        : c
    )), [])

  const addSiauTimeline = useCallback((causaId, solId, entry) =>
    setSiauCausas(prev => prev.map(c =>
      c.id === causaId
        ? { ...c, solicitudes: c.solicitudes.map(s =>
            s.id === solId ? { ...s, timeline: [...(s.timeline || []), entry] } : s
          )}
        : c
    )), [])

  const marcarRevision = useCallback((semanaKey, causaId, datos) =>
    setRevisionesSemana(prev => ({
      ...prev,
      [semanaKey]: {
        ...(prev[semanaKey] || {}),
        [causaId]: { ...datos, revisada: true },
      },
    })), [])

  const desmarcarRevision = useCallback((semanaKey, causaId) =>
    setRevisionesSemana(prev => ({
      ...prev,
      [semanaKey]: {
        ...(prev[semanaKey] || {}),
        [causaId]: { revisada: false },
      },
    })), [])

  // ── Reuniones callbacks ────────────────────────────────────────────────────
  const addReunion = useCallback((nueva) =>
    setReuniones(prev => [nueva, ...prev]), [])

  const updateReunion = useCallback((id, cambios) =>
    setReuniones(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r)), [])

  const addTemaReunion = useCallback((reunionId, tema) =>
    setReuniones(prev => prev.map(r =>
      r.id === reunionId ? { ...r, bandeja: [...r.bandeja, tema] } : r
    )), [])

  const toggleTemaDiscutido = useCallback((reunionId, temaId) =>
    setReuniones(prev => prev.map(r =>
      r.id === reunionId
        ? { ...r, bandeja: r.bandeja.map(t => t.id === temaId ? { ...t, discutido: !t.discutido } : t) }
        : r
    )), [])

  const addCausaDiscutida = useCallback((reunionId, causa) =>
    setReuniones(prev => prev.map(r =>
      r.id === reunionId ? { ...r, causas_discutidas: [...r.causas_discutidas, causa] } : r
    )), [])

  const addDecisionReunion = useCallback((reunionId, decision) =>
    setReuniones(prev => prev.map(r =>
      r.id === reunionId ? { ...r, decisiones: [...r.decisiones, decision] } : r
    )), [])

  const toggleDecisionCompletada = useCallback((reunionId, decisionId) =>
    setReuniones(prev => prev.map(r =>
      r.id === reunionId
        ? { ...r, decisiones: r.decisiones.map(d => d.id === decisionId ? { ...d, completada: !d.completada } : d) }
        : r
    )), [])

  // ── Documentos callbacks ──────────────────────────────────────────────────
  const addDocumento = useCallback((nuevo) =>
    setDocumentos(prev => [nuevo, ...prev]), [])

  const updateDocumento = useCallback((id, cambios) =>
    setDocumentos(prev => prev.map(d => d.id === id ? { ...d, ...cambios, fecha_modificacion: new Date().toISOString().slice(0, 10) } : d)), [])

  const addVersionDocumento = useCallback((docId, version) =>
    setDocumentos(prev => prev.map(d =>
      d.id === docId ? { ...d, versiones: [...d.versiones, version], fecha_modificacion: new Date().toISOString().slice(0, 10) } : d
    )), [])

  const addComentarioDocumento = useCallback((docId, comentario) =>
    setDocumentos(prev => prev.map(d =>
      d.id === docId ? { ...d, comentarios: [...d.comentarios, comentario] } : d
    )), [])

  const toggleFavoritoDocumento = useCallback((docId) =>
    setDocumentos(prev => prev.map(d =>
      d.id === docId ? { ...d, favorito: !d.favorito } : d
    )), [])

  // ── Gastos callbacks ──────────────────────────────────────────────────────
  const addGasto = useCallback((nuevo) =>
    setGastos(prev => [nuevo, ...prev]), [])

  const updateGasto = useCallback((id, cambios) =>
    setGastos(prev => prev.map(g => g.id === id ? { ...g, ...cambios } : g)), [])

  const deleteGasto = useCallback((id) =>
    setGastos(prev => prev.filter(g => g.id !== id)), [])

  // ── Integración global ────────────────────────────────────────────────────
  // Agregar ítem al bloque "Revisar el jueves" en la Agenda Diaria (localStorage)
  const addToRevisarJueves = useCallback((texto) => {
    wsAddRevisarJueves(texto)
  }, [])

  return (
    <SistemaContext.Provider value={{
      tareas,     setTareas,     updateTarea,     addTarea,
      audiencias, setAudiencias, updateAudiencia,
      plazos,     setPlazos,     updatePlazo,     addPlazo,
      pjudCausas, setPjudCausas, updatePjudMovimiento, addPjudMovimiento,
      siauCausas, setSiauCausas, updateSiauSolicitud, addSiauSolicitud, addSiauTimeline,
      revisionesSemana, marcarRevision, desmarcarRevision,
      reuniones, addReunion, updateReunion, addTemaReunion, toggleTemaDiscutido,
      addCausaDiscutida, addDecisionReunion, toggleDecisionCompletada,
      documentos, addDocumento, updateDocumento, addVersionDocumento,
      addComentarioDocumento, toggleFavoritoDocumento,
      gastos, addGasto, updateGasto, deleteGasto,
      addToRevisarJueves,
    }}>
      {children}
    </SistemaContext.Provider>
  )
}

export const useSistema = () => {
  const ctx = useContext(SistemaContext)
  if (!ctx) throw new Error('useSistema debe usarse dentro de SistemaProvider')
  return ctx
}
