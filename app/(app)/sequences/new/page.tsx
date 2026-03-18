'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { ParsedSequence } from '@/lib/parsers/sequence-parser'

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function fmtHrs(hrs?: number) {
  if (hrs == null) return '—'
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export default function NewSequencePage() {
  const router = useRouter()
  const [rawText, setRawText] = useState('')
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const [parsed, setParsed] = useState<ParsedSequence | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setError('')
    const res = await fetch('/api/sequences/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, yearMonth }),
    })
    const data = await res.json()
    setParsing(false)
    if (data.parsed) {
      setParsed(data.parsed)
    } else {
      setError(data.error || 'Parse failed')
    }
  }

  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    const res = await fetch('/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, yearMonth, confirmedFlights: parsed.allFlights }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.sequence) {
      router.push(`/sequences/${data.sequence.id}`)
    } else {
      setError(data.error || 'Save failed')
    }
  }

  const activeFlights = parsed?.allFlights.filter(f => !f.isCancelled && !f.isDeadhead) ?? []
  const deadheads     = parsed?.allFlights.filter(f => f.isDeadhead) ?? []
  const cancelled     = parsed?.allFlights.filter(f => f.isCancelled) ?? []

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Sequence</h1>
          <p className="text-sm text-foreground/50 mt-1">Paste your HSS sequence below</p>
        </div>
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>

      {/* Input area */}
      <Card>
        {/* Month picker — required to resolve day numbers to full dates */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
            Sequence Month
          </label>
          <input
            type="month"
            value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-green-primary/50"
          />
          <p className="text-xs text-foreground/30 mt-1">
            HSS shows day numbers only — this tells the parser which month they fall in.
          </p>
        </div>

        <Textarea
          label="HSS Sequence Text"
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          rows={14}
          placeholder={`SEQ 5375 BASE DFW SEL 402 DOM E75\nCAPT MENDEZ LANKHAAR F EMP NBR 772374\nF/O RUHL II CH EMP NBR 887389\n DT EQ FLT STA DEP STA ARR AC FLY GTR GRD ACT\nSKD 15 54 3779 DFW 0710 TUL 0825 1.15 0.30\nACT 15 1A 3779 DFW 0704 TUL 0812 1.08 1.15 0.38\n...`}
          hint="Copy and paste directly from your HSS printout or PDF."
        />
        <div className="flex gap-3 mt-4">
          <Button onClick={handleParse} loading={parsing} disabled={!rawText.trim() || !yearMonth}>
            Parse Sequence
          </Button>
          {parsed && (
            <Button variant="secondary" onClick={() => setParsed(null)}>
              Clear
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </Card>

      {/* Parsed preview */}
      {parsed && (
        <div className="space-y-4">
          {/* Warnings */}
          {parsed.warnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-400 mb-1">Parser Warnings</p>
              {parsed.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-300/80">{w}</p>
              ))}
            </div>
          )}

          {/* Sequence header */}
          <Card>
            <CardHeader>
              <CardTitle>Sequence Summary</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-foreground/40 text-xs mb-1">Sequence</p>
                <p className="font-mono font-bold text-green-primary">{parsed.sequenceNumber || '—'}</p>
              </div>
              <div>
                <p className="text-foreground/40 text-xs mb-1">Base</p>
                <p className="font-mono">{parsed.domicile || '—'}</p>
              </div>
              <div>
                <p className="text-foreground/40 text-xs mb-1">Equipment</p>
                <p className="font-mono">{parsed.equipmentType || '—'}</p>
              </div>
              <div>
                <p className="text-foreground/40 text-xs mb-1">TAFB</p>
                <p className="font-mono">{parsed.tafbHrs ? fmtHrs(parsed.tafbHrs) : '—'}</p>
              </div>
              {parsed.captainName && (
                <div>
                  <p className="text-foreground/40 text-xs mb-1">Captain</p>
                  <p className="text-sm">{parsed.captainName}</p>
                </div>
              )}
              {parsed.foName && (
                <div>
                  <p className="text-foreground/40 text-xs mb-1">First Officer</p>
                  <p className="text-sm">{parsed.foName}</p>
                </div>
              )}
              <div>
                <p className="text-foreground/40 text-xs mb-1">Credit</p>
                <p className="font-mono">{parsed.sequenceCreditHrs ? fmtHrs(parsed.sequenceCreditHrs) : '—'}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t border-border flex-wrap">
              <Badge variant="green">{activeFlights.length} flights</Badge>
              {deadheads.length > 0 && <Badge variant="blue">{deadheads.length} deadheads</Badge>}
              {cancelled.length > 0 && <Badge variant="red">{cancelled.length} cancelled/RTD</Badge>}
              {parsed.events.length > 0 && <Badge variant="yellow">{parsed.events.length} events</Badge>}
            </div>
          </Card>

          {/* Duty periods */}
          {parsed.dutyPeriods.map((dp, dpIdx) => (
            <Card key={dpIdx}>
              <CardHeader>
                <CardTitle>Day {dpIdx + 1} — {dp.reportDate}</CardTitle>
                <div className="flex items-center gap-4 text-xs text-foreground/40 font-mono">
                  <span>RPT {dp.reportTime} / REL {dp.releaseTime}</span>
                  {dp.guaranteeHrs != null && (
                    <span>Credit {fmtHrs(dp.guaranteeHrs)}</span>
                  )}
                  {dp.actualOnDutyHrs != null && (
                    <span>On Duty {fmtHrs(dp.actualOnDutyHrs)}</span>
                  )}
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                      <th className="text-left pb-2 pr-4">Flt</th>
                      <th className="text-left pb-2 pr-4">Route</th>
                      <th className="text-left pb-2 pr-4">Sched</th>
                      <th className="text-left pb-2 pr-4">Actual</th>
                      <th className="text-right pb-2 pr-4">Skd Blk</th>
                      <th className="text-right pb-2 pr-4">Act Blk</th>
                      <th className="text-left pb-2">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dp.flights.map((f, fIdx) => (
                      <tr key={fIdx} className={f.isCancelled ? 'opacity-40' : ''}>
                        <td className="py-2 pr-4 font-mono font-medium text-green-primary">
                          {f.flightNumber}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {f.originIcao}–{f.destinationIcao}
                        </td>
                        <td className="py-2 pr-4 font-mono text-foreground/60 text-xs">
                          {f.scheduledOut}/{f.scheduledIn}
                        </td>
                        <td className="py-2 pr-4 font-mono text-foreground/60 text-xs">
                          {f.actualOut && f.actualIn
                            ? `${f.actualOut}/${f.actualIn}`
                            : f.actualOut
                            ? `${f.actualOut}/—`
                            : '—'}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-xs text-foreground/50">
                          {fmtHrs(f.scheduledBlockHrs)}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-xs">
                          {f.actualBlockHrs != null
                            ? <span className={f.actualBlockHrs > (f.scheduledBlockHrs ?? 0) ? 'text-yellow-400' : 'text-foreground/70'}>
                                {fmtHrs(f.actualBlockHrs)}
                              </span>
                            : <span className="text-foreground/30">—</span>}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1 flex-wrap">
                            {f.isDeadhead
                              ? <Badge variant="blue">DH</Badge>
                              : f.isCancelled
                              ? <Badge variant="red">{f.isReturnedToGate ? 'RTD' : 'CXL'}</Badge>
                              : <Badge variant="green">Flight</Badge>}
                            {f.isDiverted && <Badge variant="yellow">DIV</Badge>}
                            {f.isStub && <Badge variant="outline">STUB</Badge>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          {/* Events */}
          {parsed.events.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Schedule Events</CardTitle></CardHeader>
              <div className="space-y-2">
                {parsed.events.map((evt, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant={
                      evt.type === 'return_to_gate' ? 'yellow' :
                      evt.type === 'diversion' ? 'red' : 'blue'
                    }>
                      {evt.type.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                    <span className="text-foreground/70">{evt.description}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Save */}
          <div className="flex gap-3 pb-8">
            <Button size="lg" onClick={handleSave} loading={saving}>
              Save Sequence & {parsed.allFlights.length} Flights
            </Button>
            <Button variant="secondary" onClick={() => setParsed(null)}>
              Re-parse
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
