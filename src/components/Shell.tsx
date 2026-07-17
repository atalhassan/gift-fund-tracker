import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Languages, LogOut, UserRound } from "lucide-react";
import { supabase } from "../supabase";
import { PENDING_JOIN_KEY } from "../hooks/sharing";
import { useT } from "../i18n";

export function Shell() {
  const { t, toggle } = useT();
  const navigate = useNavigate();

  // A share token stashed while signed out (e.g. before an email-confirmation
  // round trip) gets redeemed as soon as the user lands anywhere signed in.
  useEffect(() => {
    const token = localStorage.getItem(PENDING_JOIN_KEY);
    if (token) navigate(`/join/${token}`, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-emerald">
            {t.appName}
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/account"
              aria-label={t.account}
              className="rounded-lg p-2 text-muted hover:bg-emerald-soft hover:text-emerald"
            >
              <UserRound size={16} aria-hidden />
            </Link>
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-emerald-soft hover:text-emerald"
            >
              <Languages size={16} aria-hidden />
              {t.langToggle}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-spent/10 hover:text-spent"
            >
              <LogOut size={16} aria-hidden />
              {t.signOut}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
