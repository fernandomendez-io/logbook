import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { decimalToHHMM, formatDate } from "@/lib/utils/format";
import { FetchTimesButton } from "@/components/flights/fetch-times-button";

const PAGE_SIZE = 50

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    aircraft?: string;
    approach?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  const hasFilters =
    params.start || params.end || params.aircraft || params.approach;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // ── Upcoming flights (future, ascending) — not shown when filters active ──
  const { data: upcomingFlights } = hasFilters
    ? { data: [] }
    : await supabase
        .from("flights")
        .select("*")
        .eq("pilot_id", user.id)
        .eq("is_cancelled", false)
        .gt("scheduled_out_utc", nowIso)
        .order("scheduled_out_utc", { ascending: true })
        .limit(30);

  // ── Past flights ──
  let query = supabase
    .from("flights")
    .select("*", { count: "exact" })
    .eq("pilot_id", user.id)
    .lte("scheduled_out_utc", nowIso)
    .order("scheduled_out_utc", { ascending: false })
    .range(from, to);

  if (params.start)
    query = query.gte("scheduled_out_utc", `${params.start}T00:00:00Z`);
  if (params.end)
    query = query.lte("scheduled_out_utc", `${params.end}T23:59:59Z`);
  if (params.aircraft)
    query = query.eq("aircraft_type", params.aircraft as "E170" | "E175");
  if (params.approach)
    query = query.eq(
      "approach_type",
      params.approach as
        | "visual"
        | "ILS"
        | "RNAV"
        | "RNP"
        | "VOR"
        | "NDB"
        | "LOC"
        | "other",
    );

  const { data: pastFlights, count } = await query;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Totals for past flights
  const totalFlightTime =
    pastFlights?.reduce((s, f) => s + (f.flight_time_hrs || 0), 0) || 0;
  const totalBlock =
    pastFlights?.reduce(
      (s, f) => s + (f.block_actual_hrs || f.block_scheduled_hrs || 0),
      0,
    ) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Flight Log</h1>
          <p className="text-sm text-foreground/50 mt-1">
            {count || 0} past entries
          </p>
        </div>
        <Link href="/flights/new">
          <Button>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Log Flight
          </Button>
        </Link>
      </div>

      {/* Upcoming flights */}
      {!hasFilters && (upcomingFlights?.length ?? 0) > 0 && (
        <Card className="p-0 overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-3 border-b border-border">
            <CardTitle>Upcoming</CardTitle>
            <span className="text-xs text-foreground/40">
              {upcomingFlights!.length} scheduled
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised">
                <tr className="text-xs text-foreground/40 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Flight</th>
                  <th className="text-left px-4 py-2.5">Route</th>
                  <th className="text-left px-4 py-2.5">Sched OUT</th>
                  <th className="text-left px-4 py-2.5">Sched IN</th>
                  <th className="text-left px-4 py-2.5">Block</th>
                  <th className="text-left px-4 py-2.5">A/C</th>
                  <th className="text-left px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {upcomingFlights!.map((f) => (
                  <tr
                    key={f.id}
                    className="hover:bg-surface-raised transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-foreground/50 font-mono whitespace-nowrap">
                      {formatDate(f.scheduled_out_utc)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/flights/${f.id}`}
                        className="font-mono text-green-primary hover:underline"
                      >
                        {f.flight_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground/70">
                      {f.origin_icao}–{f.destination_icao}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                      {new Date(f.scheduled_out_utc)
                        .toISOString()
                        .slice(11, 16)}
                      Z
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                      {new Date(f.scheduled_in_utc).toISOString().slice(11, 16)}
                      Z
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                      {f.block_scheduled_hrs
                        ? decimalToHHMM(f.block_scheduled_hrs)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.aircraft_type ? (
                        <Badge variant="outline">{f.aircraft_type}</Badge>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/flights/${f.id}/edit`}>
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:border-green-dim"
                          >
                            Edit
                          </Badge>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Past flights stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Flights",
            value:
              pastFlights?.filter((f) => !f.is_cancelled && !f.is_deadhead)
                .length || 0,
            unit: "",
          },
          {
            label: "Flight Time",
            value: decimalToHHMM(totalFlightTime),
            unit: "",
          },
          { label: "Block Time", value: decimalToHHMM(totalBlock), unit: "" },
          {
            label: "Instrument",
            value:
              pastFlights?.filter(
                (f) => f.approach_type && f.approach_type !== "visual",
              ).length || 0,
            unit: " appr.",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-green-primary font-mono">
              {stat.value}
              {stat.unit}
            </p>
          </Card>
        ))}
      </div>

      {/* Past flights table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-3 border-b border-border">
          <CardTitle>Past Flights</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised">
              <tr className="text-xs text-foreground/40 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Flight</th>
                <th className="text-left px-4 py-3">Route</th>
                <th className="text-left px-4 py-3">OUT</th>
                <th className="text-left px-4 py-3">IN</th>
                <th className="text-left px-4 py-3">Block</th>
                <th className="text-left px-4 py-3">Flight</th>
                <th className="text-left px-4 py-3">A/C</th>
                <th className="text-left px-4 py-3">PF</th>
                <th className="text-left px-4 py-3">Appr</th>
                <th className="text-left px-4 py-3">Rwy</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {pastFlights?.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-surface-raised transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs text-foreground/50 font-mono whitespace-nowrap">
                    {formatDate(f.scheduled_out_utc)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/flights/${f.id}`}
                      className="font-mono text-green-primary hover:underline"
                    >
                      {f.flight_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-foreground/70">
                    {f.origin_icao}–{f.destination_icao}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {f.actual_out_utc ? (
                      new Date(f.actual_out_utc).toISOString().slice(11, 16)
                    ) : (
                      <span className="text-foreground/30">
                        {new Date(f.scheduled_out_utc)
                          .toISOString()
                          .slice(11, 16)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {f.actual_in_utc ? (
                      new Date(f.actual_in_utc).toISOString().slice(11, 16)
                    ) : (
                      <span className="text-foreground/30">
                        {new Date(f.scheduled_in_utc)
                          .toISOString()
                          .slice(11, 16)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {f.block_actual_hrs ? (
                      decimalToHHMM(f.block_actual_hrs)
                    ) : f.block_scheduled_hrs ? (
                      <span className="text-foreground/40">
                        {decimalToHHMM(f.block_scheduled_hrs)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground/70">
                    {f.flight_time_hrs ? decimalToHHMM(f.flight_time_hrs) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.aircraft_type ? (
                      <Badge variant="outline">{f.aircraft_type}</Badge>
                    ) : (
                      <span className="text-foreground/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.pilot_flying ? (
                      <Badge
                        variant={f.pilot_flying === "CA" ? "blue" : "gray"}
                      >
                        {f.pilot_flying}
                      </Badge>
                    ) : (
                      <span className="text-foreground/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.approach_type ? (
                      <Badge
                        variant={
                          f.approach_type === "visual" ? "green" : "yellow"
                        }
                      >
                        {f.approach_type}
                      </Badge>
                    ) : (
                      <span className="text-foreground/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                    {f.approach_runway || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <FetchTimesButton
                      flightId={f.id}
                      hasActualTimes={!!f.actual_out_utc}
                    />
                  </td>
                </tr>
              ))}
              {!pastFlights?.length && (
                <tr>
                  <td
                    colSpan={12}
                    className="text-center py-16 text-foreground/40 text-sm"
                  >
                    No past flights.{" "}
                    <Link
                      href="/flights/new"
                      className="text-green-primary hover:underline"
                    >
                      Log your first flight
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => {
            const sp = new URLSearchParams();
            if (params.start) sp.set("start", params.start);
            if (params.end) sp.set("end", params.end);
            if (params.aircraft) sp.set("aircraft", params.aircraft);
            if (params.approach) sp.set("approach", params.approach);
            if (p > 1) sp.set("page", String(p));
            const qs = sp.toString();
            return `/flights${qs ? `?${qs}` : ""}`;
          }}
        />
      </Card>
    </div>
  );
}
