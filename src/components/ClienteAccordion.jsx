import { ChevronDown, Scale } from 'lucide-react'

// ── CausaIdentChip ───────────────────────────────────────────────────────────
// Shows RIT, RUC, or both when a causa has both identifiers.
export function CausaIdentChip({ rit, ruc, size = 'md' }) {
  const cls = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 rounded'
    : 'text-[11px] px-2 py-0.5 rounded-lg'
  if (!rit && !ruc) return <span className={`text-gray-400 font-medium ${cls}`}>Sin RIT/RUC</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      {rit && (
        <span className={`font-mono font-bold border whitespace-nowrap bg-violet-50 text-violet-700 border-violet-100 ${cls}`}>
          {rit}
        </span>
      )}
      {rit && ruc && <span className="text-gray-300 text-[9px]">·</span>}
      {ruc && (
        <span className={`font-mono font-bold border whitespace-nowrap bg-sky-50 text-sky-700 border-sky-100 ${cls}`}>
          RUC {ruc}
        </span>
      )}
    </span>
  )
}

// ── CausaAccordionCard ────────────────────────────────────────────────────────
// A single causa row inside an expanded ClienteAccordionRow.
// Props:
//   rit, ruc      — identifiers for the chip
//   materia       — text below the chip
//   rightContent  — ReactNode (badges, counts) shown at right before chevron
//   onClick       — fires when the row is clicked
//   linkLabel     — optional hover-link text (e.g. "Ver causa →")
//   onLinkClick   — fires when the hover link is clicked
export function CausaAccordionCard({ rit, ruc, materia, rightContent, onClick, linkLabel, onLinkClick }) {
  return (
    <div className="group/card flex items-center gap-1 rounded-xl hover:bg-[#1a2e4a]/5 transition-colors">
      <button onClick={onClick} className="flex-1 text-left flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-[#1a2e4a]/8 flex items-center justify-center flex-shrink-0">
          <Scale size={14} className="text-[#1a2e4a]/50" />
        </div>
        <div className="flex-1 min-w-0">
          <CausaIdentChip rit={rit} ruc={ruc} size="sm" />
          {materia && <p className="text-[11px] text-gray-400 truncate mt-0.5">{materia}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {rightContent}
          <svg className="text-gray-300 group-hover/card:text-[#2570ba] transition-colors flex-shrink-0" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>
      {linkLabel && onLinkClick && (
        <button
          onClick={e => { e.stopPropagation(); onLinkClick() }}
          className="opacity-0 group-hover/card:opacity-100 flex-shrink-0 px-2 py-1 mr-2 text-[9px] font-semibold text-[#2570ba] hover:underline transition-opacity"
        >
          {linkLabel}
        </button>
      )}
    </div>
  )
}

// ── ClienteAccordionRow ───────────────────────────────────────────────────────
// Accordion header + expandable list of CausaAccordionCard children.
// Props:
//   clienteNombre   — display name
//   hasActiveCausas — controls avatar color (blue vs gray)
//   isExpanded      — open/closed state
//   onToggle        — fires on chevron click
//   onSelect        — optional: fires on name/avatar click (if set, chevron is a separate button)
//   isSelected      — adds a subtle ring (optional)
//   subtitle        — text below the name
//   badge           — optional ReactNode (e.g. pendientes badge)
//   children        — CausaAccordionCard list
export function ClienteAccordionRow({
  clienteNombre, hasActiveCausas, isExpanded, onToggle, onSelect, isSelected, subtitle, badge, children
}) {
  const ini = (clienteNombre || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

  const avatar = (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold select-none"
      style={{ backgroundColor: hasActiveCausas ? '#2570BA' : '#9CA3AF' }}
    >
      {ini}
    </div>
  )

  const nameBlock = (
    <div className="flex-1 min-w-0">
      <p className={`text-[13px] font-semibold truncate ${hasActiveCausas ? 'text-[#1a2e4a]' : 'text-gray-400'}`}>
        {clienteNombre}
      </p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )

  const chevron = (
    <ChevronDown
      size={15}
      className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
    />
  )

  return (
    <div className={`border border-gray-100 rounded-2xl overflow-hidden transition-shadow ${isExpanded ? 'shadow-sm' : ''} ${isSelected ? 'ring-1 ring-[#2570BA]/25' : ''}`}>
      {onSelect ? (
        // Two areas: name/avatar → onSelect; chevron → onToggle
        <div className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${isExpanded ? 'bg-[#1a2e4a]/[0.04]' : 'bg-white hover:bg-gray-50/80'}`}>
          <button onClick={onSelect} className="flex-1 flex items-center gap-3 text-left min-w-0">
            {avatar}
            {nameBlock}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            {badge}
            <button onClick={onToggle} className="p-1 rounded-lg hover:bg-gray-200/60 transition-colors">
              {chevron}
            </button>
          </div>
        </div>
      ) : (
        // Whole header is the toggle
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${isExpanded ? 'bg-[#1a2e4a]/[0.04]' : 'bg-white hover:bg-gray-50'}`}
        >
          {avatar}
          {nameBlock}
          <div className="flex items-center gap-2 flex-shrink-0">
            {badge}
            {chevron}
          </div>
        </button>
      )}

      {isExpanded && (
        <div className="border-t border-gray-100 bg-white px-3 py-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  )
}
