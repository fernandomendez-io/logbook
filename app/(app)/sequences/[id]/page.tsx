import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, decimalToHHMM } from "@/lib/utils/format";
import { FetchTimesButton } from "@/components/flights/fetch-times-button";
import { DeleteFlightButton } from "@/components/flights/delete-flight-button";
import { DeleteSequenceButton } from "@/components/sequences/delete-sequence-button";
import { utcDtToLocal, getTimezoneAbbr } from "@/lib/utils/timezone";

/** Return "HH:MM tz" local time for a UTC ISO string using the FA-stored timezone, or null. */
function fmtLocal(
  utcIso: string | null | undefined,
  tz: string | null | undefined,
): string | null {
  if (!utcIso || !tz) return null;
  const local = utcDtToLocal(utcIso.slice(0, 16), tz);
  if (!local) return null;
  return `${local.slice(11, 16)} ${getTimezoneAbbr(tz)}`;
}

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sequence } = await supabase
    .from("sequences")
    .select("*")
    .eq("id", id)
    .eq("pilot_id", user.id)
    .single();

  if (!sequence) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  const { data: flights } = await supabase
    .from("flights")
    .select("*")
    .eq("sequence_id", id)
    .order("scheduled_out_utc", { ascending: true });

  const totalScheduled =
    flights?.reduce((sum, f) => sum + (f.block_scheduled_hrs || 0), 0) || 0;
  const totalActual =
    flights?.reduce((sum, f) => sum + (f.block_actual_hrs || 0), 0) || 0;
  const flightCount =
    flights?.filter((f) => !f.is_cancelled && !f.is_deadhead).length || 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link
          href="/sequences"
          className="text-foreground/40 hover:text-foreground transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-green-primary font-mono">
            {sequence.sequence_number}
          </h1>
          <p className="text-sm text-foreground/50">
            {formatDate(sequence.report_date)} —{" "}
            {formatDate(sequence.release_date)}
          </p>
        </div>
        <Badge
          variant={sequence.status === "active" ? "green" : "gray"}
          className="ml-auto"
        >
          {sequence.status}
        </Badge>
        <DeleteSequenceButton
          sequenceId={sequence.id}
          flightCount={flightCount}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Flights", value: flightCount },
          {
            label: "Deadheads",
            value: flights?.filter((f) => f.is_deadhead).length || 0,
          },
          { label: "Sched Block", value: decimalToHHMM(totalScheduled) },
          {
            label: "Actual Block",
            value: totalActual > 0 ? decimalToHHMM(totalActual) : "—",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs text-foreground/40 uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-green-primary font-mono mt-1">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Flight table */}
      <Card>
        <CardHeader>
          <CardTitle>Flights</CardTitle>
          <Link href="/flights/new">
            <span className="text-xs text-green-primary hover:underline">
              + Add flight
            </span>
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                <th className="text-left pb-3 pr-4">Flight</th>
                <th className="text-left pb-3 pr-4">Route</th>
                <th className="text-left pb-3 pr-4">Skd Out</th>
                <th className="text-left pb-3 pr-4">Skd In</th>
                <th className="text-left pb-3 pr-4">Block</th>
                <th className="text-left pb-3 pr-4">A/C</th>
                <th className="text-left pb-3 pr-4">Approach</th>
                <th className="text-left pb-3">Status</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {flights?.map((flight) => {
                const f = flight as any;
                const skedOut = flight.scheduled_out_utc?.slice(11, 16) ?? null;
                const skedIn = flight.scheduled_in_utc?.slice(11, 16) ?? null;
                const actOut = fmtLocal(flight.actual_out_utc, f.origin_timezone);
                const actIn = fmtLocal(flight.actual_in_utc, f.dest_timezone);

                return (
                  <tr
                    key={flight.id}
                    className={
                      flight.is_cancelled
                        ? "opacity-40"
                        : "hover:bg-surface-raised"
                    }
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/flights/${flight.id}`}
                        className="font-mono font-medium text-green-primary hover:underline"
                      >
                        {flight.flight_number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-foreground/70">
                      {flight.origin_icao}–{flight.destination_icao}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {actOut
                        ? <span className="text-green-primary">{actOut}</span>
                        : skedOut
                        ? <span className="text-foreground/40">{skedOut}</span>
                        : <span className="text-foreground/20">—</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {actIn
                        ? <span className="text-green-primary">{actIn}</span>
                        : skedIn
                        ? <span className="text-foreground/40">{skedIn}</span>
                        : <span className="text-foreground/20">—</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {flight.block_actual_hrs ? (
                        decimalToHHMM(flight.block_actual_hrs)
                      ) : flight.block_scheduled_hrs ? (
                        <span className="text-foreground/40">
                          {decimalToHHMM(flight.block_scheduled_hrs)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {flight.aircraft_type ? (
                        <Badge variant="outline">{flight.aircraft_type}</Badge>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {flight.approach_type ? (
                        <Badge variant="green">{flight.approach_type}</Badge>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {flight.is_cancelled ? (
                        <Badge variant="red">CXL</Badge>
                      ) : flight.is_deadhead ? (
                        <Badge variant="blue">DH</Badge>
                      ) : flight.actual_in_utc ? (
                        <Badge variant="green">Done</Badge>
                      ) : (
                        <Badge variant="gray">Sched</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {!flight.is_cancelled && (
                          <FetchTimesButton
                            flightId={flight.id}
                            hasActualTimes={!!flight.actual_out_utc}
                            isAdmin={isAdmin}
                            hasFetchedData={!!(flight as any).fa_flight_id}
                          />
                        )}
                        <DeleteFlightButton flightId={flight.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Raw text */}
      <details className="group">
        <summary className="text-sm text-foreground/40 cursor-pointer hover:text-foreground/70 list-none flex items-center gap-2">
          <svg
            className="w-3 h-3 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
          Raw sequence text
        </summary>
        <pre className="mt-3 p-4 bg-surface rounded-lg text-xs font-mono text-foreground/50 overflow-x-auto whitespace-pre-wrap">
          {sequence.raw_text}
        </pre>
      </details>
    </div>
  );
}
