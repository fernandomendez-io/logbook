'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { decimalToHHMM } from '@/lib/utils/format'
import type { PayPeriodSummary } from '@/lib/pay/calculator'

// Return YYYY-MM-DD range for a given month
function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function currentMonthRange() {
  const now = new Date()
  return monthRange(now.getFullYear(), now.getMonth() + 1)
}

function shiftMonth(start: string, delta: number) {
  const [y, m] = start.slice(0, 7).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return monthRange(d.getUTCFullYear(), d.getUTCMonth() + 1)
}

function formatMonthLabel(start: string) {
  const [y, m] = start.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

interface MonthEntry {
  month: string
  summary: PayPeriodSummary
}

export default function PayPage() {
  const { start: defaultStart, end: defaultEnd } = currentMonthRange()
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [summary, setSummary] = useState<PayPeriodSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [ytdMonths, setYtdMonths] = useState<MonthEntry[]>([])
  const [ytdSummary, setYtdSummary] = useState<PayPeriodSummary | null>(null)
  const [ytdLoading, setYtdLoading] = useState(true)

  async function fetchPay(s = start, e = end) {
    setLoading(true)
    const res = await fetch(`/api/pay/calculate?start=${s}&end=${e}`)
    const data = await res.json()
    setLoading(false)
    if (data.summary) setSummary(data.summary)
  }

  async function fetchYTD() {
    setYtdLoading(true)
    const year = new Date().getFullYear()
    const res = await fetch(`/api/pay/ytd?year=${year}`)
    const data = await res.json()
    setYtdLoading(false)
    if (data.months) setYtdMonths(data.months)
    if (data.ytd) setYtdSummary(data.ytd)
  }

  function goToPrevMonth() {
    const range = shiftMonth(start, -1)
    setStart(range.start)
    setEnd(range.end)
    fetchPay(range.start, range.end)
  }

  function goToNextMonth() {
    const range = shiftMonth(start, 1)
    setStart(range.start)
    setEnd(range.end)
    fetchPay(range.start, range.end)
  }

  function goToCurrentMonth() {
    const range = currentMonthRange()
    setStart(range.start)
    setEnd(range.end)
    fetchPay(range.start, range.end)
  }

  useEffect(() => {
    fetchPay()
    fetchYTD()
  }, [])

  const rows = summary ? [
    { label: 'Scheduled Block', hrs: summary.scheduledBlockHrs, variant: 'gray' as const },
    { label: 'Actual Block', hrs: summary.actualBlockHrs, variant: 'gray' as const },
    { label: 'Credit Hours (better of)', hrs: summary.creditHrs, variant: 'green' as const },
    { label: 'Deadhead Credit', hrs: summary.deadheadHrs, variant: 'blue' as const },
    { label: 'Misconnect Credit', hrs: summary.misconnectHrs, variant: 'yellow' as const },
    { label: 'Guarantee Applied', hrs: summary.guaranteeApplied, variant: summary.guaranteeApplied > 0 ? 'yellow' as const : 'gray' as const },
    { label: 'Total Credit', hrs: summary.totalCreditHrs, variant: 'green' as const },
  ] : []

  const periodLabel = start ? formatMonthLabel(start) : ''

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pay Calculator</h1>
        <p className="text-sm text-foreground/50 mt-1">Block hour credit vs. scheduled — guarantee & misconnect tracking</p>
      </div>

      {/* Period selector with month nav */}
      <Card>
        <CardHeader>
          <CardTitle>{periodLabel || 'Pay Period'}</CardTitle>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={goToPrevMonth}
              className="px-2 py-1 text-sm rounded text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={goToCurrentMonth}
              className="px-2 py-1 text-xs rounded text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              This Month
            </button>
            <button
              onClick={goToNextMonth}
              className="px-2 py-1 text-sm rounded text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              Next →
            </button>
          </div>
        </CardHeader>
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <Input label="Start Date" type="date" value={start} onChange={e => setStart(e.target.value)} />
          <Input label="End Date" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          <Button onClick={() => fetchPay()} loading={loading}>Calculate</Button>
        </div>
      </Card>

      {summary && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </>
      )}

      {/* YTD Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Year to Date — {new Date().getFullYear()}</CardTitle>
          {ytdSummary && (
            <span className="text-xs text-foreground/40 ml-auto font-mono">
              YTD Total: {decimalToHHMM(ytdSummary.totalCreditHrs)}
            </span>
          )}
        </CardHeader>
        {ytdLoading ? (
          <p className="text-sm text-foreground/40 py-4">Loading...</p>
        ) : ytdMonths.length === 0 ? (
          <p className="text-sm text-foreground/40 py-4">No flights logged this year.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                  <th className="text-left pb-2">Month</th>
                  <th className="text-right pb-2">Flights</th>
                  <th className="text-right pb-2">Credit</th>
                  <th className="text-right pb-2">Block</th>
                  <th className="text-right pb-2 hidden md:table-cell">Guar?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {ytdMonths.map(({ month, summary: s }) => (
                  <tr
                    key={month}
                    className="hover:bg-surface-raised transition-colors cursor-pointer"
                    onClick={() => {
                      const range = shiftMonth(month + '-01', 0)
                      setStart(range.start)
                      setEnd(range.end)
                      fetchPay(range.start, range.end)
                    }}
                  >
                    <td className="py-2.5 text-foreground/80">
                      {new Date(month + '-15').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}
                    </td>
                    <td className="py-2.5 text-right font-mono text-foreground/60">{s.flightCount}</td>
                    <td className="py-2.5 text-right font-mono text-green-primary font-medium">{decimalToHHMM(s.totalCreditHrs)}</td>
                    <td className="py-2.5 text-right font-mono text-foreground/60">{decimalToHHMM(s.actualBlockHrs)}</td>
                    <td className="py-2.5 text-right hidden md:table-cell">
                      {s.guaranteeApplied > 0
                        ? <Badge variant="yellow">Yes</Badge>
                        : <span className="text-foreground/30 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
                {/* YTD totals row */}
                {ytdSummary && (
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2.5 text-foreground/80">YTD Total</td>
                    <td className="py-2.5 text-right font-mono text-foreground/60">{ytdSummary.flightCount}</td>
                    <td className="py-2.5 text-right font-mono text-green-primary">{decimalToHHMM(ytdSummary.totalCreditHrs)}</td>
                    <td className="py-2.5 text-right font-mono text-foreground/60">{decimalToHHMM(ytdSummary.actualBlockHrs)}</td>
                    <td className="py-2.5 hidden md:table-cell" />
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-foreground/30 pt-3">Click a month row to load its details above.</p>
          </div>
        )}
      </Card>

      {/* Notes */}
      <div className="text-xs text-foreground/30 space-y-1 px-1">
        <p>• Credit = max(scheduled block, actual block) per FAR and typical CBA rules</p>
        <p>• Deadhead credited at 50% — verify against your specific CBA</p>
        <p>• Monthly guarantee default: 75 hours — configure in pay calculator settings</p>
        <p>• Misconnect credit not yet automated — enter manually via flight notes</p>
      </div>
    </div>
  )
}
