import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Eye, Link2, Share2, UserMinus, Wallet } from "lucide-react";
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
import { Button, Card, ErrorNote, Spinner } from "../components/ui";

function linkStatus(link: FundShareLink): "active" | "revoked" | "expired" | "used_up" {
  if (link.revoked) return "revoked";
  if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
  if (link.max_uses != null && link.use_count >= link.max_uses) return "used_up";
  return "active";
}

// The native share sheet ("Share via WhatsApp / Messages…") is the easiest
// path for non-technical users; it exists on phones but not most desktops.
const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

function ShareLinkRow({
  link,
  fundId,
  fundName,
  highlight = false,
}: {
  link: FundShareLink;
  fundId: string;
  fundName: string;
  highlight?: boolean;
}) {
  const { t } = useT();
  const revoke = useRevokeShareLink(fundId);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const url = `${window.location.origin}/join/${link.token}`;
  const isViewer = link.role === "viewer";
  const RoleIcon = isViewer ? Eye : Wallet;

  // Scroll a freshly created link into view so it isn't missed at the
  // bottom of the list; the highlight tint fades via the parent.
  useEffect(() => {
    if (highlight) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  return (
    <div
      ref={rowRef}
      data-share-url="active"
      className={`rounded-lg px-1 py-3 transition-colors duration-1000 ${
        highlight ? "bg-emerald-soft" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald"
        >
          <RoleIcon size={18} />
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
            isViewer ? "bg-paper text-muted" : "bg-gold/10 text-gold"
          }`}
        >
          {isViewer ? t.linkRoleViewer : t.linkRoleCollab}
        </span>
        <button
          onClick={() => setConfirmingRevoke(true)}
          className="ms-auto shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-spent hover:bg-spent/10"
        >
          {t.revoke}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
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
    </div>
  );
}

function CreateLinkForm({
  fundId,
  onCreated,
  collabTaken,
  viewerTaken,
}: {
  fundId: string;
  onCreated: (id: string) => void;
  collabTaken: boolean;
  viewerTaken: boolean;
}) {
  const { t } = useT();
  const create = useCreateShareLink(fundId);
  const [role, setRole] = useState<ShareRole>("collaborator");

  const bothTaken = collabTaken && viewerTaken;
  const isTaken = (r: ShareRole) => (r === "viewer" ? viewerTaken : collabTaken);

  // Only one active link per role. If the selected role already has one
  // (e.g. right after creating it), move the selection to the free role.
  useEffect(() => {
    if (isTaken(role) && !bothTaken) setRole(role === "viewer" ? "collaborator" : "viewer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabTaken, viewerTaken]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (isTaken(role)) return; // guard: never create a second link for a role
    // Expiry/max-uses inputs are hidden for now — links are created
    // non-expiring and unlimited; the schema and hook still support both.
    create.mutate(
      { role, expiryDays: null, maxUses: null },
      { onSuccess: (data) => onCreated(data.id) },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm font-medium text-ink">{t.linkAccessLabel}</p>
      <div role="radiogroup" aria-label={t.linkAccessLabel} className="grid gap-2">
        {(["collaborator", "viewer"] as const).map((r) => {
          const taken = isTaken(r);
          const selected = !taken && role === r;
          const Icon = r === "collaborator" ? Wallet : Eye;
          const label = r === "collaborator" ? t.linkRoleCollab : t.linkRoleViewer;
          const desc = r === "collaborator" ? t.linkRoleCollabDesc : t.linkRoleViewerDesc;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={taken}
              disabled={taken}
              onClick={() => !taken && setRole(r)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-start transition-colors ${
                taken
                  ? "cursor-not-allowed border-line opacity-60"
                  : selected
                    ? "border-emerald bg-emerald-soft"
                    : "border-line hover:border-emerald/40 hover:bg-paper/60"
              }`}
            >
              <Icon
                size={18}
                aria-hidden
                className={`mt-0.5 shrink-0 ${selected ? "text-emerald" : "text-muted"}`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${selected ? "text-emerald" : "text-ink"}`}>
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{desc}</span>
              </span>
              {taken ? (
                <span className="mt-0.5 shrink-0 text-xs font-medium text-muted">{t.linkExistsTag}</span>
              ) : (
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-emerald bg-emerald text-white" : "border-line"
                  }`}
                >
                  {selected && <Check size={11} strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <ErrorNote>{create.error?.message}</ErrorNote>
      {bothTaken ? (
        <p className="rounded-lg bg-paper px-3 py-2 text-xs text-muted">{t.bothLinksExist}</p>
      ) : (
        <Button type="submit" disabled={create.isPending} className="w-full">
          {t.createLink}
        </Button>
      )}
    </form>
  );
}

function ShareLinksList({
  activeLinks,
  fundId,
  fundName,
  highlightId,
}: {
  activeLinks: FundShareLink[];
  fundId: string;
  fundName: string;
  highlightId: string | null;
}) {
  const { t } = useT();

  // Revoked/expired links are never shown — the owner only sees links that
  // still work.
  if (activeLinks.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
        <Link2 size={24} aria-hidden className="text-muted" />
        <p className="text-sm text-muted">{t.noLinks}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 divide-y divide-line">
      {activeLinks.map((l) => (
        <ShareLinkRow
          key={l.id}
          link={l}
          fundId={fundId}
          fundName={fundName}
          highlight={l.id === highlightId}
        />
      ))}
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
        <CreateLinkForm
          fundId={fund.id}
          onCreated={handleCreated}
          collabTaken={activeLinks.some((l) => l.role === "collaborator")}
          viewerTaken={activeLinks.some((l) => l.role === "viewer")}
        />
        {linksPending ? (
          <p className="py-2 text-sm text-muted">{t.loading}</p>
        ) : (
          <ShareLinksList
            activeLinks={activeLinks}
            fundId={fund.id}
            fundName={fund.name}
            highlightId={highlightId}
          />
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t.members}</h2>
        <MembersList fundId={fund.id} />
      </Card>
    </div>
  );
}
