import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { normalizePhone, displayPhone } from "../phone";
import { toDigits } from "../format";
import { authErrorMessage } from "../authErrors";
import { useT } from "../i18n";
import { AuthLayout } from "./AuthLayout";
import { Button, ErrorNote, Field } from "../components/ui";

/** Mandatory gate reached (via RequirePhone) by signed-in accounts that have no
 * verified phone yet — i.e. existing email accounts, first sign-in after the
 * switch to phone-first. Attaches a phone with the same flow as Account:
 * updateUser({ phone }) sends the code, verifyOtp(type: "phone_change") confirms
 * it. Once user.phone is populated the Navigate below sends them to the
 * dashboard — always home, regardless of which route RequirePhone caught them
 * on (e.g. not back to /account, which they can't have visited yet anyway). */
export default function SetupPhone() {
  const { t, toggle } = useT();
  const { user } = useAuth();

  const [phoneRaw, setPhoneRaw] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already has a verified phone (or just verified one) — nothing to do here.
  if (user?.phone) return <Navigate to="/" replace />;

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const p = normalizePhone(phoneRaw);
    if (!p) {
      setError(t.invalidPhone);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ phone: p });
    if (error) setError(authErrorMessage(error, t));
    else setPending(p);
    setBusy(false);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // On success the session's user gains .phone; the Navigate above then fires.
    const { error } = await supabase.auth.verifyOtp({
      phone: pending!,
      token: code.trim(),
      type: "phone_change",
    });
    if (error) {
      setError(authErrorMessage(error, t));
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t.setupPhoneTitle} subtitle={t.setupPhoneSubtitle} onToggleLang={toggle}>
      {!pending ? (
        <form onSubmit={sendCode} className="space-y-4">
          <Field
            label={t.phoneLabel}
            type="tel"
            inputMode="tel"
            placeholder={t.phonePlaceholder}
            value={phoneRaw}
            onChange={(e) => setPhoneRaw(e.target.value)}
            autoComplete="tel"
            dir="ltr"
            required
          />
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" disabled={busy} className="w-full">
            {t.sendCode}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="rounded-xl bg-emerald-soft px-3.5 py-2.5 text-sm text-emerald">
            {t.codeSent} <span dir="ltr">{displayPhone(pending)}</span>
          </p>
          <Field
            label={t.codeLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(toDigits(e.target.value))}
            dir="ltr"
            required
          />
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" disabled={busy} className="w-full">
            {t.verifyCode}
          </Button>
          <button
            type="button"
            onClick={() => { setPending(null); setCode(""); setError(null); }}
            className="block w-full text-center text-sm text-muted hover:text-emerald"
          >
            {t.changeNumber}
          </button>
        </form>
      )}

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
