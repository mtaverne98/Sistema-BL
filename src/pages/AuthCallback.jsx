import { useEffect } from 'react'
import { Loader } from 'lucide-react'

// OAuth callback is now handled server-side by the Supabase Edge Function.
// This page only exists as a fallback — redirect to configuracion immediately.
export default function AuthCallback() {
  useEffect(() => {
    window.location.replace('/configuracion')
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <Loader size={36} className="text-blue-400 animate-spin" />
    </div>
  )
}
