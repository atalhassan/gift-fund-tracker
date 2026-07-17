import { useState } from "react";
import type { FormEvent } from "react";
import { ClipboardPaste, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { fmtDate, fmtMoney, sanitizeAmount } from "../format";
import { cleanMessage, extractAmount } from "../bankMessage";
import type { FundWithBalance } from "../hooks/funds";
import {
  NO_FILTERS,
  useAddTx,
  useDeleteTx,
  useTransactions,
  useUpdateTx,
} from "../hooks/transactions";
import type { TxFilters, TxInput, TxRow } from "../hooks/transactions";
import type { TxType } from "../types";
import { Button, Card, ErrorNote, Field, TextAreaField } from "./ui";

// ---------------------------------------------------------------------------
// Add form
// ---------------------------------------------------------------------------

function AddTxForm({ fund }: { fund: FundWithBalance }) {
  const { t } = useT();
  const addTx = useAddTx(fund.id);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [amountError, setAmountError] = useState(false);
  const [pasteNote, setPasteNote] = useState<"ok" | "noAmount" | "failed" | null>(null);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = parseFloat(amount);
    // The amount is checked here rather than by the browser: type=number would
    // enforce min=0.01 for us, but it also silently discards Arabic-Indic
    // digits, so the field is a text input now.
    setAmountError(!(value > 0));
    if (!(value > 0)) return;
    const input: TxInput = {
      type,
      amount: value,
      description: description.trim(),
    };
    // Optimistic: clear the fast-entry fields immediately.
    setAmount("");
    setDescription("");
    setPasteNote(null);
    addTx.mutate(input);
  }

  async function pasteBankMessage() {
    setPasteNote(null);
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setPasteNote("failed");
      return;
    }
    if (!text?.trim()) {
      setPasteNote("failed");
      return;
    }
    setDescription(cleanMessage(text));
    const value = extractAmount(text);
    if (value != null) {
      setAmount(String(value));
      setPasteNote("ok");
    } else {
      setPasteNote("noAmount");
    }
  }

  return (
    <Card>
      {fund.isOwner && (
        <div className="mb-4 flex rounded-xl bg-paper p-1">
          {(["expense", "credit"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setType(tab)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                type === tab
                  ? tab === "expense"
                    ? "bg-card text-spent shadow-sm"
                    : "bg-card text-emerald shadow-sm"
                  : "text-muted"
              }`}
            >
              {tab === "expense" ? t.tabSpend : t.tabCredit}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3.5">
        <button
          type="button"
          onClick={pasteBankMessage}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed
            border-line bg-paper/50 px-3 py-2.5 text-sm font-semibold text-muted transition-colors
            hover:border-emerald hover:text-emerald"
        >
          <ClipboardPaste size={16} aria-hidden />
          {t.paste}
        </button>
        {pasteNote === "ok" && (
          <p className="text-xs text-emerald">{t.detected}</p>
        )}
        {pasteNote === "noAmount" && (
          <p className="text-xs text-gold">{t.noAmountFound}</p>
        )}
        {pasteNote === "failed" && (
          <p className="text-xs text-gold">{t.pasteFailed}</p>
        )}

        {/* The amount is the point of the form: one big borderless figure with
            the currency trailing it, on a hairline rather than in a box. */}
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <input
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            inputMode="decimal"
            placeholder="0"
            dir="ltr"
            aria-label={t.amount}
            autoComplete="off"
            className="min-w-0 flex-1 border-none bg-transparent font-mono text-3xl font-semibold
              text-ink outline-none placeholder:text-muted/40 rtl:text-right"
          />
          <span className="shrink-0 font-mono text-sm text-muted">{fund.currency}</span>
        </div>

        <div className="flex items-end gap-3">
          <textarea
            rows={1}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === "credit" ? t.creditDescPlaceholder : t.descPlaceholder}
            maxLength={500}
            aria-label={t.txDesc}
            // Enter is a newline (notes run to several lines); ⌘/Ctrl+Enter records.
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-40 min-w-0 flex-1 resize-none border-none bg-transparent py-1.5
              text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted/60
              field-sizing-content"
          />
          <Button
            type="submit"
            disabled={addTx.isPending}
            tone={type === "expense" ? "spent" : "emerald"}
            className="flex shrink-0 items-center gap-1.5"
          >
            <Plus size={16} aria-hidden />
            {t.record}
          </Button>
        </div>
        {amountError && <ErrorNote>{t.invalidAmount}</ErrorNote>}
        <ErrorNote>{addTx.error?.message}</ErrorNote>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function FiltersRow({
  filters,
  onChange,
}: {
  filters: TxFilters;
  onChange: (f: TxFilters) => void;
}) {
  const { t } = useT();

  const chip = (value: TxFilters["type"], label: string) => (
    <button
      key={value}
      onClick={() => onChange({ ...filters, type: value })}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        filters.type === value
          ? "bg-emerald text-white"
          : "bg-paper text-muted hover:text-emerald"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {chip("all", t.filterAll)}
        {chip("expense", t.filterExpenses)}
        {chip("credit", t.filterCredits)}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          {t.fromDate}
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
            className="rounded-lg border border-line bg-paper/70 px-2 py-1 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5">
          {t.toDate}
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
            className="rounded-lg border border-line bg-paper/70 px-2 py-1 focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row (with inline edit + delete confirm)
// ---------------------------------------------------------------------------

function EditTxForm({ tx, fundId, onDone }: { tx: TxRow; fundId: string; onDone: () => void }) {
  const { t } = useT();
  const update = useUpdateTx(fundId);
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description ?? "");
  const [amountError, setAmountError] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    setAmountError(!(value > 0));
    if (!(value > 0)) return;
    update.mutate(
      { id: tx.id, amount: value, description: description.trim() },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 py-3">
      <Field
        label={t.amount}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
        dir="ltr"
        required
      />
      <TextAreaField label={t.txDesc} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      {amountError && <ErrorNote>{t.invalidAmount}</ErrorNote>}
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

function TxRowView({ tx, fund }: { tx: TxRow; fund: FundWithBalance }) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const deleteTx = useDeleteTx(fund.id);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const canModify = fund.isOwner || tx.created_by === user?.id;
  const isCredit = tx.type === "credit";
  const optimistic = tx.id.startsWith("optimistic-");

  if (editing) return <EditTxForm tx={tx} fundId={fund.id} onDone={() => setEditing(false)} />;

  return (
    <div className={`py-3 ${optimistic ? "opacity-60" : ""}`}>
      {/* Amount alone shares the first line with the description — the
          edit/delete buttons live on the meta line below, so a long bank
          message isn't squeezed into a sliver on narrow screens. */}
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-line break-words text-sm font-medium">
          {tx.description || (isCredit ? t.tabCredit : t.tabSpend)}
        </p>
        <span className={`shrink-0 font-mono text-sm font-bold ${isCredit ? "text-emerald" : "text-spent"}`}>
          {isCredit ? "+" : "−"}
          {fmtMoney(tx.amount, fund.currency, lang)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {fmtDate(tx.occurred_at, lang)}
          {tx.author?.display_name ? ` · ${t.byName(tx.author.display_name)}` : ""}
        </p>
        {canModify && !optimistic && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              aria-label={t.edit}
              className="rounded-lg p-1.5 text-muted hover:bg-emerald-soft hover:text-emerald"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setConfirming(true)}
              aria-label={t.deleteFund}
              className="rounded-lg p-1.5 text-muted hover:bg-spent/10 hover:text-spent"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {confirming && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs font-medium text-spent">{t.confirmDeleteTx}</p>
          <button
            onClick={() => deleteTx.mutate(tx.id)}
            disabled={deleteTx.isPending}
            className="rounded-lg bg-spent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {t.confirmYes}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-muted hover:text-ink">
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The whole section
// ---------------------------------------------------------------------------

export function Transactions({ fund }: { fund: FundWithBalance }) {
  const { t } = useT();
  const [filters, setFilters] = useState<TxFilters>(NO_FILTERS);
  const q = useTransactions(fund.id, filters);

  const rows = q.data?.pages.flat() ?? [];
  const filtered = filters !== NO_FILTERS;

  return (
    <>
      {/* Viewers are read-only; RLS blocks their writes anyway, so don't
          offer a form that could only fail. */}
      {!fund.isViewer && <AddTxForm fund={fund} />}
      <Card>
        <div className="mb-3 space-y-3">
          <h3 className="font-semibold">{t.history}</h3>
          <FiltersRow filters={filters} onChange={setFilters} />
        </div>
        <ErrorNote>{q.error?.message}</ErrorNote>
        {q.isPending ? (
          <p className="py-4 text-sm text-muted">{t.loading}</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted">
            {filtered ? t.noTxFiltered : fund.isViewer ? t.noTxViewer : t.noTx}
          </p>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((tx) => (
              <TxRowView key={tx.id} tx={tx} fund={fund} />
            ))}
          </div>
        )}
        {q.hasNextPage && (
          <button
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="mt-3 w-full rounded-xl border border-line py-2 text-sm font-medium text-emerald hover:bg-emerald-soft disabled:opacity-50"
          >
            {t.loadMore}
          </button>
        )}
      </Card>
    </>
  );
}
