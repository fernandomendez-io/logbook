import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";

export default async function SequencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();

  const { data: sequences } = await supabase
    .from("sequences")
    .select("*")
    .eq("pilot_id", user.id)
    .order("report_date", { ascending: false })
    .limit(50);

  // Get flight counts separately
  const seqIds = sequences?.map((s) => s.id) || [];
  const { data: flightCounts } = seqIds.length
    ? await supabase
        .from("flights")
        .select("sequence_id, is_cancelled")
        .in("sequence_id", seqIds)
    : { data: [] };

  // A sequence is "upcoming" if its report date (first duty day) is today or later.
  // Using report_date is more reliable than release_date because a late-night release
  // often falls on the calendar day after the last flight.
  const today = nowIso.slice(0, 10);
  const upcoming = sequences?.filter((s) => s.report_date >= today) ?? [];
  const past = sequences?.filter((s) => s.report_date < today) ?? [];

  // Build a counts map for efficiency
  const countsMap: Record<string, { total: number; active: number }> = {};
  for (const f of flightCounts ?? []) {
    const seqId = f.sequence_id ?? "";
    if (!countsMap[seqId]) countsMap[seqId] = { total: 0, active: 0 };
    countsMap[seqId].total++;
    if (!f.is_cancelled) countsMap[seqId].active++;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sequences</h1>
          <p className="text-sm text-foreground/50 mt-1">
            {sequences?.length || 0} total
          </p>
        </div>
        <Link href="/sequences/new">
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
            Import Sequence
          </Button>
        </Link>
      </div>

      {!sequences?.length ? (
        <Card className="text-center py-16">
          <div className="w-12 h-12 bg-green-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-green-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <p className="text-foreground/50 text-sm mb-4">No sequences yet</p>
          <Link href="/sequences/new">
            <Button>Import your first sequence</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <CardTitle>Upcoming</CardTitle>
                <span className="text-xs text-foreground/40">
                  {upcoming.length} sequence{upcoming.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {upcoming.map((seq) => {
                  const c = countsMap[seq.id] ?? { active: 0 };
                  return (
                    <Link key={seq.id} href={`/sequences/${seq.id}`}>
                      <div className="bg-surface border border-border rounded-lg px-5 py-4 hover:border-green-dim transition-colors flex items-center gap-4">
                        <div className="font-mono font-bold text-green-primary text-lg w-20">
                          {seq.sequence_number}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {seq.domicile}
                            </span>
                            <span className="text-foreground/30">·</span>
                            <span className="text-sm text-foreground/60">
                              {formatDate(seq.report_date)} →{" "}
                              {formatDate(seq.release_date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="green">{c.active} legs</Badge>
                          <Badge
                            variant={
                              seq.status === "active" ? "outline" : "gray"
                            }
                          >
                            {seq.status}
                          </Badge>
                        </div>
                        <svg
                          className="w-4 h-4 text-foreground/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <CardTitle>Past</CardTitle>
                <span className="text-xs text-foreground/40">
                  {past.length} sequence{past.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {past.map((seq) => {
                  const c = countsMap[seq.id] ?? { active: 0 };
                  return (
                    <Link key={seq.id} href={`/sequences/${seq.id}`}>
                      <div className="bg-surface border border-border rounded-lg px-5 py-4 hover:border-green-dim transition-colors flex items-center gap-4">
                        <div className="font-mono font-bold text-green-primary text-lg w-20">
                          {seq.sequence_number}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {seq.domicile}
                            </span>
                            <span className="text-foreground/30">·</span>
                            <span className="text-sm text-foreground/60">
                              {formatDate(seq.report_date)} →{" "}
                              {formatDate(seq.release_date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="green">{c.active} legs</Badge>
                          <Badge
                            variant={
                              seq.status === "active" ? "outline" : "gray"
                            }
                          >
                            {seq.status}
                          </Badge>
                        </div>
                        <svg
                          className="w-4 h-4 text-foreground/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
