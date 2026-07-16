import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { normalizePhone, displayPhone } from "../phone";
import { toDigits } from "../format";
import { authErrorMessage } from "../authErrors";
import { useT } from "../i18n";
import { AuthLayout } from "./AuthLayout";
import { Button, ErrorNote, Field } from "../components/ui";

/** Sign-up is phone-only: we're deprecating email accounts. Email sign-in still
 * works for existing users (see Login + the SetupPhone gate), but every new
 * account is created against a verified phone number. */
export default function Signup() {
  const { t, toggle } = useT();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const p = normalizePhone(phoneRaw);
    if (!p) {
      setError(t.invalidPhone);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      phone: p,
      options: {
        shouldCreateUser: true,
        data: { display_name: displayName.trim() },
      },
    });
    if (error) setError(authErrorMessage(error, t));
    else setPhone(p);
    setBusy(false);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: phone!,
      token: code.trim(),
      type: "sms",
    });
    if (error) {
      setError(authErrorMessage(error, t));
      setBusy(false);
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <AuthLayout title={t.signUp} subtitle={t.signUpSubtitle} onToggleLang={toggle}>
      <p className="mb-4 text-xs text-muted">{t.phoneSignupHint}</p>

      {!phone ? (
        <form onSubmit={sendCode} className="space-y-4">
          <Field
            label={t.displayName}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
          />
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
            {t.codeSent} <span dir="ltr">{displayPhone(phone)}</span>
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
            onClick={() => { setPhone(null); setCode(""); setError(null); }}
            className="block w-full text-center text-sm text-muted hover:text-emerald"
          >
            {t.changeNumber}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-emerald font-medium hover:underline">
          {t.toSignin}
        </Link>
      </p>
    </AuthLayout>
  );
}
