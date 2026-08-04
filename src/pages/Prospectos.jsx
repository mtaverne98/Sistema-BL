import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrientation } from '../hooks/useOrientation'
import {
  Search, Plus, X, Phone, Mail,
  Clock, Pencil, UserPlus, TrendingUp,
  CheckSquare, MessageSquare, FileText,
  ArrowUpRight, Users, CheckCircle,
  User, Calendar, Scale, ChevronDown, Trash2,
} from 'lucide-react'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

// ── Opciones ──────────────────────────────────────────────────────────────
const ESTADO_OPTIONS = ['Activo', 'Inactivo']
const ACCION_OPTIONS = [
  'Llamar', 'Agendar reunión', 'Enviar presupuesto',
  'Enviar contrato', 'Seguimiento', 'Esperando respuesta', 'Sin acción',
]
const ORIGEN_OPTIONS  = ['Referido', 'Google Ads', 'MT', 'AB', 'CL', 'Otro']
const MATERIA_OPTIONS = ['Penal', 'Civil', 'Laboral', 'Familia', 'Policía Local', 'Administrativo', 'Otro']

// ── Estilos ───────────────────────────────────────────────────────────────
const ESTADO_STYLES = {
  'Activo':   { badge: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400' },
  'Inactivo': { badge: 'bg-gray-100 text-gray-400',      dot: 'bg-gray-300'   },
}
const ESTADO_STYLE_DEFAULT = { badge: 'bg-blue-50 text-blue-600', dot: 'bg-blue-400' }
const ACCION_STYLES = {
  'Llamar':              { dot: 'bg-red-400',    label: 'text-red-600'    },
  'Agendar reunión':     { dot: 'bg-purple-400', label: 'text-purple-600' },
  'Enviar presupuesto':  { dot: 'bg-indigo-400', label: 'text-indigo-600' },
  'Enviar contrato':     { dot: 'bg-emerald-400',label: 'text-emerald-600'},
  'Seguimiento':         { dot: 'bg-blue-400',   label: 'text-blue-600'   },
  'Esperando respuesta': { dot: 'bg-slate-300',  label: 'text-slate-500'  },
  'Sin acción':          { dot: 'bg-gray-200',   label: 'text-gray-400'   },
}
const MATERIA_STYLES = {
  'Laboral':       'bg-violet-50 text-violet-600',
  'Civil':         'bg-sky-50 text-sky-600',
  'Familia':       'bg-rose-50 text-rose-500',
  'Penal':         'bg-red-50 text-red-600',
  'Policía Local': 'bg-orange-50 text-orange-500',
  'Administrativo':'bg-teal-50 text-teal-600',
  'Otro':          'bg-gray-100 text-gray-500',
}
const ORIGEN_COLOR = { MT: '#2570ba', AB: '#059669', CL: '#7c3aed' }
const INTERACCION_STYLES = {
  'Llamada':    { bg: 'bg-blue-50',    text: 'text-blue-500',    Icon: Phone         },
  'Email':      { bg: 'bg-purple-50',  text: 'text-purple-500',  Icon: Mail          },
  'Reunión':    { bg: 'bg-emerald-50', text: 'text-emerald-500', Icon: Users         },
  'WhatsApp':   { bg: 'bg-green-50',   text: 'text-green-600',   Icon: MessageSquare },
  'Seguimiento':{ bg: 'bg-amber-50',   text: 'text-amber-500',   Icon: Clock         },
}

const INACTIVOS = ['Inactivo']

// ── DB helpers ────────────────────────────────────────────────────────────
// Base columns always present; extended columns added via supabase_schema_additions.sql
const PROSPECTOS_BASE_FIELDS    = new Set(['nombre','telefono','email','fecha_contacto','origen','materia','estado','proxima_accion','notas','convertido'])
const PROSPECTOS_EXTENDED_FIELDS = new Set(['presupuesto_enviado','descripcion','antecedentes','interacciones'])
const PROSPECTOS_DB_FIELDS = new Set([...PROSPECTOS_BASE_FIELDS, ...PROSPECTOS_EXTENDED_FIELDS])

function mapProspectoRow(row) {
  return {
    id:                  row.id,
    nombre:              row.nombre              || '',
    telefono:            row.telefono            || '',
    email:               row.email               || '',
    fecha_contacto:      row.fecha_contacto      || '',
    origen:              row.origen              || '',
    materia:             row.materia             || '',
    estado:              row.estado              || 'Activo',
    convertido:          !!row.convertido,
    proxima_accion:      row.proxima_accion      || 'Llamar',
    presupuesto_enviado: !!row.presupuesto_enviado,
    descripcion:         row.descripcion         || '',
    antecedentes:        row.antecedentes        || '',
    interacciones:       Array.isArray(row.interacciones) ? row.interacciones : [],
    notas:               row.notas               || '',
    created_at:          row.created_at          || '',
  }
}

// ── (Static seed removed — data now loaded from Supabase) ─────────────────
const _PROSPECTOS_SEED = [
  {
    id: 'pr01', nombre: 'María José Contreras Rojas',
    telefono: '+56 9 8234 5678', email: 'mj.contreras@gmail.com',
    fecha_contacto: '13 may 2025', origen: 'Referido', materia: 'Familia',
    estado: 'Reunión agendada', proxima_accion: 'Agendar reunión',
    presupuesto_enviado: false,
    descripcion: 'Consulta por proceso de divorcio de mutuo acuerdo. Matrimonio de 12 años, dos hijos menores. Busca regular cuidado personal, alimentos y régimen de visitas.',
    antecedentes: 'Pareja con acuerdo de separación. Ambos dispuestos a cooperar. Inmueble común a dividir.',
    interacciones: [
      { id: 'i1', fecha: '13 may 2025', hora: '10:30', tipo: 'llamada', descripcion: 'Primer contacto telefónico. Se explica situación. Se agenda reunión presencial.', resultado: 'Reunión confirmada para el 20 may' },
    ],
    notas: 'Referida por Alejandro Bravo. Caso cooperativo, sin litigiosidad. Alta probabilidad de conversión.',
  },
  {
    id: 'pr02', nombre: 'Sebastián Fuentes Herrera',
    telefono: '+56 9 7123 4567', email: 'sfuentes.h@hotmail.com',
    fecha_contacto: '14 may 2025', origen: 'Google Ads', materia: 'Laboral',
    estado: 'Contactado', proxima_accion: 'Llamar',
    presupuesto_enviado: false,
    descripcion: 'Despido sin pago de indemnizaciones. Seis años en empresa de retail. Despido sin previo aviso y sin pago de finiquito.',
    antecedentes: 'Tiene contrato de trabajo y liquidaciones de sueldo. Empresa se niega a pagar. Plazo de prescripción laboral corriendo.',
    interacciones: [
      { id: 'i1', fecha: '14 may 2025', hora: '09:15', tipo: 'email', descripcion: 'Formulario web recibido. Se responde por email confirmando recepción del caso y se solicita llamada.', resultado: 'Pendiente llamada de evaluación' },
    ],
    notas: 'Urgente: plazo de prescripción laboral de 6 meses desde el despido. Llamar antes del 20 may.',
  },
  {
    id: 'pr03', nombre: 'Patricia Lagos Vidal',
    telefono: '+56 9 6543 2109', email: 'plagosvidal@outlook.com',
    fecha_contacto: '10 may 2025', origen: 'MT', materia: 'Penal',
    estado: 'Esperando antecedentes', proxima_accion: 'Esperando respuesta',
    presupuesto_enviado: false,
    descripcion: 'Víctima de estafa en compraventa de vehículo. Vendedor desapareció tras recibir el pago de $4.800.000.',
    antecedentes: 'Tiene comprobantes de transferencia y conversaciones de WhatsApp. Pendiente: contrato de promesa y denuncia en PDI.',
    interacciones: [
      { id: 'i1', fecha: '10 may 2025', hora: '11:00', tipo: 'reunion', descripcion: 'Primera reunión presencial. Se relatan los hechos y se revisa documentación inicial.', resultado: 'Caso viable. Se solicitan antecedentes adicionales' },
      { id: 'i2', fecha: '12 may 2025', hora: '16:00', tipo: 'email', descripcion: 'Se envía correo con lista de documentos requeridos para evaluar el caso a fondo.', resultado: 'Cliente confirmó que los está buscando' },
    ],
    notas: 'Contacto directo de Macarena. Caso penal sólido. En espera de documentación para presupuestar.',
  },
  {
    id: 'pr04', nombre: 'Rodrigo Carmona Muñoz',
    telefono: '+56 9 5678 9012', email: 'rcarmona.m@gmail.com',
    fecha_contacto: '05 may 2025', origen: 'Referido', materia: 'Civil',
    estado: 'Seguimiento', proxima_accion: 'Seguimiento',
    presupuesto_enviado: true,
    descripcion: 'Cobro de deuda por servicios profesionales a empresa constructora. Facturas impagas por $18.500.000.',
    antecedentes: 'Cinco facturas emitidas y recibidas por la empresa. Empresa reconoce la deuda pero alega problemas de flujo de caja.',
    interacciones: [
      { id: 'i1', fecha: '05 may 2025', hora: '15:00', tipo: 'reunion', descripcion: 'Reunión inicial. Revisión de facturas y correspondencia con empresa deudora.', resultado: 'Caso aceptado. Se procede a presupuestar' },
      { id: 'i2', fecha: '08 may 2025', hora: '10:00', tipo: 'email', descripcion: 'Envío de presupuesto detallado para cobro ejecutivo de deuda.', resultado: 'Enviado y recibido' },
      { id: 'i3', fecha: '15 may 2025', hora: '12:00', tipo: 'seguimiento', descripcion: 'Llamada de seguimiento. Cliente pide tiempo adicional para evaluar el presupuesto con su contador.', resultado: 'Retomar en 5 días hábiles' },
    ],
    notas: 'Presupuesto enviado el 8 may. Cliente evaluando. Llamar el 22 may para cerrar.',
  },
  {
    id: 'pr05', nombre: 'Ana Paula Reyes Soto',
    telefono: '+56 9 4321 8765', email: 'apreyes.s@gmail.com',
    fecha_contacto: '16 may 2025', origen: 'AB', materia: 'Familia',
    estado: 'Reunión agendada', proxima_accion: 'Agendar reunión',
    presupuesto_enviado: false,
    descripcion: 'Demanda de aumento de alimentos para hijo de 8 años. Padre con 4 meses de mora en pensión.',
    antecedentes: 'Sentencia anterior fijando $250.000 mensuales. Padre en mora. Busca aumentar monto y ejecutar deuda acumulada.',
    interacciones: [
      { id: 'i1', fecha: '16 may 2025', hora: '14:30', tipo: 'llamada', descripcion: 'Primer contacto. Derivada por Angélica. Situación urgente por 4 meses de mora.', resultado: 'Reunión confirmada para el 21 may a las 11:00' },
    ],
    notas: 'Referida por Angélica. Caso urgente. Reunión el 21 may.',
  },
  {
    id: 'pr06', nombre: 'Héctor Morales Jiménez',
    telefono: '+56 9 3456 7890', email: 'hmorales.j@empresa.cl',
    fecha_contacto: '28 abr 2025', origen: 'Google Ads', materia: 'Laboral',
    estado: 'Cliente aceptado', proxima_accion: 'Sin acción',
    presupuesto_enviado: true,
    descripcion: 'Accidente del trabajo con lesiones en mano derecha. Empresa no reportó a la Mutual de manera oportuna.',
    antecedentes: 'Informe médico, testigos, contrato de trabajo. Incapacidad laboral temporal certificada.',
    interacciones: [
      { id: 'i1', fecha: '28 abr 2025', hora: '09:00', tipo: 'llamada', descripcion: 'Llamada inicial desde Google. Cliente describe accidente laboral.', resultado: 'Se agenda reunión' },
      { id: 'i2', fecha: '02 may 2025', hora: '11:00', tipo: 'reunion', descripcion: 'Primera reunión. Se revisa documentación médica y laboral.', resultado: 'Caso aceptado' },
      { id: 'i3', fecha: '05 may 2025', hora: '15:00', tipo: 'email', descripcion: 'Envío de presupuesto y contrato de honorarios.', resultado: 'Cliente firma y paga anticipo' },
    ],
    notas: 'Contrato firmado el 6 may. Pendiente ingresar como cliente formal.',
  },
  {
    id: 'pr07', nombre: 'Camila Espinoza Torres',
    telefono: '+56 9 2345 6789', email: 'camilaet@gmail.com',
    fecha_contacto: '17 may 2025', origen: 'CL', materia: 'Administrativo',
    estado: 'Nuevo contacto', proxima_accion: 'Agendar reunión',
    presupuesto_enviado: false,
    descripcion: 'Recurso de protección contra municipalidad por negativa de permiso de edificación pese a cumplir todos los requisitos.',
    antecedentes: 'Resolución municipal denegatoria, planos aprobados por arquitecto, antecedentes técnicos completos.',
    interacciones: [
      { id: 'i1', fecha: '17 may 2025', hora: '16:00', tipo: 'email', descripcion: 'Contacto inicial por derivación de Catalina. Envía correo con resumen de la situación.', resultado: 'Pendiente agendar reunión. Plazo constitucional urgente' },
    ],
    notas: 'Derivada por Catalina. Recurso de protección: plazo constitucional de 30 días corriendo.',
  },
  {
    id: 'pr08', nombre: 'Diego Fuentes Castro',
    telefono: '+56 9 1234 5678', email: 'dfuentes.c@yahoo.com',
    fecha_contacto: '01 may 2025', origen: 'Otro', materia: 'Policía Local',
    estado: 'Descartado', proxima_accion: 'Sin acción',
    presupuesto_enviado: false,
    descripcion: 'Consulta por multa de tránsito. Monto no justifica representación profesional.',
    antecedentes: 'Multa de $45.000 en Juzgado de Policía Local.',
    interacciones: [
      { id: 'i1', fecha: '01 may 2025', hora: '10:00', tipo: 'llamada', descripcion: 'Llamada breve. Caso descartado por bajo monto. Se orienta para que se defienda personalmente.', resultado: 'Prospecto descartado' },
    ],
    notas: 'Descartado. Monto de la multa no justifica honorarios profesionales.',
  },
  {
    id: 'pr09', nombre: 'Lorena Navarro Pérez',
    telefono: '+56 9 9876 5432', email: 'lnavarro.p@gmail.com',
    fecha_contacto: '12 may 2025', origen: 'Referido', materia: 'Civil',
    estado: 'En evaluación', proxima_accion: 'Enviar presupuesto',
    presupuesto_enviado: false,
    descripcion: 'Terminación de arrendamiento por no pago. Arrendatario con 4 meses de atraso en renta.',
    antecedentes: 'Contrato de arrendamiento, comprobantes hasta hace 4 meses, comunicaciones de cobro sin resultado.',
    interacciones: [
      { id: 'i1', fecha: '12 may 2025', hora: '12:00', tipo: 'reunion', descripcion: 'Reunión inicial. Revisión del contrato y situación del arrendatario moroso.', resultado: 'Caso evaluado favorablemente' },
      { id: 'i2', fecha: '14 may 2025', hora: '09:30', tipo: 'llamada', descripcion: 'Llamada de seguimiento. Antecedentes confirmados. Preparando presupuesto.', resultado: 'Presupuesto en preparación' },
    ],
    notas: 'Preparando propuesta para juicio de arrendamiento. Enviar antes del 22 may.',
  },
  {
    id: 'pr10', nombre: 'Marco Vidal Álvarez',
    telefono: '+56 9 8765 4321', email: 'mvidal.a@gmail.com',
    fecha_contacto: '08 may 2025', origen: 'MT', materia: 'Penal',
    estado: 'Sin respuesta', proxima_accion: 'Seguimiento',
    presupuesto_enviado: true,
    descripcion: 'Querellante por estafa informática. Víctima de phishing bancario por $9.200.000.',
    antecedentes: 'Cartolas bancarias, movimientos sospechosos, denuncia en PDI. Banco se negó a restituir fondos.',
    interacciones: [
      { id: 'i1', fecha: '08 may 2025', hora: '14:00', tipo: 'reunion', descripcion: 'Primera reunión. Revisión de denuncia en PDI y antecedentes bancarios.', resultado: 'Caso viable. Se presupuesta' },
      { id: 'i2', fecha: '12 may 2025', hora: '11:00', tipo: 'email', descripcion: 'Envío de presupuesto para querella por estafa informática.', resultado: 'Sin respuesta desde entonces' },
      { id: 'i3', fecha: '17 may 2025', hora: '10:00', tipo: 'seguimiento', descripcion: 'Llamada sin respuesta. Se deja mensaje de voz.', resultado: 'Sin respuesta' },
    ],
    notas: 'Sin respuesta hace 9 días. Enviar email de seguimiento esta semana.',
  },
]  // _PROSPECTOS_SEED — kept as reference/fallback, not used at runtime

// ── Dropdown Select Premium ───────────────────────────────────────────────
function DropdownSelect({ value, onChange, options, getStyle, label, variant = 'badge' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left })
    }
    setOpen(p => !p)
  }

  const s = getStyle(value)

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 cursor-pointer transition-all select-none ${
          variant === 'badge'
            ? `text-[11px] font-medium pl-2.5 pr-2 py-1 rounded-full hover:opacity-80 ${s.badge ?? 'bg-gray-100 text-gray-500'}`
            : 'text-xs text-gray-700 hover:text-gray-900 py-0.5'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot ?? 'bg-gray-300'}`} />
        <span className={variant === 'plain' ? s.label : ''}>{value || '—'}</span>
        <ChevronDown size={9} className="flex-shrink-0 opacity-40 ml-0.5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ minWidth: 220, top: coords.top, left: coords.left }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-gray-50">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">{label}</p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map(opt => {
              const os = getStyle(opt)
              const selected = value === opt
              return (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    selected ? 'bg-gray-50' : 'hover:bg-gray-50/80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${os.dot ?? 'bg-gray-300'}`} />
                  <span className={`text-xs flex-1 ${selected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{opt}</span>
                  {selected && <span className="text-[10px] text-gray-300">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLE_DEFAULT
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {estado}
    </span>
  )
}
function MateriaBadge({ materia }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${MATERIA_STYLES[materia] ?? 'bg-gray-100 text-gray-500'}`}>
      {materia}
    </span>
  )
}
function OrigenBadge({ origen }) {
  if (['MT', 'AB', 'CL'].includes(origen)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ backgroundColor: ORIGEN_COLOR[origen] }}
        >{origen}</span>
        <span className="text-xs text-gray-500">{origen}</span>
      </span>
    )
  }
  return <span className="text-xs text-gray-500">{origen}</span>
}
function initials(nombre) {
  return (nombre || '??').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ── Metric Card ───────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'text-gray-900', icon: Icon, iconColor, onClick, active }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl px-5 py-4 flex items-start justify-between transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${active
          ? 'border-[#2570ba] bg-[#E6F1FB]'
          : onClick
            ? 'border-gray-100 hover:border-[#2570ba]/40'
            : 'border-gray-100 hover:border-gray-200'
        }`}
    >
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
        <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
      </div>
      {Icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-[#2570ba]/10' : (iconColor ?? 'bg-gray-50')}`}>
          <Icon size={15} className={active ? 'text-[#2570ba]' : 'text-gray-400'} />
        </div>
      )}
    </div>
  )
}

// ── Panel Detalle ─────────────────────────────────────────────────────────
function PanelDetalle({ prospecto, onClose, onConvertir, onUpdate }) {
  const [tab, setTab] = useState('resumen')
  const [confirmando, setConfirmando] = useState(false)
  // Notas
  const [editandoNota, setEditandoNota] = useState(false)
  const [textNota, setTextNota] = useState(prospecto.notas || '')
  const [guardandoNota, setGuardandoNota] = useState(false)
  // Interacciones
  const [interacciones, setInteracciones] = useState([])
  const [cargandoInter, setCargandoInter] = useState(false)
  const [mostrarFormInter, setMostrarFormInter] = useState(false)
  const todayISO = new Date().toISOString().slice(0, 10)
  const [formInter, setFormInter] = useState({ fecha: todayISO, tipo: 'Llamada', descripcion: '', resultado: '' })
  const [guardandoInter, setGuardandoInter] = useState(false)

  useEffect(() => {
    setTextNota(prospecto.notas || '')
    setEditandoNota(false)
  }, [prospecto.id])

  useEffect(() => {
    if (tab !== 'interacciones') return
    setCargandoInter(true)
    supabase
      .from('prospecto_interacciones')
      .select('*')
      .eq('prospecto_id', prospecto.id)
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setInteracciones(data)
        setCargandoInter(false)
      })
  }, [tab, prospecto.id])

  async function handleGuardarNota() {
    setGuardandoNota(true)
    await onUpdate(prospecto.id, { notas: textNota })
    setGuardandoNota(false)
    setEditandoNota(false)
  }

  async function handleGuardarInter() {
    if (!formInter.descripcion.trim()) return
    setGuardandoInter(true)
    const payload = {
      prospecto_id: prospecto.id,
      fecha: formInter.fecha,
      tipo: formInter.tipo,
      descripcion: formInter.descripcion.trim(),
      resultado: formInter.resultado.trim() || null,
    }
    const { data, error } = await supabase.from('prospecto_interacciones').insert([payload]).select()
    if (!error && data?.length > 0) {
      setInteracciones(prev => [data[0], ...prev])
      setMostrarFormInter(false)
      setFormInter({ fecha: todayISO, tipo: 'Llamada', descripcion: '', resultado: '' })
    }
    setGuardandoInter(false)
  }

  const TABS = [
    { key: 'resumen',       label: 'Resumen',       Icon: User          },
    { key: 'interacciones', label: 'Interacciones', Icon: MessageSquare },
    { key: 'notas',         label: 'Notas',         Icon: FileText      },
  ]

  const inactivo = prospecto.estado === 'Inactivo' || prospecto.convertido

  return (
    <div className="detail-panel w-[460px] flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MateriaBadge materia={prospecto.materia} />
            <EstadoBadge estado={prospecto.estado} />
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"><Pencil size={13} /></button>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"><X size={13} /></button>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 transition-opacity ${inactivo ? 'opacity-50' : ''}`}
            style={{ backgroundColor: '#2570BA' }}
          >
            {initials(prospecto.nombre)}
          </div>
          <div>
            <h2 className={`text-[15px] font-semibold leading-snug transition-colors ${inactivo ? 'text-gray-400' : 'text-gray-900'}`}>
              {prospecto.nombre}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{prospecto.fecha_contacto} · vía {prospecto.origen}</p>
          </div>
        </div>

        {/* Acciones */}
        {!inactivo ? (
          confirmando ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                <p className="text-xs font-semibold text-emerald-800">Confirmar conversión</p>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed mb-3">
                <strong>{prospecto.nombre}</strong> será agregado al módulo Clientes como cliente formal del estudio.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onConvertir(prospecto.id); setConfirmando(false) }}
                  className="flex-1 py-2 text-xs font-semibold text-white rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={12} />Convertir y abrir Clientes
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="px-3 py-2 text-xs text-gray-500 rounded-lg hover:bg-white border border-emerald-100 transition-colors"
                >Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirmando(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <UserPlus size={11} />Convertir a cliente
              </button>
              {prospecto.telefono && (
                <a href={`tel:${prospecto.telefono}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <Phone size={11} />Llamar
                </a>
              )}
              {prospecto.email && (
                <a href={`mailto:${prospecto.email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <Mail size={11} />Email
                </a>
              )}
            </div>
          )
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 text-center py-2 text-[11px] rounded-lg bg-gray-100 text-gray-400">
              {prospecto.convertido ? 'Convertido a cliente' : 'Inactivo'}
            </div>
            <button
              onClick={() => onUpdate(prospecto.id, { estado: 'Activo', convertido: false })}
              className="px-3 py-2 text-[11px] font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Reactivar
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium whitespace-nowrap border-b-2 transition-all ${
              tab === t.key ? 'border-[#1a2e4a] text-[#1a2e4a]' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.Icon size={11} />{t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div className="px-6 py-5 space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Contacto</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Phone size={12} className="text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-700">{prospecto.telefono}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Mail size={12} className="text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-700">{prospecto.email}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-50 pt-4">
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Gestión</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Estado</p>
                  <DropdownSelect
                    value={prospecto.estado}
                    onChange={v => onUpdate(prospecto.id, { estado: v })}
                    options={ESTADO_OPTIONS}
                    getStyle={opt => ESTADO_STYLES[opt] ?? ESTADO_STYLES['Activo']}
                    label="Estado del prospecto"
                    variant="badge"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Materia</p>
                  <MateriaBadge materia={prospecto.materia} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Origen</p>
                  <OrigenBadge origen={prospecto.origen} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Presupuesto</p>
                  <select
                    value={prospecto.presupuesto_enviado ? 'si' : 'no'}
                    onChange={e => onUpdate(prospecto.id, { presupuesto_enviado: e.target.value === 'si' })}
                    className={`text-[11px] font-medium pl-2 pr-4 py-0.5 rounded-full border-0 outline-none cursor-pointer transition-colors ${
                      prospecto.presupuesto_enviado ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-500'
                    }`}
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="si">✓ Enviado</option>
                    <option value="no">— No enviado</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400 mb-1.5">Próxima acción</p>
                  <DropdownSelect
                    value={prospecto.proxima_accion}
                    onChange={v => onUpdate(prospecto.id, { proxima_accion: v })}
                    options={ACCION_OPTIONS}
                    getStyle={opt => ACCION_STYLES[opt] ?? { dot: 'bg-gray-300', label: 'text-gray-600' }}
                    label="Próxima acción"
                    variant="plain"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400 mb-1">Primer contacto</p>
                  <p className="text-xs text-gray-700">{prospecto.fecha_contacto}</p>
                </div>
              </div>
            </div>

            {prospecto.descripcion && (
              <div className="border-t border-gray-50 pt-4">
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">Consulta jurídica</p>
                <p className="text-xs text-gray-700 leading-relaxed">{prospecto.descripcion}</p>
              </div>
            )}
            {prospecto.antecedentes && (
              <div className="border-t border-gray-50 pt-4">
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">Antecedentes relevantes</p>
                <p className="text-xs text-gray-600 leading-relaxed">{prospecto.antecedentes}</p>
              </div>
            )}
          </div>
        )}

        {/* INTERACCIONES */}
        {tab === 'interacciones' && (
          <div>
            <div className="px-6 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">{interacciones.length} interaccion{interacciones.length !== 1 ? 'es' : ''}</p>
              <button
                onClick={() => setMostrarFormInter(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                style={{ backgroundColor: '#2570BA' }}
              >
                <Plus size={11} />Nueva interacción
              </button>
            </div>
            {mostrarFormInter && (
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Nueva interacción</p>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Fecha</label>
                      <input type="date" value={formInter.fecha}
                        onChange={e => setFormInter(p => ({ ...p, fecha: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Tipo</label>
                      <select value={formInter.tipo}
                        onChange={e => setFormInter(p => ({ ...p, tipo: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] bg-white">
                        {['Llamada', 'Reunión', 'Email', 'WhatsApp'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Descripción</label>
                    <textarea value={formInter.descripcion}
                      onChange={e => setFormInter(p => ({ ...p, descripcion: e.target.value }))}
                      placeholder="¿Qué ocurrió en esta interacción?"
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] resize-none placeholder:text-gray-300" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Resultado</label>
                    <input value={formInter.resultado}
                      onChange={e => setFormInter(p => ({ ...p, resultado: e.target.value }))}
                      placeholder="¿Cuál fue el resultado?"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] placeholder:text-gray-300" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleGuardarInter} disabled={guardandoInter || !formInter.descripcion.trim()}
                      className="flex-1 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-40 transition-opacity"
                      style={{ backgroundColor: '#2570BA' }}>
                      {guardandoInter ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={() => setMostrarFormInter(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="px-6 py-5">
              {cargandoInter ? (
                <p className="text-xs text-gray-400 text-center py-8">Cargando…</p>
              ) : interacciones.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <MessageSquare size={26} className="text-gray-200 mb-3" />
                  <p className="text-xs text-gray-400">Sin interacciones registradas</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gray-100" />
                  <div className="space-y-6">
                    {interacciones.map(inter => {
                      const style = INTERACCION_STYLES[inter.tipo] ?? INTERACCION_STYLES['Llamada']
                      return (
                        <div key={inter.id} className="flex gap-4 relative">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 z-10 mt-0.5 ${style.bg}`}>
                            <style.Icon size={13} className={style.text} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                                {inter.tipo}
                              </span>
                              <span className="text-[11px] text-gray-400 flex-shrink-0">{inter.fecha}</span>
                            </div>
                            <p className="text-xs text-gray-700 leading-snug">{inter.descripcion}</p>
                            {inter.resultado && (
                              <p className="text-[11px] text-gray-400 mt-1 italic">→ {inter.resultado}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOTAS */}
        {tab === 'notas' && (
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Notas internas</p>
              {!editandoNota && (
                <button
                  onClick={() => setEditandoNota(true)}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Pencil size={11} />{prospecto.notas ? 'Editar' : '+ Agregar nota'}
                </button>
              )}
            </div>
            {editandoNota ? (
              <div className="space-y-2">
                <textarea
                  value={textNota}
                  onChange={e => setTextNota(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGuardarNota() }}
                  autoFocus
                  rows={8}
                  placeholder="Escribe tus notas internas aquí…"
                  className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 resize-none placeholder:text-gray-300 leading-relaxed"
                />
                <p className="text-[10px] text-gray-300">Cmd+Enter para guardar</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleGuardarNota}
                    disabled={guardandoNota}
                    className="flex-1 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#2570BA' }}
                  >
                    {guardandoNota ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setTextNota(prospecto.notas || ''); setEditandoNota(false) }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : prospecto.notas ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prospecto.notas}</p>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <FileText size={26} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400">Sin notas internas</p>
                <button
                  onClick={() => setEditandoNota(true)}
                  className="mt-3 text-xs text-[#2570ba] hover:underline"
                >+ Agregar nota</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Formulario nuevo prospecto ────────────────────────────────────────────
function FormNuevoProspecto({ onClose, onGuardar }) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    nombre: '', telefono: '', email: '',
    fecha_contacto: todayISO,
    origen: '', materia: '', estado: 'Activo',
    proxima_accion: 'Llamar',
    descripcion: '', antecedentes: '',
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    await onGuardar({ ...form, interacciones: [], notas: '', presupuesto_enviado: false })
    setGuardando(false)
    onClose()
  }

  return (
    <div className="detail-panel w-[460px] flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Nuevo prospecto</h2>
          <p className="text-xs text-gray-400 mt-0.5">Registrar cliente potencial</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"><X size={13} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Datos de contacto</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Nombre completo *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                placeholder="Ej. Juan Pérez Soto"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Teléfono</label>
                <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="+56 9 XXXX XXXX"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Fecha de contacto</label>
                <input value={form.fecha_contacto} onChange={e => set('fecha_contacto', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="email@ejemplo.com"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-50 pt-4">
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Clasificación</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Cómo llegó</label>
              <select value={form.origen} onChange={e => set('origen', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-700 bg-white transition-all">
                <option value="">Seleccionar…</option>
                {ORIGEN_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Materia</label>
              <select value={form.materia} onChange={e => set('materia', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-700 bg-white transition-all">
                <option value="">Seleccionar…</option>
                {MATERIA_OPTIONS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Estado inicial</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-700 bg-white transition-all">
                {ESTADO_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Próxima acción</label>
              <select value={form.proxima_accion} onChange={e => set('proxima_accion', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-700 bg-white transition-all">
                {ACCION_OPTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-50 pt-4">
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Detalle del caso</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Consulta jurídica</label>
              <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                placeholder="Describe brevemente la consulta o situación jurídica del prospecto…"
                rows={4}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300 resize-none leading-relaxed" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Antecedentes relevantes</label>
              <textarea value={form.antecedentes} onChange={e => set('antecedentes', e.target.value)}
                placeholder="Documentos disponibles, hechos relevantes, situación actual…"
                rows={3}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300 resize-none leading-relaxed" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <button onClick={handleSubmit} disabled={!form.nombre.trim() || guardando}
          className="flex-1 py-2 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: '#2570BA' }}>
          {guardando ? 'Guardando…' : 'Guardar prospecto'}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Prospectos() {
  const navigate = useNavigate()
  const isPortrait = useOrientation()
  const [prospectos,    setProspectos]    = useState([])
  const [cargando,      setCargando]      = useState(true)
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [mostrarForm,   setMostrarForm]   = useState(false)
  const [busqueda,      setBusqueda]      = useState('')
  const [filtroOrigen,      setFiltroOrigen]      = useState('')
  const [filtroMateria,     setFiltroMateria]     = useState('')
  const [filtroEstado,      setFiltroEstado]      = useState('Activo')
  const [filtroNuevos,      setFiltroNuevos]      = useState(false)
  const [filtroConvertidos, setFiltroConvertidos] = useState(false)
  const [deleteTarget,      setDeleteTarget]      = useState(null)

  useEffect(() => {
    async function fetchProspectos() {
      const { data, error } = await supabase
        .from('prospectos')
        .select('*')
        .order('fecha_contacto', { ascending: false })
      if (error) { console.error('Error al cargar prospectos:', error.message); setCargando(false); return }
      setProspectos((data || []).map(mapProspectoRow))
      setCargando(false)
    }
    fetchProspectos()
  }, [])

  const handleSelectRow = (p) => {
    setMostrarForm(false)
    setSeleccionado(seleccionado?.id === p.id ? null : p)
  }
  const handleNuevo = () => {
    setSeleccionado(null)
    setMostrarForm(true)
  }

  const handleGuardar = async (nuevo) => {
    const payload = Object.fromEntries(
      Object.entries(nuevo).filter(([k]) => PROSPECTOS_DB_FIELDS.has(k))
    )
    const { data, error } = await supabase.from('prospectos').insert([payload]).select().single()
    if (error) { console.error('Error al guardar prospecto:', error.message); return }
    setProspectos(prev => [mapProspectoRow(data), ...prev])
  }

  const handleConvertir = async (id) => {
    const prospecto = prospectos.find(p => p.id === id)
    if (!prospecto) return

    // Insertar en clientes
    const { error: errCliente } = await supabase.from('clientes').insert([{
      nombre:   prospecto.nombre,
      telefono: prospecto.telefono || null,
      email:    prospecto.email    || null,
      estado:   'Activo',
    }])
    if (errCliente) { console.error('[convertir] error insertando cliente:', errCliente.message); return }

    // Marcar prospecto como inactivo (siempre)
    await supabase.from('prospectos').update({ estado: 'Inactivo' }).eq('id', id)
    // Marcar convertido=true si la columna existe (ignorar error si no existe)
    await supabase.from('prospectos').update({ convertido: true }).eq('id', id)
    setProspectos(p => p.map(x => x.id === id ? { ...x, estado: 'Inactivo', convertido: true } : x))
    setSeleccionado(null)
    navigate('/clientes')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('prospectos').delete().eq('id', deleteTarget.id)
    setProspectos(prev => prev.filter(p => p.id !== deleteTarget.id))
    if (seleccionado?.id === deleteTarget.id) setSeleccionado(null)
    setDeleteTarget(null)
  }

  const handleUpdate = async (id, cambios) => {
    setProspectos(p => p.map(x => x.id === id ? { ...x, ...cambios } : x))
    setSeleccionado(prev => prev?.id === id ? { ...prev, ...cambios } : prev)
    const dbCambios = Object.fromEntries(
      Object.entries(cambios).filter(([k]) => PROSPECTOS_DB_FIELDS.has(k))
    )
    if (Object.keys(dbCambios).length > 0) {
      const { error } = await supabase.from('prospectos').update(dbCambios).eq('id', id)
      if (error) console.error('Error al actualizar prospecto:', error.message)
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    const inicioSemana = new Date()
    const diaSemana = inicioSemana.getDay()
    inicioSemana.setDate(inicioSemana.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    inicioSemana.setHours(0, 0, 0, 0)
    return prospectos.filter(p => {
      const matchQ = !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.materia.toLowerCase().includes(q) ||
        p.telefono.includes(q)
      return matchQ &&
        (!filtroOrigen      || p.origen  === filtroOrigen) &&
        (!filtroMateria     || p.materia === filtroMateria) &&
        (!filtroEstado      || p.estado  === filtroEstado) &&
        (!filtroNuevos      || (p.created_at && new Date(p.created_at) >= inicioSemana)) &&
        (!filtroConvertidos || p.convertido === true)
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [prospectos, busqueda, filtroOrigen, filtroMateria, filtroEstado, filtroNuevos, filtroConvertidos])

  const hayFiltros = filtroOrigen || filtroMateria || filtroEstado || filtroNuevos || filtroConvertidos

  const metricas = useMemo(() => {
    const total      = prospectos.length
    const inactivos  = prospectos.filter(p => p.estado === 'Inactivo').length
    const activos    = total - inactivos
    const convertidos = prospectos.filter(p => p.convertido).length
    const inicioSemana = new Date()
    const diaSemana = inicioSemana.getDay()
    inicioSemana.setDate(inicioSemana.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    inicioSemana.setHours(0, 0, 0, 0)
    const nuevos = prospectos.filter(p => p.created_at && new Date(p.created_at) >= inicioSemana).length
    const tasa = total > 0 ? Math.round((convertidos / total) * 100) : 0
    return { total, activos, inactivos, convertidos, nuevos, tasa }
  }, [prospectos])

  if (cargando) return (
    <div className="flex items-center justify-center h-full text-[13px] text-gray-400">
      Cargando prospectos…
    </div>
  )

  return (
    <div className="flex h-full min-h-screen">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-gray-100">
          <div className="grid grid-cols-4 gap-4 mb-7">
            <MetricCard label="Total prospectos"   value={metricas.total}      sub={`${metricas.activos} activos · ${metricas.inactivos} inactivos`}  icon={Users}       iconColor="bg-gray-50"     />
            <MetricCard label="Nuevos esta semana" value={metricas.nuevos}      sub="desde el lunes"                             color="text-[#2570ba]"  icon={TrendingUp}  iconColor="bg-blue-50"
              active={filtroNuevos}
              onClick={() => { setFiltroNuevos(v => !v); setFiltroConvertidos(false) }}
            />
            <MetricCard label="Convertidos"        value={metricas.convertidos} sub="total histórico"                            color="text-purple-600" icon={CheckCircle} iconColor="bg-purple-50"
              active={filtroConvertidos}
              onClick={() => { setFiltroConvertidos(v => !v); setFiltroNuevos(false) }}
            />
            <MetricCard label="Tasa de conversión" value={`${metricas.tasa}%`}  sub={`${metricas.convertidos} convertidos`}      color="text-emerald-600" icon={ArrowUpRight} iconColor="bg-emerald-50" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Prospectos</h1>
              <p className="mt-0.5 text-xs text-gray-400">{prospectos.length} total · {metricas.activos} activos · {metricas.inactivos} inactivos</p>
            </div>
            <button onClick={handleNuevo}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#2570BA' }}>
              <Plus size={13} />Nuevo prospecto
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar nombre, materia, email…"
                className="w-64 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300" />
            </div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              className={`px-2.5 py-1.5 text-xs border rounded-lg outline-none bg-white transition-all ${filtroEstado ? 'border-[#2570ba] text-[#2570ba]' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Todos los estados</option>
              {ESTADO_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}
              className={`px-2.5 py-1.5 text-xs border rounded-lg outline-none bg-white transition-all ${filtroMateria ? 'border-[#2570ba] text-[#2570ba]' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Todas las materias</option>
              {MATERIA_OPTIONS.map(m => <option key={m}>{m}</option>)}
            </select>
            <select value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}
              className={`px-2.5 py-1.5 text-xs border rounded-lg outline-none bg-white transition-all ${filtroOrigen ? 'border-[#2570ba] text-[#2570ba]' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Todos los orígenes</option>
              {ORIGEN_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
            {hayFiltros && (
              <button onClick={() => { setFiltroOrigen(''); setFiltroMateria(''); setFiltroEstado(''); setFiltroNuevos(false); setFiltroConvertidos(false) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2">
                <X size={11} />Limpiar filtro
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Scale size={28} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Sin prospectos para mostrar</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  {['Nombre', 'Teléfono', 'Email', 'Primer contacto', 'Origen', 'Materia', 'Estado', 'Próxima acción'].map(col => (
                    <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide first:pl-7 last:pr-7">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const inactivo = INACTIVOS.includes(p.estado)
                  const accionStyle = ACCION_STYLES[p.proxima_accion] ?? { dot: 'bg-gray-200', label: 'text-gray-400' }
                  return (
                    <tr key={p.id} onClick={() => handleSelectRow(p)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors group ${
                        seleccionado?.id === p.id ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'
                      } ${inactivo ? 'opacity-55' : ''}`}
                    >
                      <td className="pl-7 pr-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ backgroundColor: inactivo ? '#94a3b8' : '#1a2e4a' }}>
                            {initials(p.nombre)}
                          </div>
                          <span className={`text-xs font-medium whitespace-nowrap ${inactivo ? 'text-gray-400' : 'text-gray-800'}`}>{p.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><span className="text-xs text-gray-500 whitespace-nowrap">{p.telefono}</span></td>
                      <td className="px-3 py-3 max-w-[160px]"><span className="text-xs text-gray-500 truncate block">{p.email}</span></td>
                      <td className="px-3 py-3"><span className="text-xs text-gray-500 whitespace-nowrap">{p.fecha_contacto}</span></td>
                      <td className="px-3 py-3"><OrigenBadge origen={p.origen} /></td>
                      <td className="px-3 py-3"><MateriaBadge materia={p.materia} /></td>
                      <td className="px-3 py-3"><EstadoBadge estado={p.estado} /></td>
                      <td className="px-3 py-3 pr-7">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${accionStyle.dot}`} />
                            <span className={`text-xs whitespace-nowrap ${accionStyle.label}`}>{p.proxima_accion}</span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget({ id: p.id, name: p.nombre }) }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Eliminar prospecto">
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {seleccionado && !mostrarForm && isPortrait && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSeleccionado(null)} />
      )}
      {seleccionado && !mostrarForm && (
        <PanelDetalle
          prospecto={seleccionado}
          onClose={() => setSeleccionado(null)}
          onConvertir={handleConvertir}
          onUpdate={handleUpdate}
        />
      )}
      {mostrarForm && (
        <FormNuevoProspecto
          onClose={() => setMostrarForm(false)}
          onGuardar={handleGuardar}
        />
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
