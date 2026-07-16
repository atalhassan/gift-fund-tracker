import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { normalizePhone, displayPhone } from "../phone";
import { toDigits } from "../format";
import { authErrorMessage } from "../authErrors";
import { useT } from "../i18n";
import { AuthLayout } from "./AuthLayout";
import { Button, ErrorNote, Field } from "../components/ui";

/** The two sign-in methods, with a line spelling out what the selected one
 * actually does — the tabs alone left people guessing. */
export function MethodTabs({
  method,
  onChange,
  hint,
}: {
  method: "email" | "phone";
  onChange: (m: "email" | "phone") => void;
  hint: string;
}) {
  const { t } = useT();
  return (
    <>
      <div className="flex rounded-xl border border-line bg-paper/70 p-1" role="tablist">
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => onChange(m)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
              method === m ? "surface text-emerald shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {m === "email" ? t.emailTab : t.phoneTab}
          </button>
        ))}
      </div>
      <p className="mt-2 mb-4 text-xs text-muted">{hint}</p>
    </>
  );
}

export default function Login() {
  const { t, toggle } = useT();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  // Phone-first: it's the account type we're moving everyone to. Email stays
  // available for existing accounts.
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [magic, setMagic] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phone, setPhone] = useState<string | null>(null); // normalized, code stage
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  if (!loading && session) return <Navigate to={from} replace />;

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (magic) {
      // shouldCreateUser false: the magic link signs existing email accounts
      // in only — email is no longer a sign-up path (see Signup, phone-only).
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
      });
      if (error) setError(authErrorMessage(error, t));
      else setLinkSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(authErrorMessage(error, t));
      else navigate(from, { replace: true });
    }
    setBusy(false);
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const p = normalizePhone(phoneRaw);
    if (!p) {
      setError(t.invalidPhone);
      return;
    }
    setBusy(true);
    setError(null);
    // shouldCreateUser false: signing IN — unknown numbers get an error
    // instead of a ghost account (and no SMS is sent).
    const { error } = await supabase.auth.signInWithOtp({
      phone: p,
      options: { shouldCreateUser: false },
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
      navigate(from, { replace: true });
    }
  }

  return (
    <AuthLayout title={t.signIn} subtitle={t.signInSubtitle} onToggleLang={toggle}>
      {linkSent ? (
        <p className="text-emerald bg-emerald-soft rounded-xl px-3.5 py-2.5 text-sm">{t.linkSent}</p>
      ) : (
        <>
          <MethodTabs
            method={method}
            hint={method === "phone" ? t.phoneHint : magic ? t.magicHint : t.emailHint}
            onChange={(m) => {
              setMethod(m);
              setError(null);
              setPhone(null);
              setCode("");
            }}
          />

          {method === "email" && (
            <form onSubmit={submitEmail} className="space-y-4">
              <Field
                label={t.email}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                dir="ltr"
                required
              />
              {!magic && (
                <Field
                  label={t.password}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                  required
                />
              )}
              <ErrorNote>{error}</ErrorNote>
              <Button type="submit" disabled={busy} className="w-full">
                {magic ? t.sendLink : t.signIn}
              </Button>
              <button
                type="button"
                onClick={() => { setMagic(!magic); setError(null); }}
                className="block w-full rounded-xl border border-line py-2.5 text-center text-sm font-medium text-emerald hover:bg-emerald-soft"
              >
                {magic ? t.passwordMode : t.magicLinkMode}
              </button>
            </form>
          )}

          {method === "phone" && !phone && (
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
          )}

          {method === "phone" && phone && (
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
        </>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/signup" className="text-emerald font-medium hover:underline">
          {t.toSignup}
        </Link>
      </p>
    </AuthLayout>
  );
}
