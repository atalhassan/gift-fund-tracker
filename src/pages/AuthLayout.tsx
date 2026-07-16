import type { ReactNode } from "react";
import { Check, Languages } from "lucide-react";
import { useT } from "../i18n";
import { Card } from "../components/ui";

export function AuthLayout({
  title,
  subtitle,
  onToggleLang,
  children,
}: {
  title: string;
  subtitle: string;
  onToggleLang: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* the gold thread from the original app's header */}
              <span aria-hidden className="h-0.5 w-5 shrink-0 bg-gold" />
              <h1 className="truncate text-xl font-bold text-emerald">{t.appName}</h1>
            </div>
            <p className="mt-1.5 text-sm font-medium text-ink/80">{t.appTagline}</p>
          </div>
          <button
            onClick={onToggleLang}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-emerald-soft hover:text-emerald"
          >
            <Languages size={16} aria-hidden />
            {t.langToggle}
          </button>
        </div>

        <ul className="mb-5 space-y-1.5">
          {[t.sellLog, t.sellShare, t.sellLeft].map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-muted">
              <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-emerald" />
              {line}
            </li>
          ))}
        </ul>

        <Card>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 mb-4 text-sm text-muted">{subtitle}</p>
          {children}
        </Card>
      </div>
    </div>
  );
}
