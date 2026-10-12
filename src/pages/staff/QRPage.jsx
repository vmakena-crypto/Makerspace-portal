import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../supabaseClient'

export default function QRPage() {
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'checkin_token')
      .single()
    if (error) setError(error.message)
    else setToken(data.value)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function rotate() {
    if (!window.confirm('This invalidates every printed QR code. Continue?')) return
    const { error } = await supabase.rpc('rotate_checkin_token')
    if (error) setError(error.message)
    else load()
  }

  const url = token ? `${window.location.origin}/checkin?t=${token}` : ''

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold print:hidden">Lab check-in QR</h1>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-300 p-2 text-sm text-red-900">{error}</div>
      )}

      {token && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center space-y-3">
          <QRCodeSVG value={url} size={260} className="mx-auto" />
          <p className="font-semibold">Scan to check in / out</p>
          <p className="text-xs text-slate-400 break-all print:hidden">{url}</p>
        </div>
      )}

      <div className="flex gap-3 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm">
          Print
        </button>
        <button onClick={rotate} className="rounded-lg border border-red-400 text-red-700 px-4 py-2 text-sm">
          Rotate token
        </button>
      </div>
      <p className="text-xs text-slate-500 print:hidden">
        Rotate the token if you suspect someone is sharing a photo of the QR. You must print the new code
        afterwards.
      </p>
    </div>
  )
}
