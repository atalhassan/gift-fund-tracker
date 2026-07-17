import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Eye, Plus, Share2, UserMinus, Wallet } from "lucide-react";
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
import type { FundShareLink, ShareRole } from "../types";
import { Card, ErrorNote, Spinner } from "../components/ui";

function linkStatus(link: FundShareLink): "active" | "revoked" | "expired" | "used_up" {
  if (link.revoked) return "revoked";
  if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
  if (link.max_uses != null && link.use_count >= link.max_uses) return "used_up";
  return "active";
}

// The native share sheet ("Share via WhatsApp / Messages…") is the easiest
// path for non-technical users; it exists on phones but not most desktops.
const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

// One card per role. The set of roles is fixed (Can spend / View only) and a
// fund holds at most one active link per role, so each card either shows the
// existing link's actions or an inline "Create link" — no separate form/list.
function RoleCard({
  role,
  fundId,
  fundName,
  link,
  highlight,
  onCreated,
}: {
  role: ShareRole;
  fundId: string;
  fundName: string;
  link?: FundShareLink;
  highlight: boolean;
  onCreated: (id: string) => void;
}) {
  const { t } = useT();
  const create = useCreateShareLink(fundId);
  const revoke = useRevokeShareLink(fundId);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isViewer = role === "viewer";
  const RoleIcon = isViewer ? Eye : Wallet;
  const label = isViewer ? t.linkRoleViewer : t.linkRoleCollab;
  const desc = isViewer ? t.linkRoleViewerDesc : t.linkRoleCollabDesc;
  const url = link ? `${window.location.origin}/join/${link.token}` : "";

  // Scroll a freshly created link into view; the highlight tint fades via the
  // parent clearing highlightId after a moment.
  useEffect(() => {
    if (highlight) cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await navigator.share({ text: t.shareInvite(fundName), url });
    } catch {
      // User dismissed the sheet, or the browser rejected it — nothing to do.
    }
  }

  function createLink() {
    // Expiry/max-uses are unused for now — links are created non-expiring and
    // unlimited; the schema and hook still support both.
    create.mutate(
      { role, expiryDays: null, maxUses: null },
      { onSuccess: (data) => onCreated(data.id) },
    );
  }

  return (
    <div
      ref={cardRef}
      data-role-card={role}
      data-share-url={link ? "active" : "none"}
      className={`rounded-xl border p-3 transition-colors duration-1000 ${
        highlight ? "border-emerald bg-emerald-soft" : "border-line"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald"
        >
          <RoleIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{label}</span>
          <span className="mt-0.5 block text-xs text-muted">{desc}</span>
        </div>
        {link && (
          <button
            onClick={() => setConfirmingRevoke(true)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-spent hover:bg-spent/10"
          >
            {t.revoke}
          </button>
        )}
      </div>

      {link ? (
        <>
          <div className="mt-3 flex gap-2">
            {canShare && (
              <button
                onClick={share}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-lit"
              >
                <Share2 size={16} aria-hidden />
                {t.shareLinkBtn}
              </button>
            )}
            <button
              onClick={copy}
              className={
                canShare
                  ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald/40 px-3 py-2.5 text-sm font-semibold text-emerald hover:bg-emerald-soft"
                  : "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-lit"
              }
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? t.linkCopied : t.copyLink}
            </button>
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
          <p className="mt-1.5 text-xs text-muted">{t.usesLabel(link.use_count, link.max_uses)}</p>
        </>
      ) : (
        <>
          <ErrorNote>{create.error?.message}</ErrorNote>
          <button
            onClick={createLink}
            disabled={create.isPending}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-lit disabled:opacity-50"
          >
            <Plus size={16} aria-hidden />
            {t.createLink}
          </button>
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
  const activeLinks = (links ?? []).filter((l) => linkStatus(l) === "active");
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
        {linksPending ? (
          <p className="py-2 text-sm text-muted">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {(["collaborator", "viewer"] as const).map((role) => {
              const link = activeLinks.find((l) => l.role === role);
              return (
                <RoleCard
                  key={role}
                  role={role}
                  fundId={fund.id}
                  fundName={fund.name}
                  link={link}
                  highlight={!!link && link.id === highlightId}
                  onCreated={handleCreated}
                />
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t.members}</h2>
        <MembersList fundId={fund.id} />
      </Card>
    </div>
  );
}
