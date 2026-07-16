import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { PENDING_JOIN_KEY } from "../hooks/sharing";
import { useT } from "../i18n";
import { Card, Spinner } from "../components/ui";

/** /join/:token — redeem a share link.
 *
 * Signed in: call the redeem_share_link RPC and land inside the fund.
 * Signed out: stash the token (localStorage survives the email-confirmation
 * round trip, router state covers the plain sign-in return) and go to /login.
 */
export default function Join() {
  const { token } = useParams<{ token: string }>();
  const { session, loading } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || !session || !token || attempted.current) return;
    attempted.current = true;
    localStorage.removeItem(PENDING_JOIN_KEY);
    supabase.rpc("redeem_share_link", { link_token: token }).then(({ data, error }) => {
      if (error) setError(error.message);
      else {
        qc.invalidateQueries({ queryKey: ["funds"] });
        navigate(`/funds/${data}`, { replace: true });
      }
    });
  }, [loading, session, token, qc, navigate]);

  if (loading) return <Spinner label={t.loading} />;

  if (!session) {
    if (token) localStorage.setItem(PENDING_JOIN_KEY, token);
    return <Navigate to="/login" replace state={{ from: { pathname: `/join/${token}` } }} />;
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <p className="text-sm text-muted">{t.joinInvalid}</p>
          <Link to="/" className="mt-3 inline-block text-sm font-semibold text-emerald hover:underline">
            {t.backHome}
          </Link>
        </Card>
      </div>
    );
  }

  return <Spinner label={t.joining} />;
}
