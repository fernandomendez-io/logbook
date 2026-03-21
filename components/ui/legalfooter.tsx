import Link from "next/link";

export default function LegalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full py-4 border-t border-emerald-900/5 mt-auto">
      {/* Changed justify-between to justify-center */}
      <div className="max-w-5xl mx-auto px-3 flex justify-center items-center">
        <div className="flex gap-6">
          <Link
            href="/terms"
            style={{ color: "var(--green-muted)" }}
            className="text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity underline decoration-emerald-900/10 underline-offset-4"
          >
            Terms
          </Link>
          <Link
            href="/policy"
            style={{ color: "var(--green-muted)" }}
            className="text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity underline decoration-emerald-900/10 underline-offset-4"
          >
            Privacy
          </Link>
          <a
            href="mailto:me@fernandomendez.io"
            style={{ color: "var(--green-muted)" }}
            className="text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
          >
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
