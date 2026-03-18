'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { decimalToHHMM } from '@/lib/utils/format'
import type { PayPeriodSummary } from '@/lib/pay/calculator'

// Default to current month
function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

export default function PayPage() {
  const { start: defaultStart, end: defaultEnd } = currentMonthRange()
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [summary, setSummary] = useState<PayPeriodSummary | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchPay() {
    setLoading(true)
    const res = await fetch(`/api/pay/calculate?start=${start}&end=${end}`)
    const data = await res.json()
    setLoading(false)
    if (data.summary) setSummary(data.summary)
  }

  useEffect(() => { fetchPay() }, [])

  const rows = summary ? [
    { label: 'Scheduled Block', hrs: summary.scheduledBlockHrs, variant: 'gray' as const },
    { label: 'Actual Block', hrs: summary.actualBlockHrs, variant: 'gray' as const },
    { label: 'Credit Hours (better of)', hrs: summary.creditHrs, variant: 'green' as const },
    { label: 'Deadhead Credit', hrs: summary.deadheadHrs, variant: 'blue' as const },
    { label: 'Misconnect Credit', hrs: summary.misconnectHrs, variant: 'yellow' as const },
    { label: 'Guarantee Applied', hrs: summary.guaranteeApplied, variant: summary.guaranteeApplied > 0 ? 'yellow' as const : 'gray' as const },
    { label: 'Total Credit', hrs: summary.totalCreditHrs, variant: 'green' as const },
  ] : []

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pay Calculator</h1>
        <p className="text-sm text-foreground/50 mt-1">Block hour credit vs. scheduled — guarantee & misconnect tracking</p>
      </div>

      {/* Period selector */}
      <Card>
        <CardHeader><CardTitle>Pay Period</CardTitle></CardHeader>
        <div className="flex gap-4 items-end">
          <Input label="Start Date" type="date" value={start} onChange={e => setStart(e.target.value)} />
          <Input label="End Date" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          <Button onClick={fetchPay} loading={loading}>Calculate</Button>
        </div>
      </Card>

      {summary && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Total Credit</p>
              <p className="text-3xl font-bold text-green-primary font-mono">{decimalToHHMM(summary.totalCreditHrs)}</p>
              {summary.guaranteeApplied > 0 && (
                <p className="text-xs text-yellow-400 mt-1">Guarantee applied: +{decimalToHHMM(summary.guaranteeApplied)}</p>
              )}
            </Card>
            <Card>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Monthly Guarantee</p>
              <p className="text-3xl font-bold font-mono text-foreground/70">{decimalToHHMM(summary.guaranteeHrs)}</p>
              <p className="text-xs text-foreground/40 mt-1">
                {summary.totalCreditHrs >= summary.guaranteeHrs
                  ? <span className="text-green-primary">Above guarantee</span>
                  : <span className="text-yellow-400">Below guarantee — guarantee pays</span>}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Flights</p>
              <p className="text-3xl font-bold text-green-primary font-mono">{summary.flightCount}</p>
              <p className="text-xs text-foreground/40 mt-1">
                {summary.deadheadCount > 0 && `${summary.deadheadCount} deadheads · `}
                {summary.cancelledCount > 0 && `${summary.cancelledCount} cancelled`}
              </p>
            </Card>
          </div>

          {/* Breakdown table */}
          <Card>
            <CardHeader><CardTitle>Hour Breakdown</CardTitle></CardHeader>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                  <th className="text-left pb-2">Category</th>
                  <th className="text-right pb-2">Decimal</th>
                  <th className="text-right pb-2">HH:MM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map(row => (
                  <tr key={row.label}>
                    <td className="py-2.5 flex items-center gap-2">
                      <Badge variant={row.variant}>{row.label}</Badge>
                    </td>
                    <td className="py-2.5 text-right font-mono text-foreground/70">{row.hrs.toFixed(2)}</td>
                    <td className="py-2.5 text-right font-mono text-foreground">{decimalToHHMM(row.hrs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Notes */}
          <div className="text-xs text-foreground/30 space-y-1 px-1">
            <p>• Credit = max(scheduled block, actual block) per FAR and typical CBA rules</p>
            <p>• Deadhead credited at 50% — verify against your specific CBA</p>
            <p>• Monthly guarantee default: 75 hours — configure in pay calculator settings</p>
            <p>• Misconnect credit not yet automated — enter manually via flight notes</p>
          </div>
        </>
      )}
    </div>
  )
}
