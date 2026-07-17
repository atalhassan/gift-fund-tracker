import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { Spinner } from "./ui";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { t } = useT();
  const location = useLocation();

  if (loading) return <Spinner label={t.loading} />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

/** Post-login gate for the phone-first migration: every account must have a
 * verified phone. New accounts get one at sign-up; existing email accounts are
 * sent to /setup-phone the first time they sign in. `user.phone` is only
 * populated once GoTrue has verified the number, so this is a real check. */
export function RequirePhone({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user?.phone) return <Navigate to="/setup-phone" replace state={{ from: location }} />;
  return <>{children}</>;
}
