import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFunds } from "../hooks/funds";
import type { FundWithBalance } from "../hooks/funds";
import { useT } from "../i18n";
import { fmtMoney, fmtRelative } from "../format";
import { Card, ErrorNote, Spinner } from "../components/ui";

function FundCard({ fund }: { fund: FundWithBalance }) {
  const { t, lang } = useT();
  const balance = fund.balance?.balance ?? 0;
  return (
    <Link to={`/funds/${fund.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{fund.name}</h3>
            <p className="mt-0.5 text-xs text-muted">
              {fund.balance?.last_activity
                ? fmtRelative(fund.balance.last_activity, lang)
                : t.noActivity}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              fund.isOwner
                ? "bg-emerald-soft text-emerald"
                : fund.isViewer
                  ? "bg-paper text-muted"
                  : "bg-gold/10 text-gold"
            }`}
          >
            {fund.isOwner ? t.ownerBadge : fund.isViewer ? t.viewerBadge : t.collabBadge}
          </span>
        </div>
        <p className={`mt-3 font-mono text-2xl font-bold ${balance < 0 ? "text-spent" : "text-emerald"}`}>
          {fmtMoney(balance, fund.currency, lang)}
        </p>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { t } = useT();
  const { data: funds, isPending, error, refetch } = useFunds();

  if (isPending) return <Spinner label={t.loading} />;
  if (error) {
    return (
      <div className="space-y-3">
        <ErrorNote>{t.errorLoading}</ErrorNote>
        <button onClick={() => refetch()} className="text-sm font-medium text-emerald hover:underline">
          {t.retry}
        </button>
      </div>
    );
  }

  const sortByActivity = (a: FundWithBalance, b: FundWithBalance) =>
    (b.balance?.last_activity ?? b.created_at ?? "").localeCompare(
      a.balance?.last_activity ?? a.created_at ?? ""
    );
  const owned = funds.filter((f) => f.isOwner).sort(sortByActivity);
  const shared = funds.filter((f) => !f.isOwner).sort(sortByActivity);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.yourFunds}</h2>
        <Link
          to="/funds/new"
          className="flex items-center gap-1.5 rounded-xl bg-emerald px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald/90"
        >
          <Plus size={16} aria-hidden />
          {t.newFund}
        </Link>
      </div>

      {funds.length === 0 ? (
        <Card className="text-center">
          <h3 className="font-semibold">{t.noFundsTitle}</h3>
          <p className="mt-1 text-sm text-muted">{t.noFundsBody}</p>
          <Link to="/funds/new" className="mt-4 inline-block text-sm font-semibold text-emerald hover:underline">
            {t.createFirst}
          </Link>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {owned.map((f) => (
              <FundCard key={f.id} fund={f} />
            ))}
          </div>
          {shared.length > 0 && (
            <>
              <h2 className="pt-2 text-lg font-semibold">{t.sharedFunds}</h2>
              <div className="space-y-3">
                {shared.map((f) => (
                  <FundCard key={f.id} fund={f} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
