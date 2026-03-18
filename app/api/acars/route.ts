import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchACARSTimes } from "@/lib/api/fr24";
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
  const searchFlight = prefixFlightForSearch(
    flightNumber,
    profile?.operating_carrier,
  );

  const { data: cachedRaw } = await supabase
    .from("acars_cache")
    .select("*")
    .eq("flight_number", resolvedFlight)
    .eq("flight_date", date)
    .eq("origin_icao", origin)
    .single();

  // Cast to any: generated types lag behind the 0004_fr24_fields migration
  const cached = cachedRaw as any;

  if (cached) {
    return NextResponse.json({
      outUtc: cached.out_utc,
      offUtc: cached.off_utc,
      onUtc: cached.on_utc,
      inUtc: cached.in_utc,
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
      airspaceTransitions: cached.airspace_transitions,
      fr24FlightId: cached.fr24_flight_id,
      gateTimesUnavailable:
        !cached.out_utc &&
        !cached.in_utc &&
        (!!cached.off_utc || !!cached.on_utc),
      source: "cache",
      resolvedFlight,
    });
  }

  const result = await fetchACARSTimes(searchFlight, date, origin || undefined);
  const { times, raw, fr24FlightId, selectedIndex, totalLegs, status } = result;

  if (!times) {
    return NextResponse.json(
      {
        error: "Flight not found or no tracking data available",
        debug: { raw, totalLegs, origin, resolvedFlight, status },
      },
      { status: 404 },
    );
  }

  await supabase.from("acars_cache").upsert(
    {
      flight_number: resolvedFlight,
      flight_date: date,
      origin_icao: origin || times.origin || "",
      out_utc: times.outUtc,
      off_utc: times.offUtc,
      on_utc: times.onUtc,
      in_utc: times.inUtc,
      tail_number: times.tailNumber,
      aircraft_type: times.aircraftType,
      origin_iata: times.origin,
      dest_iata: times.destination,
      departure_gate: times.departureGate ?? null,
      arrival_gate: times.arrivalGate ?? null,
      departure_runway: times.departureRunway ?? null,
      landing_runway: times.landingRunway ?? null,
      cruise_gspeed_kts: times.cruiseGspeedKts ?? null,
      cruise_alt_ft: times.cruiseAltFt ?? null,
      descent_start_utc: times.descentStartUtc ?? null,
      airspace_transitions: times.airspaceTransitions ?? [],
      fr24_flight_id: fr24FlightId,
      raw_response: raw as any,
    },
    { onConflict: "flight_number,flight_date,origin_icao" },
  );

  return NextResponse.json({
    ...times,
    fr24FlightId,
    source: "live",
    debug: { selectedIndex, totalLegs },
  });
}
