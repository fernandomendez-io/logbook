"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateTimeUtcInput } from "@/components/ui/datetime-utc-input";
import { ActualTimeInput } from "@/components/ui/actual-time-input";
import { getLocalTimezone, getTimezoneAbbr } from "@/lib/utils/timezone";
import { blockHours, flightHours, decimalToHHMM } from "@/lib/utils/format";

interface ApproachSuggestion {
  type: string;
  confidence: string;
  reason: string;
  options: string[];
}

interface METARResult {
  metar: string;
  parsed: {
    ceilingFt: number | null;
    visibilitySm: number | null;
    flightCategory: string;
  };
  suggestion: ApproachSuggestion;
}

interface CopilotResult {
  pilot: {
    id: string;
    first_name: string;
    last_name: string;
    seat: string;
    employee_number: string;
  };
}

export interface FlightFormInitialValues {
  flightNumber?: string;
  originIcao?: string;
  destinationIcao?: string;
  scheduledOutUtc?: string; // "YYYY-MM-DDTHH:MM"
  scheduledInUtc?: string;
  actualOutUtc?: string;
  actualOffUtc?: string;
  actualOnUtc?: string;
  actualInUtc?: string;
  aircraftType?: string;
  tailNumber?: string;
  pilotFlying?: string;
  landingPilot?: string;
  approachType?: string;
  approachRunway?: string;
  copilotEmployeeNumber?: string;
  isDeadhead?: boolean;
  hadDiversion?: boolean;
  hadGoAround?: boolean;
  hadRTG?: boolean;
  nightTimeHrs?: number | null;
  notes?: string;
}

interface FlightFormProps {
  flightId?: string; // present on edit, absent on new
  initialValues?: FlightFormInitialValues;
}

const approachOptions = [
  { value: "visual", label: "Visual" },
  { value: "ILS", label: "ILS" },
  { value: "RNAV", label: "RNAV (GPS)" },
  { value: "RNP", label: "RNP / RNP AR" },
  { value: "VOR", label: "VOR" },
  { value: "LOC", label: "Localizer" },
  { value: "NDB", label: "NDB" },
  { value: "other", label: "Other" },
];

function toLocalDT(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16).replace(" ", "T");
}

/** Convert "YYYY-MM-DDTHH:MM" to a full ISO string for the API, or null if incomplete */
function toIso(dt: string): string | null {
  if (!dt || dt.length < 16 || !dt.includes("T")) return null;
  const [date, time] = dt.split("T");
  if (!date || date.length < 10 || !time || time.length < 5) return null;
  return `${date}T${time}:00Z`;
}

export default function FlightForm({
  flightId,
  initialValues = {},
}: FlightFormProps) {
  const router = useRouter();
  const isEdit = Boolean(flightId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savedRef = useRef(false);

  const [flightNumber, setFlightNumber] = useState(
    initialValues.flightNumber ?? "",
  );
  const [originIcao, setOriginIcao] = useState(initialValues.originIcao ?? "");
  const [destinationIcao, setDestinationIcao] = useState(
    initialValues.destinationIcao ?? "",
  );

  // Timezone for time input labels — resolved from airport cache, falls back to browser local
  const [originTz, setOriginTz] = useState<string>(getLocalTimezone());
  const [destTz, setDestTz]     = useState<string>(getLocalTimezone());
  const originTzAbbr = useMemo(() => getTimezoneAbbr(originTz), [originTz]);
  const destTzAbbr   = useMemo(() => getTimezoneAbbr(destTz), [destTz]);

  useEffect(() => {
    if (originIcao.length >= 3) {
      fetch(`/api/airports/${originIcao}`)
        .then(r => r.json())
        .then(d => { if (d.timezone) setOriginTz(d.timezone) })
        .catch(() => {})
    }
  }, [originIcao]);

  useEffect(() => {
    if (destinationIcao.length >= 3) {
      fetch(`/api/airports/${destinationIcao}`)
        .then(r => r.json())
        .then(d => { if (d.timezone) setDestTz(d.timezone) })
        .catch(() => {})
    }
  }, [destinationIcao]);
  const [scheduledOutUtc, setScheduledOutUtc] = useState(
    initialValues.scheduledOutUtc ?? "",
  );
  const [scheduledInUtc, setScheduledInUtc] = useState(
    initialValues.scheduledInUtc ?? "",
  );
  const [actualOutUtc, setActualOutUtc] = useState(
    initialValues.actualOutUtc ?? "",
  );
  const [actualOffUtc, setActualOffUtc] = useState(
    initialValues.actualOffUtc ?? "",
  );
  const [actualOnUtc, setActualOnUtc] = useState(
    initialValues.actualOnUtc ?? "",
  );
  const [actualInUtc, setActualInUtc] = useState(
    initialValues.actualInUtc ?? "",
  );
  const [aircraftType, setAircraftType] = useState(
    initialValues.aircraftType ?? "",
  );
  const [tailNumber, setTailNumber] = useState(initialValues.tailNumber ?? "");
  const [pilotFlying, setPilotFlying] = useState(
    initialValues.pilotFlying ?? "",
  );
  // Landing pilot defaults to pilot flying unless explicitly overridden
  const [landingPilot, setLandingPilot] = useState(
    initialValues.landingPilot ?? initialValues.pilotFlying ?? "",
  );
  const [landingPilotOverridden, setLandingPilotOverridden] = useState(
    Boolean(
      initialValues.landingPilot &&
      initialValues.pilotFlying &&
      initialValues.landingPilot !== initialValues.pilotFlying,
    ),
  );
  const [approachType, setApproachType] = useState(
    initialValues.approachType ?? "",
  );
  const [approachRunway, setApproachRunway] = useState(
    initialValues.approachRunway ?? "",
  );
  const [copilotEmployee, setCopilotEmployee] = useState(
    initialValues.copilotEmployeeNumber ?? "",
  );
  const [copilot, setCopilot] = useState<CopilotResult["pilot"] | null>(null);
  const [metar, setMetar] = useState<METARResult | null>(null);
  const [isDeadhead, setIsDeadhead] = useState(
    initialValues.isDeadhead ?? false,
  );
  const [hadDiversion, setHadDiversion] = useState(
    initialValues.hadDiversion ?? false,
  );
  const [hadGoAround, setHadGoAround] = useState(
    initialValues.hadGoAround ?? false,
  );
  const [hadRTG, setHadRTG] = useState(initialValues.hadRTG ?? false);
  const [notes, setNotes] = useState(initialValues.notes ?? "");
  const [nightTimeHrs, setNightTimeHrs] = useState(
    initialValues.nightTimeHrs !== undefined ? String(initialValues.nightTimeHrs ?? "") : "",
  );

  const [acarsLoading, setAcarsLoading] = useState(false);
  const [acarsNotice, setAcarsNotice] = useState<string | null>(null);
  const [acarsScheduledHint, setAcarsScheduledHint] = useState<{
    outUtc: string | null;
    inUtc: string | null;
  } | null>(null);
  const [metarLoading, setMetarLoading] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);

  // ── Unsaved changes tracking ───────────────────────────────────────────────

  // useState initializer runs once on mount — safe to read during render, never changes
  const [initialSnapshot] = useState(() => ({
    flightNumber:    initialValues.flightNumber    ?? "",
    originIcao:      initialValues.originIcao      ?? "",
    destinationIcao: initialValues.destinationIcao ?? "",
    scheduledOutUtc: initialValues.scheduledOutUtc ?? "",
    scheduledInUtc:  initialValues.scheduledInUtc  ?? "",
    actualOutUtc:    initialValues.actualOutUtc    ?? "",
    actualOffUtc:    initialValues.actualOffUtc    ?? "",
    actualOnUtc:     initialValues.actualOnUtc     ?? "",
    actualInUtc:     initialValues.actualInUtc     ?? "",
    aircraftType:    initialValues.aircraftType    ?? "",
    tailNumber:      initialValues.tailNumber      ?? "",
    pilotFlying:     initialValues.pilotFlying     ?? "",
    landingPilot:    initialValues.landingPilot    ?? initialValues.pilotFlying ?? "",
    approachType:    initialValues.approachType    ?? "",
    approachRunway:  initialValues.approachRunway  ?? "",
    copilotEmployee: initialValues.copilotEmployeeNumber ?? "",
    isDeadhead:      initialValues.isDeadhead      ?? false,
    hadDiversion:    initialValues.hadDiversion    ?? false,
    hadGoAround:     initialValues.hadGoAround     ?? false,
    hadRTG:          initialValues.hadRTG          ?? false,
    nightTimeHrs:    initialValues.nightTimeHrs !== undefined ? String(initialValues.nightTimeHrs ?? "") : "",
    notes:           initialValues.notes           ?? "",
  }));

  const isDirty = useMemo(() => (
    flightNumber      !== initialSnapshot.flightNumber      ||
    originIcao        !== initialSnapshot.originIcao        ||
    destinationIcao   !== initialSnapshot.destinationIcao   ||
    scheduledOutUtc   !== initialSnapshot.scheduledOutUtc   ||
    scheduledInUtc    !== initialSnapshot.scheduledInUtc    ||
    actualOutUtc      !== initialSnapshot.actualOutUtc      ||
    actualOffUtc      !== initialSnapshot.actualOffUtc      ||
    actualOnUtc       !== initialSnapshot.actualOnUtc       ||
    actualInUtc       !== initialSnapshot.actualInUtc       ||
    aircraftType      !== initialSnapshot.aircraftType      ||
    tailNumber        !== initialSnapshot.tailNumber        ||
    pilotFlying       !== initialSnapshot.pilotFlying       ||
    landingPilot      !== initialSnapshot.landingPilot      ||
    approachType      !== initialSnapshot.approachType      ||
    approachRunway    !== initialSnapshot.approachRunway    ||
    copilotEmployee   !== initialSnapshot.copilotEmployee   ||
    isDeadhead        !== initialSnapshot.isDeadhead        ||
    hadDiversion      !== initialSnapshot.hadDiversion      ||
    hadGoAround       !== initialSnapshot.hadGoAround       ||
    hadRTG            !== initialSnapshot.hadRTG            ||
    nightTimeHrs      !== initialSnapshot.nightTimeHrs      ||
    notes             !== initialSnapshot.notes
  ), [flightNumber, originIcao, destinationIcao, scheduledOutUtc, scheduledInUtc,
      actualOutUtc, actualOffUtc, actualOnUtc, actualInUtc, aircraftType, tailNumber,
      pilotFlying, landingPilot, approachType, approachRunway, copilotEmployee,
      isDeadhead, hadDiversion, hadGoAround, hadRTG, nightTimeHrs, notes,
      initialSnapshot]);

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (savedRef.current) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ── Live block / flight time preview ──────────────────────────────────────

  const blockDisplay = useMemo(() => {
    const out = toIso(actualOutUtc), ins = toIso(actualInUtc);
    if (!out || !ins) return "—";
    const hrs = blockHours(out, ins);
    return hrs > 0 ? decimalToHHMM(hrs) : "—";
  }, [actualOutUtc, actualInUtc]);

  const flightDisplay = useMemo(() => {
    const off = toIso(actualOffUtc), on = toIso(actualOnUtc);
    if (!off || !on) return "—";
    const hrs = flightHours(off, on);
    return hrs > 0 ? decimalToHHMM(hrs) : "—";
  }, [actualOffUtc, actualOnUtc]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handlePilotFlyingChange(val: string) {
    setPilotFlying(val);
    if (!landingPilotOverridden) setLandingPilot(val);
  }

  function handleLandingPilotChange(val: string) {
    setLandingPilot(val);
    setLandingPilotOverridden(val !== pilotFlying);
  }

  function handleFillFromScheduled() {
    if (scheduledOutUtc) setActualOutUtc(scheduledOutUtc);
    if (scheduledInUtc) setActualInUtc(scheduledInUtc);
  }

  async function fetchACARs() {
    if (!flightNumber || !scheduledOutUtc) return;
    setAcarsLoading(true);
    const date = scheduledOutUtc.slice(0, 10);
    const params = new URLSearchParams({ flight: flightNumber, date });
    if (originIcao) params.set("origin", originIcao);
    const res = await fetch(`/api/acars?${params}`);
    const data = await res.json();
    setAcarsLoading(false);
    setAcarsNotice(null);
    setAcarsScheduledHint(null);
    console.log("[ACARS response]", data);

    if (data.fallback) {
      setAcarsNotice(
        `Manual input required — ${data.fallbackReason ?? "no actual times recorded by AeroDataBox"}.`,
      );
      if (data.scheduledHint) {
        setAcarsScheduledHint({
          outUtc: data.scheduledHint.outUtc,
          inUtc: data.scheduledHint.inUtc,
        });
      }
      return;
    }

    if (data.outUtc) setActualOutUtc(toLocalDT(data.outUtc));
    if (data.offUtc) setActualOffUtc(toLocalDT(data.offUtc));
    if (data.onUtc) setActualOnUtc(toLocalDT(data.onUtc));
    if (data.inUtc) setActualInUtc(toLocalDT(data.inUtc));
    if (data.tailNumber) setTailNumber(data.tailNumber);
    if (data.landingRunway && !approachRunway)
      setApproachRunway(data.landingRunway);
    if (data.aircraftType && !aircraftType) setAircraftType(data.aircraftType);
    if (data.gateTimesUnavailable) {
      setAcarsNotice(
        "Gate times (OUT/IN) unavailable — only air times (OFF/ON) were recorded. Enter OUT and IN manually.",
      );
    }
  }

  async function fetchMETAR() {
    if (!destinationIcao || !actualOnUtc) return;
    setMetarLoading(true);
    const station =
      destinationIcao.length === 3 ? `K${destinationIcao}` : destinationIcao;
    const res = await fetch(
      `/api/metar?station=${station}&time=${actualOnUtc}:00Z`,
    );
    const data: METARResult = await res.json();
    setMetarLoading(false);
    if (data.metar) {
      setMetar(data);
      if (data.suggestion?.type && !approachType)
        setApproachType(data.suggestion.type);
    }
  }

  async function lookupCopilot() {
    if (!copilotEmployee) return;
    setCopilotLoading(true);
    const res = await fetch(`/api/pilots/lookup?employee=${copilotEmployee}`);
    const data: CopilotResult = await res.json();
    setCopilotLoading(false);
    if (data.pilot) setCopilot(data.pilot);
  }

  async function handleSave() {
    if (
      !flightNumber ||
      !originIcao ||
      !destinationIcao ||
      !toIso(scheduledOutUtc) ||
      !toIso(scheduledInUtc)
    ) {
      setError("Flight number, route, and scheduled times are required");
      return;
    }
    setSaving(true);
    setError("");

    const body = {
      flightNumber,
      originIcao: originIcao.toUpperCase(),
      destinationIcao: destinationIcao.toUpperCase(),
      scheduledOutUtc: toIso(scheduledOutUtc),
      scheduledInUtc: toIso(scheduledInUtc),
      actualOutUtc: toIso(actualOutUtc),
      actualOffUtc: toIso(actualOffUtc),
      actualOnUtc: toIso(actualOnUtc),
      actualInUtc: toIso(actualInUtc),
      aircraftType: aircraftType || null,
      tailNumber: tailNumber || null,
      pilotFlying: pilotFlying || null,
      landingPilot: landingPilot || null,
      approachType: approachType || null,
      approachRunway: approachRunway || null,
      copilotEmployeeNumber: copilotEmployee || null,
      metarRaw: metar?.metar || null,
      ceilingFt: metar?.parsed?.ceilingFt ?? null,
      visibilitySm: metar?.parsed?.visibilitySm ?? null,
      isDeadhead,
      hadDiversion,
      hadGoAround,
      hadReturnToGate: hadRTG,
      nightTimeHrs: nightTimeHrs !== "" ? parseFloat(nightTimeHrs) : null,
      notes: notes || null,
    };

    const res = await fetch(
      isEdit ? `/api/flights/${flightId}` : "/api/flights",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();
    setSaving(false);

    if (data.flight) {
      savedRef.current = true;
      router.push(`/flights/${data.flight.id}`);
    } else {
      setError(data.error || "Save failed");
    }
  }

  const refDate = scheduledOutUtc.slice(0, 10) || undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          {isEdit ? "Edit Flight" : "Log Flight"}
        </h1>
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Flight Identity</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Flight Number"
            value={flightNumber}
            onChange={(e) => setFlightNumber(e.target.value)}
            placeholder="MQ4512"
          />
          <Input
            label="Origin"
            value={originIcao}
            onChange={(e) => setOriginIcao(e.target.value.toUpperCase())}
            placeholder="ORD"
            maxLength={4}
          />
          <Input
            label="Destination"
            value={destinationIcao}
            onChange={(e) => setDestinationIcao(e.target.value.toUpperCase())}
            placeholder="PHL"
            maxLength={4}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <DateTimeUtcInput
            label="Scheduled OUT (Local)"
            value={scheduledOutUtc}
            onChange={setScheduledOutUtc}
          />
          <DateTimeUtcInput
            label="Scheduled IN (Local)"
            value={scheduledInUtc}
            onChange={setScheduledInUtc}
          />
        </div>
      </Card>

      {/* Actual Times */}
      <Card>
        <CardHeader>
          <CardTitle>Actual Times</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFillFromScheduled}
              disabled={!scheduledOutUtc && !scheduledInUtc}
              title="Copy scheduled OUT/IN to actual"
            >
              Fill from Scheduled
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchACARs}
              loading={acarsLoading}
              disabled={!flightNumber || !scheduledOutUtc}
            >
              Fetch ACARS
            </Button>
          </div>
        </CardHeader>
        {acarsNotice && (
          <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            <p className="font-medium">
              ACARS unavailable — manual input required
            </p>
            <p className="text-yellow-300/70 text-xs mt-0.5">{acarsNotice}</p>
            {acarsScheduledHint && (
              <p className="text-yellow-300/60 text-xs mt-1 font-mono">
                Scheduled reference: OUT{" "}
                {acarsScheduledHint.outUtc?.slice(11, 16)}Z / IN{" "}
                {acarsScheduledHint.inUtc?.slice(11, 16)}Z
              </p>
            )}
          </div>
        )}
        <div className="flex gap-4 flex-wrap">
          <ActualTimeInput
            label="OUT"
            value={actualOutUtc}
            onChange={setActualOutUtc}
            hint="Gate departure"
            referenceDate={refDate}
            timezone={originTz}
            timezoneAbbr={originTzAbbr}
          />
          <ActualTimeInput
            label="OFF"
            value={actualOffUtc}
            onChange={setActualOffUtc}
            hint="Wheels off"
            referenceDate={refDate}
            timezone={originTz}
            timezoneAbbr={originTzAbbr}
          />
          <ActualTimeInput
            label="ON"
            value={actualOnUtc}
            onChange={setActualOnUtc}
            hint="Wheels on"
            referenceDate={refDate}
            timezone={destTz}
            timezoneAbbr={destTzAbbr}
          />
          <ActualTimeInput
            label="IN"
            value={actualInUtc}
            onChange={setActualInUtc}
            hint="Gate arrival"
            referenceDate={refDate}
            timezone={destTz}
            timezoneAbbr={destTzAbbr}
          />
        </div>

        {/* Live block / flight time preview */}
        <div className="mt-3 pt-3 border-t border-border flex gap-6 text-xs text-foreground/50">
          <span>
            Block:{" "}
            <span className="font-mono text-foreground/80">{blockDisplay}</span>
          </span>
          <span className="text-foreground/20">|</span>
          <span>
            Flight:{" "}
            <span className="font-mono text-foreground/80">{flightDisplay}</span>
          </span>
        </div>
      </Card>

      {/* Aircraft */}
      <Card>
        <CardHeader>
          <CardTitle>Aircraft</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            value={aircraftType}
            onChange={(e) => setAircraftType(e.target.value)}
            placeholder="Select type"
            options={[
              { value: "E170", label: "Embraer 170" },
              { value: "E175", label: "Embraer 175" },
            ]}
          />
          <Input
            label="Tail Number"
            value={tailNumber}
            onChange={(e) => setTailNumber(e.target.value.toUpperCase())}
            placeholder="N123HQ"
          />
        </div>
      </Card>

      {/* Crew */}
      <Card>
        <CardHeader>
          <CardTitle>Crew</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Pilot Flying"
            value={pilotFlying}
            onChange={(e) => handlePilotFlyingChange(e.target.value)}
            placeholder="Select"
            options={[
              { value: "CA", label: "Captain (CA)" },
              { value: "FO", label: "First Officer (FO)" },
            ]}
          />
          <Select
            label={`Landing Pilot${!landingPilotOverridden && pilotFlying ? " (same as PF)" : ""}`}
            value={landingPilot}
            onChange={(e) => handleLandingPilotChange(e.target.value)}
            placeholder="Select"
            options={[
              { value: "CA", label: "Captain" },
              { value: "FO", label: "First Officer" },
            ]}
          />
        </div>
        <div className="mt-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Co-pilot Employee #"
                value={copilotEmployee}
                onChange={(e) => setCopilotEmployee(e.target.value)}
                placeholder="e.g. 12345"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={lookupCopilot}
              loading={copilotLoading}
              disabled={!copilotEmployee}
            >
              Lookup
            </Button>
          </div>
          {copilot && (
            <div className="mt-2 px-3 py-2 bg-green-primary/10 border border-green-primary/20 rounded-md flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-green-primary/20 flex items-center justify-center text-xs font-bold text-green-primary">
                {copilot.first_name[0]}
                {copilot.last_name[0]}
              </div>
              <span className="text-sm text-foreground">
                {copilot.first_name} {copilot.last_name}
              </span>
              <Badge variant="outline">{copilot.seat}</Badge>
              <span className="text-xs text-foreground/40 ml-auto">
                #{copilot.employee_number}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Approach & Weather */}
      <Card>
        <CardHeader>
          <CardTitle>Approach & Weather</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchMETAR}
            loading={metarLoading}
            disabled={!destinationIcao || !actualOnUtc}
          >
            Fetch METAR at Landing
          </Button>
        </CardHeader>

        {metar && (
          <div className="mb-4 p-3 bg-surface-raised rounded-md space-y-2">
            <p className="font-mono text-xs text-foreground/70">
              {metar.metar}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <Badge
                variant={
                  metar.parsed.flightCategory === "VFR"
                    ? "green"
                    : metar.parsed.flightCategory === "MVFR"
                      ? "blue"
                      : metar.parsed.flightCategory === "IFR"
                        ? "yellow"
                        : "red"
                }
              >
                {metar.parsed.flightCategory}
              </Badge>
              {metar.parsed.ceilingFt !== null && (
                <span className="text-foreground/60">
                  Ceiling: {metar.parsed.ceilingFt}ft
                </span>
              )}
              {metar.parsed.visibilitySm !== null && (
                <span className="text-foreground/60">
                  Vis: {metar.parsed.visibilitySm}sm
                </span>
              )}
            </div>
            {metar.suggestion && (
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <span>Suggested:</span>
                <Badge variant="green">{metar.suggestion.type}</Badge>
                <span className="text-foreground/30">
                  ({metar.suggestion.confidence} confidence)
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Approach Type"
            value={approachType}
            onChange={(e) => setApproachType(e.target.value)}
            placeholder="Select approach"
            options={approachOptions}
          />
          <Input
            label="Landing Runway"
            value={approachRunway}
            onChange={(e) => setApproachRunway(e.target.value.toUpperCase())}
            placeholder="28R"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input
            label="Night Time (hrs)"
            type="number"
            min="0"
            step="0.01"
            value={nightTimeHrs}
            onChange={(e) => setNightTimeHrs(e.target.value)}
            placeholder="0.00 — auto-filled from FlightAware"
          />
        </div>

        {metar?.suggestion?.options && metar.suggestion.options.length > 1 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="text-xs text-foreground/40 self-center">
              Quick select:
            </span>
            {metar.suggestion.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setApproachType(opt)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  approachType === opt
                    ? "bg-green-primary/20 border-green-primary text-green-primary"
                    : "border-border text-foreground/50 hover:border-green-dim"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Special Events */}
      <Card>
        <CardHeader>
          <CardTitle>Special Events</CardTitle>
        </CardHeader>
        <div className="flex gap-6">
          {[
            { label: "Deadhead", value: isDeadhead, set: setIsDeadhead },
            { label: "Diversion", value: hadDiversion, set: setHadDiversion },
            { label: "Go-Around", value: hadGoAround, set: setHadGoAround },
            { label: "Return to Gate", value: hadRTG, set: setHadRTG },
          ].map((item) => (
            <label
              key={item.label}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={item.value}
                onChange={(e) => item.set(e.target.checked)}
                className="rounded border-border bg-surface text-green-primary focus:ring-green-primary"
              />
              <span className="text-sm text-foreground/70">{item.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
          />
        </div>
      </Card>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3 pb-8 items-center">
        <Button size="lg" onClick={handleSave} loading={saving}>
          {isEdit ? "Save Changes" : "Save Flight"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        {isDirty && (
          <span className="text-xs text-foreground/40 flex items-center gap-1 ml-1">
            <span className="text-yellow-400/70">●</span> Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
