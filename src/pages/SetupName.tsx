import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth, useProfile } from "../auth";
import { useT } from "../i18n";
import { AuthLayout } from "./AuthLayout";
import { Button, ErrorNote, Field } from "../components/ui";

/** Mandatory gate (via RequireName) for accounts with no display name yet —
 * in practice, new phone signups: the profiles trigger no longer falls back
 * to the phone number, so it prompts here instead. Writes straight to
 * profiles.display_name (allowed by the profiles_update RLS policy); once set
 * the Navigate below sends them on to wherever RequireName caught them. */
export default function SetupName() {
  const { t, toggle } = useT();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoading && profile?.display_name) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", user!.id);
    if (error) {
      setError(t.errUnknown);
      setBusy(false);
    } else {
      qc.invalidateQueries({ queryKey: ["profile"] });
      navigate(from, { replace: true });
    }
  }

  return (
    <AuthLayout title={t.setupNameTitle} subtitle={t.setupNameSubtitle} onToggleLang={toggle}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label={t.nameLabel}
          placeholder={t.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" disabled={busy} className="w-full">
          {t.continueLabel}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-6 block w-full text-center text-sm text-muted hover:text-emerald"
      >
        {t.signOut}
      </button>
    </AuthLayout>
  );
}
