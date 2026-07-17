import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Users } from "lucide-react";
import { useDeleteFund, useFund, useFunds, useUpdateFund } from "../hooks/funds";
import { Transactions } from "../components/Transactions";
import { useT } from "../i18n";
import { fmtMoney } from "../format";
import { Button, Card, ErrorNote, Field, Spinner } from "../components/ui";

function EditFundForm({
  id,
  name,
  description,
  onDone,
}: {
  id: string;
  name: string;
  description: string;
  onDone: () => void;
}) {
  const { t } = useT();
  const update = useUpdateFund(id);
  const [newName, setNewName] = useState(name);
  const [newDesc, setNewDesc] = useState(description);

  function submit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      { name: newName.trim(), description: newDesc.trim() },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        label={t.fundName}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        maxLength={80}
        required
        autoFocus
      />
      <Field
        label={t.fundDesc}
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
        maxLength={200}
      />
      <ErrorNote>{update.error?.message}</ErrorNote>
      <div className="flex gap-2">
        <Button type="submit" disabled={update.isPending}>
          {t.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

/** At or below this share of the opening amount the bar turns red — the fund
 * is close enough to empty that the owner should think about topping it up. */
const LOW_AT = 20;

/** A fuel gauge: full and green while the fund holds most of its opening
 * amount, draining downward as it's spent. Vertical so "empty" reads at a
 * glance without reading any number. */
function RemainingBar({ pct, low }: { pct: number; low: boolean }) {
  const { t } = useT();
  return (
    <div
      role="meter"
      aria-label={t.remaining}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative w-3.5 shrink-0 overflow-hidden rounded-full border border-line bg-paper/80 shadow-inner"
    >
      <div
        className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500 ${
          low ? "bg-[image:var(--grad-spent)]" : "bg-[image:var(--grad-emerald)]"
        }`}
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

function FundNav({ currentId }: { currentId: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { data: funds } = useFunds();

  const owned = funds?.filter((f) => f.isOwner) ?? [];
  const shared = funds?.filter((f) => !f.isOwner) ?? [];

  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted hover:text-emerald"
      >
        <ArrowLeft size={16} aria-hidden className="rtl:rotate-180" />
        {t.backHome}
      </Link>
      {funds && funds.length > 1 && (
        <select
          value={currentId}
          onChange={(e) => navigate(`/funds/${e.target.value}`)}
          aria-label={t.switchFund}
          className="min-w-0 max-w-[60%] rounded-xl border border-line bg-paper/70 px-3 py-1.5 text-sm font-medium text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/40"
        >
          {owned.length > 0 && (
            <optgroup label={t.yourFunds}>
              {owned.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          )}
          {shared.length > 0 && (
            <optgroup label={t.sharedFunds}>
              {shared.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
    </div>
  );
}

export default function FundDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { data: fund, isPending, error, refetch } = useFund(id);
  const deleteFund = useDeleteFund(id!);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
  if (!fund) {
    return (
      <Card className="text-center">
        <p className="text-sm text-muted">{t.fundNotFound}</p>
        <Link to="/" className="mt-3 inline-block text-sm font-semibold text-emerald hover:underline">
          {t.backHome}
        </Link>
      </Card>
    );
  }

  const b = fund.balance;
  const balance = b?.balance ?? 0;
  const initial = b?.initial_amount ?? 0;
  // Measured against the opening credit, not against every credit ever added,
  // so topping up a near-empty fund refills the bar instead of moving the
  // goalpost. A fund with no credit yet has nothing to measure against.
  const pct = initial > 0 ? Math.min(100, Math.max(0, (balance / initial) * 100)) : null;
  const low = pct !== null && pct <= LOW_AT;

  return (
    <div className="space-y-4">
      <FundNav currentId={fund.id} />
      <Card>
        {editing ? (
          <EditFundForm
            id={fund.id}
            name={fund.name}
            description={fund.description ?? ""}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{fund.name}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      fund.isOwner ? "bg-emerald-soft text-emerald" : "bg-gold/10 text-gold"
                    }`}
                  >
                    {fund.isOwner ? t.ownerBadge : fund.isViewer ? t.viewerBadge : t.collabBadge}
                  </span>
                </div>
                {fund.description && <p className="mt-1 text-sm text-muted">{fund.description}</p>}
              </div>
              {fund.isOwner && (
                <div className="flex shrink-0 items-center">
                  <Link
                    to={`/funds/${fund.id}/members`}
                    aria-label={t.share}
                    className="rounded-lg p-2 text-muted hover:bg-emerald-soft hover:text-emerald"
                  >
                    <Users size={16} />
                  </Link>
                  <button
                    onClick={() => setEditing(true)}
                    aria-label={t.edit}
                    className="rounded-lg p-2 text-muted hover:bg-emerald-soft hover:text-emerald"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-stretch gap-4 border-t border-line pt-4">
              {pct !== null && <RemainingBar pct={pct} low={low} />}
              <div className="min-w-0 py-1">
                <p className="text-xs text-muted">{t.remaining}</p>
                <p
                  className={`font-mono text-3xl font-bold ${
                    balance < 0 || low ? "text-spent" : "text-emerald"
                  }`}
                >
                  {fmtMoney(balance, fund.currency, lang)}
                </p>
                {pct !== null && (
                  <p className="mt-1 text-xs text-muted">
                    {t.ofInitial(Math.round(pct), fmtMoney(initial, fund.currency, lang))}
                  </p>
                )}
                {low && <p className="mt-2 text-xs font-semibold text-spent">{t.lowFundHint}</p>}
              </div>
            </div>
          </>
        )}
      </Card>

      <Transactions fund={fund} />

      {fund.isOwner && !editing && (
        <Card>
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t.confirmDeleteFund}</p>
              <ErrorNote>{deleteFund.error?.message}</ErrorNote>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    deleteFund.mutate(undefined, {
                      onSuccess: () => navigate("/", { replace: true }),
                    })
                  }
                  disabled={deleteFund.isPending}
                  className="rounded-xl bg-spent px-4 py-2.5 text-sm font-semibold text-white hover:bg-spent/90 disabled:opacity-50"
                >
                  {t.confirmYes}
                </button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  {t.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-spent hover:underline"
            >
              <Trash2 size={16} aria-hidden />
              {t.deleteFund}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
