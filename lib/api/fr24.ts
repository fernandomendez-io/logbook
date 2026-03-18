/**
 * FlightRadar24 official API client (fr24api)
 * https://fr24api.flightradar24.com/docs
 *
 * Two-step fetch:
 *   1. /api/flight-summary/light  — fr24_id, aircraft, origin/dest, fallback OFF/ON
 *   2. /api/historic/flight-events/light?event_types=all — all timed events
 *
 * Event → ACARS mapping:
 *   gate_departure → OUT    takeoff → OFF    landed → ON    gate_arrival → IN
 */

const BASE_URL = "https://fr24api.flightradar24.com";

export interface AirspaceTransition {
  timestamp: string;
  exited: string | null;
  exitedId: string | null;
  entered: string | null;
  enteredId: string | null;
}

export interface ACARSTimes {
  outUtc: string | null;
  offUtc: string | null;
  onUtc: string | null;
  inUtc: string | null;
  tailNumber: string | null;
  aircraftType: string | null;
  origin: string | null;
  destination: string | null;
  departureGate?: string | null;
  arrivalGate?: string | null;
  departureRunway?: string | null;
  landingRunway?: string | null;
  cruiseGspeedKts?: number | null;
  cruiseAltFt?: number | null;
  descentStartUtc?: string | null;
  airspaceTransitions?: AirspaceTransition[];
  gateTimesUnavailable?: boolean;
  usedFirstLastFallback?: boolean;
}

export interface ACARSResult {
  times: ACARSTimes | null;
  scheduledHint: ACARSTimes | null;
  raw: unknown;
  fr24FlightId: string | null;
  selectedIndex: number | null;
  totalLegs: number;
  status: string | null;
}

interface FR24SummaryFlight {
  fr24_id: string;
  flight: string;
  callsign?: string;
  status?: string;
  orig_iata?: string;
  orig_icao?: string;
  dest_iata?: string;
  dest_icao?: string;
  dest_iata_actual?: string;
  dest_icao_actual?: string;
  datetime_takeoff?: string;
  datetime_landed?: string;
  reg?: string;
  type?: string;
}

interface FR24SummaryResponse {
  data: FR24SummaryFlight[];
}

interface FR24Event {
  type: string;
  timestamp: string;
  lat?: number | null;
  lon?: number | null;
  alt?: number | null;
  gspeed?: number | null;
  details?: {
    gate_ident?: string | null;
    takeoff_runway?: string | null;
    landed_icao?: string | null;
    landed_runway?: string | null;
    exited_airspace?: string | null;
    exited_airspace_id?: string | null;
    entered_airspace?: string | null;
    entered_airspace_id?: string | null;
  } | null;
}

interface FR24EventFlight {
  fr24_id: string;
  events: FR24Event[];
}
interface FR24EventResponse {
  data: FR24EventFlight[];
}

async function fr24Fetch(
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  const apiKey = process.env.FR24_API_KEY;
  if (!apiKey) throw new Error("FR24_API_KEY not configured");

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Accept-Version": "v1",
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`[FR24] ${response.status} ${path}: ${text.slice(0, 400)}`);
    throw new Error(
      `FR24 API error: ${response.status} ${response.statusText}`,
    );
  }
  if (!text || text.trim() === "" || text.trim() === "null") return null;
  try {
    return JSON.parse(text);
  } catch {
    console.error("[FR24] Non-JSON response:", text.slice(0, 400));
    return null;
  }
}

function mapAircraftType(icaoType?: string): string | null {
  if (!icaoType) return null;
  const t = icaoType.toUpperCase();
  if (t === "E170" || t === "E17L" || t === "E17S") return "E170";
  if (t === "E75L" || t === "E75S" || t === "E175" || t.includes("175"))
    return "E175";
  return icaoType;
}

function matchesOrigin(leg: FR24SummaryFlight, originIata: string): boolean {
  const iata = originIata.toUpperCase();
  if (leg.orig_iata?.toUpperCase() === iata) return true;
  const icao = leg.orig_icao?.toUpperCase() ?? "";
  if (icao === `K${iata}`) return true;
  if (icao.length === 4 && icao.slice(1) === iata) return true;
  return false;
}

function findEvent(events: FR24Event[], type: string): FR24Event | undefined {
  return events.find((e) => e.type === type);
}

export async function fetchACARSTimes(
  flightIdent: string,
  date: string,
  originIata?: string,
): Promise<ACARSResult> {
  try {
    const summaryRaw = await fr24Fetch("/api/flight-summary/light", {
      flights: flightIdent,
      flight_datetime_from: `${date}T00:00:00Z`,
      flight_datetime_to: `${date}T23:59:59Z`,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("" + flightIdent + date);
      console.log(
        "[FR24] ── Step 1: flight-summary/light ──────────────────────",
      );
      console.dir(summaryRaw, { depth: null });
    }

    const summary = summaryRaw as FR24SummaryResponse | null;
    if (!summary?.data?.length) {
      return {
        times: null,
        scheduledHint: null,
        raw: summaryRaw,
        fr24FlightId: null,
        selectedIndex: null,
        totalLegs: 0,
        status: null,
      };
    }

    const data = summary.data;
    const candidates = originIata
      ? data.filter((f) => matchesOrigin(f, originIata))
      : data;
    const pool = candidates.length > 0 ? candidates : data;
    const leg = pool.find((f) => f.datetime_landed) ?? pool[0];
    const selectedIndex = data.indexOf(leg);

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[FR24] ${data.length} leg(s) — selected index=${selectedIndex}, fr24_id="${leg.fr24_id}", origin filter="${originIata ?? "any"}"`,
      );
    }

    const tail = leg.reg ?? null;
    const acType = mapAircraftType(leg.type);
    const origin =
      leg.orig_iata ??
      (leg.orig_icao?.length === 4 ? leg.orig_icao.slice(1) : leg.orig_icao) ??
      null;
    const dest =
      leg.dest_iata_actual ??
      leg.dest_iata ??
      (leg.dest_icao_actual?.length === 4
        ? leg.dest_icao_actual.slice(1)
        : leg.dest_icao_actual) ??
      (leg.dest_icao?.length === 4 ? leg.dest_icao.slice(1) : leg.dest_icao) ??
      null;

    const eventsRaw = await fr24Fetch("/api/historic/flight-events/light", {
      flight_ids: leg.fr24_id,
      event_types: "all",
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[FR24] ── Step 2: historic/flight-events/light ───────────────",
      );
      console.dir(eventsRaw, { depth: null });
    }

    const eventsResp = eventsRaw as FR24EventResponse | null;
    const events: FR24Event[] = eventsResp?.data?.[0]?.events ?? [];

    const gateDep = findEvent(events, "gate_departure");
    const takeoff = findEvent(events, "takeoff");
    const landed = findEvent(events, "landed");
    const gateArr = findEvent(events, "gate_arrival");
    const cruising = findEvent(events, "cruising");
    const descent = findEvent(events, "descent");

    // First / last seen across ALL events — used as OUT/IN fallback
    const sortedByTime = [...events].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const firstSeenUtc = sortedByTime[0]?.timestamp ?? null;
    const lastSeenUtc =
      sortedByTime[sortedByTime.length - 1]?.timestamp ?? null;

    const offUtc = takeoff?.timestamp ?? leg.datetime_takeoff ?? null;
    const onUtc = landed?.timestamp ?? leg.datetime_landed ?? null;
    // OUT: prefer gate departure → fallback to first tracked event
    const outUtc = gateDep?.timestamp ?? firstSeenUtc;
    // IN:  prefer gate arrival  → fallback to last tracked event
    const inUtc = gateArr?.timestamp ?? lastSeenUtc;

    const hasGateTimes = !!(gateDep?.timestamp || gateArr?.timestamp);
    const hasAirTimes = !!(offUtc || onUtc);
    const usedFirstLastFallback = !!(
      (!gateDep?.timestamp && firstSeenUtc) ||
      (!gateArr?.timestamp && lastSeenUtc)
    );

    const airspaceTransitions: AirspaceTransition[] = events
      .filter((e) => e.type === "airspace_transition")
      .map((e) => ({
        timestamp: e.timestamp,
        exited: e.details?.exited_airspace ?? null,
        exitedId: e.details?.exited_airspace_id ?? null,
        entered: e.details?.entered_airspace ?? null,
        enteredId: e.details?.entered_airspace_id ?? null,
      }));

    return {
      times:
        hasAirTimes || hasGateTimes
          ? {
              outUtc: hasGateTimes ? outUtc : null,
              offUtc,
              onUtc,
              inUtc: hasGateTimes ? inUtc : null,
              tailNumber: tail,
              aircraftType: acType,
              origin,
              destination: dest,
              departureGate: gateDep?.details?.gate_ident ?? null,
              arrivalGate: gateArr?.details?.gate_ident ?? null,
              departureRunway: takeoff?.details?.takeoff_runway ?? null,
              landingRunway: landed?.details?.landed_runway ?? null,
              cruiseGspeedKts: cruising?.gspeed ?? null,
              cruiseAltFt: cruising?.alt ?? null,
              descentStartUtc: descent?.timestamp ?? null,
              airspaceTransitions,
              gateTimesUnavailable: hasAirTimes && !hasGateTimes,
              usedFirstLastFallback,
            }
          : null,
      scheduledHint: null,
      raw: { summary: summaryRaw, events: eventsRaw },
      fr24FlightId: leg.fr24_id,
      selectedIndex,
      totalLegs: data.length,
      status: leg.status ?? null,
    };
  } catch (err) {
    console.error("[FR24] fetch error:", err);
    return {
      times: null,
      scheduledHint: null,
      raw: null,
      fr24FlightId: null,
      selectedIndex: null,
      totalLegs: 0,
      status: null,
    };
  }
}
