import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Copy, Link2, UserMinus } from "lucide-react";
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
import type { FundShareLink, ShareRole } from "../types";
import { Button, Card, ErrorNote, Spinner } from "../components/ui";

function linkStatus(link: FundShareLink): "active" | "revoked" | "expired" | "used_up" {
  if (link.revoked) return "revoked";
  if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
  if (link.max_uses != null && link.use_count >= link.max_uses) return "used_up";
  return "active";
}

function ShareLinkRow({
  link,
  fundId,
  highlight = false,
}: {
  link: FundShareLink;
  fundId: string;
  highlight?: boolean;
}) {
  const { t, lang } = useT();
  const revoke = useRevokeShareLink(fundId);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const status = linkStatus(link);
  const url = `${window.location.origin}/join/${link.token}`;

  // Scroll a freshly created link into view so it isn't missed at the
  // bottom of a long list; the highlight tint fades via the parent.
  useEffect(() => {
    if (highlight) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight]);

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
    <div
      ref={rowRef}
      className={`rounded-lg px-1 py-3 transition-colors duration-1000 ${
        highlight ? "bg-emerald-soft" : ""
      }`}
    >
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
              onClick={() => setConfirmingRevoke(true)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-spent hover:bg-spent/10"
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
      {confirmingRevoke && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs font-medium text-spent">{t.confirmRevokeLink}</p>
          <button
            onClick={() => revoke.mutate(link.id, { onSuccess: () => setConfirmingRevoke(false) })}
            disabled={revoke.isPending}
            className="shrink-0 rounded-lg bg-spent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {t.confirmYes}
          </button>
          <button
            onClick={() => setConfirmingRevoke(false)}
            className="shrink-0 text-xs text-muted hover:text-ink"
          >
            {t.cancel}
          </button>
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            link.role === "viewer" ? "bg-paper text-muted" : "bg-gold/10 text-gold"
          }`}
        >
          {link.role === "viewer" ? t.linkRoleViewer : t.linkRoleCollab}
        </span>
        <span>
          {t.usesLabel(link.use_count, link.max_uses)}
          {link.expires_at ? ` · ${t.expiresLabel(fmtDate(link.expires_at.slice(0, 10), lang))}` : ""}
        </span>
      </div>
    </div>
  );
}

function CreateLinkForm({
  fundId,
  onCreated,
}: {
  fundId: string;
  onCreated: (id: string) => void;
}) {
  const { t } = useT();
  const create = useCreateShareLink(fundId);
  const [role, setRole] = useState<ShareRole>("collaborator");

  function submit(e: FormEvent) {
    e.preventDefault();
    // Expiry/max-uses inputs are hidden for now — links are created
    // non-expiring and unlimited; the schema and hook still support both.
    create.mutate(
      { role, expiryDays: null, maxUses: null },
      { onSuccess: (data) => onCreated(data.id) },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex rounded-xl bg-paper p-1" role="tablist">
        {(["collaborator", "viewer"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
              role === r ? "bg-card text-emerald shadow-sm" : "text-muted"
            }`}
          >
            {r === "collaborator" ? t.linkRoleCollab : t.linkRoleViewer}
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-muted">
        {role === "collaborator" ? t.linkRoleCollabDesc : t.linkRoleViewerDesc}
      </p>
      <ErrorNote>{create.error?.message}</ErrorNote>
      <Button type="submit" disabled={create.isPending} className="w-full">
        {t.createLink}
      </Button>
    </form>
  );
}

function ShareLinksList({
  links,
  fundId,
  highlightId,
}: {
  links: FundShareLink[];
  fundId: string;
  highlightId: string | null;
}) {
  const { t } = useT();
  const [showInactive, setShowInactive] = useState(false);

  if (links.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
        <Link2 size={24} aria-hidden className="text-muted" />
        <p className="text-sm text-muted">{t.noLinks}</p>
      </div>
    );
  }

  // Dead links (revoked/expired/used up) are kept for reference but tucked
  // behind a disclosure so they don't clutter the list of usable links.
  const active = links.filter((l) => linkStatus(l) === "active");
  const inactive = links.filter((l) => linkStatus(l) !== "active");

  return (
    <div className="mt-2">
      {active.length > 0 ? (
        <div className="divide-y divide-line">
          {active.map((l) => (
            <ShareLinkRow key={l.id} link={l} fundId={fundId} highlight={l.id === highlightId} />
          ))}
        </div>
      ) : (
        <p className="py-3 text-sm text-muted">{t.noActiveLinks}</p>
      )}
      {inactive.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            aria-expanded={showInactive}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <ChevronDown
              size={14}
              aria-hidden
              className={`transition-transform ${showInactive ? "rotate-180" : ""}`}
            />
            {showInactive ? t.hideInactiveLinks : t.showInactiveLinks(inactive.length)}
          </button>
          {showInactive && (
            <div className="divide-y divide-line">
              {inactive.map((l) => (
                <ShareLinkRow key={l.id} link={l} fundId={fundId} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
                  m.role === "owner"
                    ? "bg-emerald-soft text-emerald"
                    : m.role === "viewer"
                      ? "bg-paper text-muted"
                      : "bg-gold/10 text-gold"
                }`}
              >
                {m.role === "owner" ? t.ownerBadge : m.role === "viewer" ? t.viewerBadge : t.collabBadge}
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
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  function handleCreated(linkId: string) {
    setHighlightId(linkId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2800);
  }

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
        <CreateLinkForm fundId={fund.id} onCreated={handleCreated} />
        {linksPending ? (
          <p className="py-2 text-sm text-muted">{t.loading}</p>
        ) : (
          <ShareLinksList links={links ?? []} fundId={fund.id} highlightId={highlightId} />
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t.members}</h2>
        <MembersList fundId={fund.id} />
      </Card>
    </div>
  );
}
