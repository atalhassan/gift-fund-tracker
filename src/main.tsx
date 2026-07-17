import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { LangProvider } from "./i18n";
import { AuthProvider } from "./auth";
import { RequireAuth, RequirePhone } from "./components/RequireAuth";
import { Shell } from "./components/Shell";
import Login from "./pages/Login";
import SetupPhone from "./pages/SetupPhone";
import Dashboard from "./pages/Dashboard";
import NewFund from "./pages/NewFund";
import FundDetail from "./pages/FundDetail";
import Members from "./pages/Members";
import Join from "./pages/Join";
import Account from "./pages/Account";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Sign-up merged into /login — phone entry creates the account. */}
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/join/:token" element={<Join />} />
              <Route
                element={
                  <RequireAuth>
                    <Outlet />
                  </RequireAuth>
                }
              >
                {/* Reachable while signed in but before a phone is verified —
                    must sit outside RequirePhone or the gate would loop. */}
                <Route path="/setup-phone" element={<SetupPhone />} />
                <Route
                  element={
                    <RequirePhone>
                      <Shell />
                    </RequirePhone>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="/funds/new" element={<NewFund />} />
                  <Route path="/funds/:id" element={<FundDetail />} />
                  <Route path="/funds/:id/members" element={<Members />} />
                  <Route path="/account" element={<Account />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>
);
