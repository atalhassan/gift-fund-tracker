import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, UserMinus } from "lucide-react";
import { useAuth } from "../auth";
import { useFund } from "../hooks/funds";
import {
  useCreateShareLink,
  useMembers,
  useRemoveMember,
  useRevokeShareLink,
  useShareLinks,
} from "../hooks/sharing";
import { useT } from "../i18n";
import { fmtDate } from "../format";
import type { FundShareLink } from "../types";
import { Button, Card, ErrorNote, Field, Spinner } from "../components/ui";

function linkStatus(link: FundShareLink): "active" | "revoked" | "expired" | "used_up" {
  if (link.revoked) return "revoked";
  if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
  if (link.max_uses != null && link.use_count >= link.max_uses) return "used_up";
  return "active";
}

function ShareLinkRow({ link, fundId }: { link: FundShareLink; fundId: string }) {
  const { t, lang } = useT();
  const revoke = useRevokeShareLink(fundId);
  const [copied, setCopied] = useState(false);
  const status = linkStatus(link);
  const url = `${window.location.origin}/join/${link.token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const badge = {
    revoked: ["bg-spent/10 text-spent", t.revokedBadge],
    expired: ["bg-paper text-muted", t.expiredBadge],
    used_up: ["bg-paper text-muted", t.usedUpBadge],
    active: null,
  }[status];

  return (
    <div className="py-3">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          dir="ltr"
          data-share-url={status === "active" ? "active" : status}
          onFocus={(e) => e.target.select()}
          className={`min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 font-mono text-xs ${
            status !== "active" ? "text-muted line-through" : ""
          }`}
        />
        {status === "active" ? (
          <>
            <button
              onClick={copy}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald hover:bg-emerald-soft"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? t.copied : t.copy}
            </button>
            <button
              onClick={() => revoke.mutate(link.id)}
              disabled={revoke.isPending}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-spent hover:bg-spent/10 disabled:opacity-50"
            >
              {t.revoke}
            </button>
          </>
        ) : (
          badge && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[0]}`}>
              {badge[1]}
            </span>
          )
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        {t.usesLabel(link.use_count, link.max_uses)}
        {link.expires_at ? ` · ${t.expiresLabel(fmtDate(link.expires_at.slice(0, 10), lang))}` : ""}
      </p>
    </div>
  );
}

function CreateLinkForm({ fundId }: { fundId: string }) {
  const { t } = useT();
  const create = useCreateShareLink(fundId);
  const [expiryDays, setExpiryDays] = useState("");
  const [maxUses, setMaxUses] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate({
      expiryDays: expiryDays ? parseInt(expiryDays, 10) : null,
      maxUses: maxUses ? parseInt(maxUses, 10) : null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t.expiryDays}
          type="number"
          min="1"
          step="1"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          dir="ltr"
        />
        <Field
          label={t.maxUses}
          type="number"
          min="1"
          step="1"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          dir="ltr"
        />
      </div>
      <ErrorNote>{create.error?.message}</ErrorNote>
      <Button type="submit" disabled={create.isPending} className="w-full">
        {t.createLink}
      </Button>
    </form>
  );
}

function MembersList({ fundId }: { fundId: string }) {
  const { t } = useT();
  const { user } = useAuth();
  const { data: members, isPending, error } = useMembers(fundId);
  const remove = useRemoveMember(fundId);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (isPending) return <p className="py-2 text-sm text-muted">{t.loading}</p>;
  if (error) return <ErrorNote>{t.errorLoading}</ErrorNote>;

  return (
    <div className="divide-y divide-line">
      {members.map((m) => (
        <div key={m.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.profile?.display_name || m.profile?.email || m.profile?.phone || m.user_id.slice(0, 8)}
                {m.user_id === user?.id && (
                  <span className="ms-1.5 text-xs font-normal text-muted">({t.youLabel})</span>
                )}
              </p>
              <p className="truncate text-xs text-muted" dir="ltr">
                {m.profile?.email || (m.profile?.phone ? `+${m.profile.phone}` : "")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.role === "owner" ? "bg-emerald-soft text-emerald" : "bg-gold/10 text-gold"
                }`}
              >
                {m.role === "owner" ? t.ownerBadge : t.collabBadge}
              </span>
              {m.role !== "owner" && (
                <button
                  onClick={() => setConfirming(m.id)}
                  aria-label={t.removeMember}
                  className="rounded-lg p-1.5 text-muted hover:bg-spent/10 hover:text-spent"
                >
                  <UserMinus size={15} />
                </button>
              )}
            </div>
          </div>
          {confirming === m.id && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs font-medium text-spent">{t.confirmRemoveMember}</p>
              <button
                onClick={() => remove.mutate(m.id, { onSuccess: () => setConfirming(null) })}
                disabled={remove.isPending}
                className="rounded-lg bg-spent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {t.confirmYes}
              </button>
              <button onClick={() => setConfirming(null)} className="text-xs text-muted hover:text-ink">
                {t.cancel}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Members() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const { data: fund, isPending } = useFund(id);
  const { data: links, isPending: linksPending } = useShareLinks(id!);

  if (isPending) return <Spinner label={t.loading} />;
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
  // Owner-only screen; collaborators get bounced back to the fund.
  if (!fund.isOwner) return <Navigate to={`/funds/${fund.id}`} replace />;

  return (
    <div className="space-y-4">
      <Link
        to={`/funds/${fund.id}`}
        className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-emerald"
      >
        <ArrowLeft size={16} aria-hidden className="rtl:rotate-180" />
        {fund.name}
      </Link>

      <Card>
        <h2 className="font-semibold">{t.shareLinks}</h2>
        <p className="mb-4 mt-1 text-xs text-muted">{t.linkHint}</p>
        <CreateLinkForm fundId={fund.id} />
        {linksPending ? (
          <p className="py-2 text-sm text-muted">{t.loading}</p>
        ) : links && links.length > 0 ? (
          <div className="mt-2 divide-y divide-line">
            {links.map((l) => (
              <ShareLinkRow key={l.id} link={l} fundId={fund.id} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">{t.noLinks}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t.members}</h2>
        <MembersList fundId={fund.id} />
      </Card>
    </div>
  );
}
