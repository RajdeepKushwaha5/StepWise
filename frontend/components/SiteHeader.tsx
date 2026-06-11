import Link from "next/link";
import { BookOpenCheck, FileCheck2, FlaskConical, History, Network, Sigma } from "lucide-react";
import { GeminiMark, WolframMark } from "@/components/BrandMarks";
import { Wordmark } from "@/components/Wordmark";

type ActivePage = "tutor" | "practice" | "history" | "capabilities" | "architecture";

export function SiteHeader({
  active,
  showProofChips = false,
}: {
  active: ActivePage;
  showProofChips?: boolean;
}) {
  return (
    <header className="site-nav sticky top-0 z-30 print:hidden">
      <div className="mx-auto flex min-h-14 max-w-[1340px] flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-5 lg:px-8">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span className="hidden border-l border-line pl-4 text-[10px] uppercase text-faint sm:inline">evidence console</span>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Main navigation">
          <NavItem href="/" active={active === "tutor"}><Sigma size={13} /> Tutor</NavItem>
          <NavItem href="/practice" active={active === "practice"}><BookOpenCheck size={13} /> Practice</NavItem>
          <NavItem href="/history" active={active === "history"}><History size={13} /> History</NavItem>
          <NavItem href="/capabilities" active={active === "capabilities"}><FlaskConical size={13} /> Tool lab</NavItem>
          <NavItem href="/architecture" active={active === "architecture"}><Network size={13} /> Architecture</NavItem>
          {showProofChips && (
            <>
              <span className="proof-chip proof-chip-accent hidden lg:inline-flex"><WolframMark size={13} /> Wolfram computes</span>
              <span className="proof-chip hidden xl:inline-flex"><GeminiMark size={13} /> Gemini explains</span>
              <span className="proof-chip hidden 2xl:inline-flex"><FileCheck2 size={13} /> Provenance attached</span>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return <Link href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}>{children}</Link>;
}
