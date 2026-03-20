import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchFlightAwareFlight, deriveFlightStats } from "@/lib/api/flightaware";
import { fetchAAGateTimes, stripCarrierPrefix } from "@/lib/api/aa";
import { prefixFlight, prefixFlightForSearch } from "@/lib/data/carriers";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const flightNumber = searchParams.get("flight");
  const date = searchParams.get("date");
  const origin = searchParams.get("origin")?.toUpperCase() || "";

  if (!flightNumber || !date) {
    return NextResponse.json(
      { error: "flight and date are required" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("operating_carrier")
    .eq("id", user.id)
    .single();

  const resolvedFlight = prefixFlight(flightNumber, profile?.operating_carrier);
  const searchFlight = prefixFlightForSearch(flightNumber, profile?.operating_carrier);

  const { data: cachedRaw } = await supabase
    .from("acars_cache")
    .select("*")
    .eq("flight_number", resolvedFlight)
    .eq("flight_date", date)
    .eq("origin_icao", origin)
    .single();

  const cached = cachedRaw as any;
  const numericFlight = stripCarrierPrefix(flightNumber);

  if (cached) {
    const aa = await fetchAAGateTimes(numericFlight, date);
    return NextResponse.json({
      outUtc: aa?.outUtc ?? cached.out_utc,
      offUtc: cached.off_utc,
      onUtc: cached.on_utc,
      inUtc: aa?.inUtc ?? cached.in_utc,
      tailNumber: cached.tail_number,
      aircraftType: cached.aircraft_type,
      origin: cached.origin_iata,
      destination: cached.dest_iata,
      departureGate: cached.departure_gate,
      arrivalGate: cached.arrival_gate,
      departureRunway: cached.departure_runway,
      landingRunway: cached.landing_runway,
      cruiseGspeedKts: cached.cruise_gspeed_kts,
      cruiseAltFt: cached.cruise_alt_ft,
      descentStartUtc: cached.descent_start_utc,
      faFlightId: cached.fa_flight_id,
      gateTimesUnavailable:
        !cached.out_utc && !cached.in_utc &&
        (!!cached.off_utc || !!cached.on_utc),
      source: "cache",
      resolvedFlight,
    });
  }

  // Fetch FlightAware and AA in parallel
  const [result, aa] = await Promise.all([
    fetchFlightAwareFlight(searchFlight, date, origin || undefined),
    fetchAAGateTimes(numericFlight, date),
  ]);
  const { times, raw, faFlightId, selectedIndex, totalLegs, status, track } = result;

  if (!times && !aa) {
    return NextResponse.json(
      { error: "Flight not found or no tracking data available", debug: { raw, totalLegs, origin, resolvedFlight, status } },
      { status: 404 },
    );
  }

  const mergedTimes = {
    ...(times ?? {}),
    outUtc: aa?.outUtc ?? times?.outUtc ?? null,
    inUtc:  aa?.inUtc  ?? times?.inUtc  ?? null,
  };

  // Derive stats from track for caching
  const stats = track.length >= 5 ? deriveFlightStats(track) : null
  const cruiseAltFt     = mergedTimes.cruiseAltFt     ?? stats?.cruiseAltFt     ?? null
  const cruiseGspeedKts = mergedTimes.cruiseGspeedKts ?? stats?.cruiseGspeedKts ?? null
  const descentStartUtc = mergedTimes.descentStartUtc ?? stats?.descentStartUtc ?? null

  await supabase.from("acars_cache").upsert(
    {
      flight_number:     resolvedFlight,
      flight_date:       date,
      origin_icao:       origin || mergedTimes.origin || "",
      out_utc:           mergedTimes.outUtc,
      off_utc:           mergedTimes.offUtc,
      on_utc:            mergedTimes.onUtc,
      in_utc:            mergedTimes.inUtc,
      tail_number:       mergedTimes.tailNumber,
      aircraft_type:     mergedTimes.aircraftType,
      origin_iata:       mergedTimes.origin,
      dest_iata:         mergedTimes.destination,
      departure_gate:    mergedTimes.departureGate    ?? null,
      arrival_gate:      mergedTimes.arrivalGate      ?? null,
      departure_runway:  mergedTimes.departureRunway  ?? null,
      landing_runway:    mergedTimes.landingRunway    ?? null,
      cruise_gspeed_kts: cruiseGspeedKts,
      cruise_alt_ft:     cruiseAltFt,
      descent_start_utc: descentStartUtc,
      fa_flight_id:      faFlightId,
      fa_track:          track.length > 0 ? track : null,
      raw_response:      raw as any,
    },
    { onConflict: "flight_number,flight_date,origin_icao" },
  );

  return NextResponse.json({
    ...mergedTimes,
    cruiseAltFt,
    cruiseGspeedKts,
    descentStartUtc,
    faFlightId,
    source: "live",
    debug: { selectedIndex, totalLegs },
  });
}
