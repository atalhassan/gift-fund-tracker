import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { normalizePhone, displayPhone } from "../phone";
import { authErrorMessage } from "../authErrors";
import { useT } from "../i18n";
import { Button, Card, ErrorNote, Field } from "../components/ui";

/** Account page: shows the signed-in identity and lets an email user attach
 * (or change) a phone number so SMS sign-in reaches the same account.
 * updateUser({ phone }) sends the code; verifyOtp(type: "phone_change")
 * confirms it. */
export default function Account() {
  const { t } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [phoneRaw, setPhoneRaw] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const currentPhone = user?.phone || null;

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const p = normalizePhone(phoneRaw);
    if (!p) {
      setError(t.invalidPhone);
      return;
    }
    setBusy(true);
    setError(null);
    setVerified(false);
    const { error } = await supabase.auth.updateUser({ phone: p });
    if (error) setError(authErrorMessage(error, t));
    else setPending(p);
    setBusy(false);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: pending!,
      token: code.trim(),
      type: "phone_change",
    });
    if (error) {
      setError(authErrorMessage(error, t));
    } else {
      setPending(null);
      setCode("");
      setPhoneRaw("");
      setVerified(true);
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
    setBusy(false);
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{t.account}</h2>

      <div className="divide-y divide-line text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-muted">{t.email}</span>
          <span className="truncate" dir="ltr">{user?.email || t.notSet}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-muted">{t.phoneWord}</span>
          <span dir="ltr">{currentPhone ? displayPhone(currentPhone) : t.notSet}</span>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-3 text-xs text-muted">{t.phoneSectionHint}</p>

        {verified && (
          <p className="mb-3 rounded-xl bg-emerald-soft px-3.5 py-2.5 text-sm text-emerald">
            {t.phoneVerified}
          </p>
        )}

        {!pending ? (
          <form onSubmit={sendCode} className="space-y-3">
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
              {currentPhone ? t.changePhone : t.addPhone}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="rounded-xl bg-emerald-soft px-3.5 py-2.5 text-sm text-emerald">
              {t.codeSent} <span dir="ltr">{displayPhone(pending)}</span>
            </p>
            <Field
              label={t.codeLabel}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
              required
            />
            <ErrorNote>{error}</ErrorNote>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="flex-1">
                {t.verifyCode}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setPending(null); setCode(""); setError(null); }}
              >
                {t.changeNumber}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
