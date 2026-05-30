import { Trash2, X } from 'lucide-react'

/**
 * ConfirmDeleteModal — shared across all modules
 *
 * Props:
 *   open      : boolean
 *   title     : string  — what is being deleted (e.g. "esta audiencia")
 *   warning   : string? — optional extra warning line (e.g. "Este cliente tiene 3 causas asociadas que también se eliminarán")
 *   onConfirm : () => void
 *   onCancel  : () => void
 */
export default function ConfirmDeleteModal({ open, title, warning, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Trash2 size={16} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 leading-snug">
                ¿Estás segura de que quieres eliminar {title}?
              </p>
              {warning && (
                <p className="text-[12px] text-amber-600 mt-2 leading-snug bg-amber-50 rounded-lg px-2.5 py-1.5">
                  ⚠ {warning}
                </p>
              )}
              <p className="text-[12px] text-gray-400 mt-2">Esta acción no se puede deshacer.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 text-[13px] font-medium text-gray-600 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 text-[13px] font-medium text-white py-2.5 rounded-xl bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
