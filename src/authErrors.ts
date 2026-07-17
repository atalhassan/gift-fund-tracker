import type { AuthError } from "@supabase/supabase-js";
import type { Strings } from "./i18n";

/** GoTrue's own messages are English-only and describe the database rather than
 * the way out of it — "A user with this phone number has already been
 * registered" tells you nothing about signing in with that number instead.
 *
 * Matched on `code`, not on the message text: the wording is GoTrue's to change
 * and has churned across releases. Anything unmapped falls through to the
 * server's message, so a new failure mode is never swallowed silently. */
export function authErrorMessage(error: AuthError | null, t: Strings): string | null {
  if (!error) return null;
  switch (error.code) {
    case "phone_exists":
      return t.errPhoneTaken;
    case "email_exists":
    case "user_already_exists":
      return t.errEmailTaken;
    case "invalid_credentials":
      return t.errInvalidCredentials;
    case "otp_expired":
      return t.errOtpExpired;
    case "over_sms_send_rate_limit":
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t.errRateLimit;
    case "weak_password":
      return t.errWeakPassword;
    case "validation_failed":
      return t.errValidation;
    default: {
      // Pass GoTrue's own wording through — unmapped failures should still say
      // something — but not blindly: supabase-js falls back to
      // JSON.stringify(body) when it can't find a message in the reply, which
      // reaches the user as a literal "{}" (seen on a 500 from this very page).
      const msg = error.message?.trim();
      return msg && !msg.startsWith("{") ? msg : t.errUnknown;
    }
  }
}
