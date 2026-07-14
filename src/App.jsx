import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Check, Pencil, X, LogOut, ClipboardPaste } from "lucide-react";
import { supabase } from "./supabase.js";

// ── Palette: a warm ledger book. Green ink for what remains, clay for what's gone,
//    a single gold thread marking the origin of the money.
const C = {
  paper: "#F6F3EC",
  card: "#FFFFFF",
  ink: "#1C2A23",
  emerald: "#0E6B4C",
  emeraldSoft: "#E4EFE9",
  gold: "#B08A3E",
  muted: "#71807A",
  spent: "#A8452F",
  line: "#E7E2D6",
};

const MONO = "'SF Mono', 'SFMono-Regular', 'Menlo', 'Consolas', monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

const STR = {
  en: {
    dir: "ltr",
    origin: "Gift from my mother",
    remaining: "Remaining",
    spent: "spent",
    of: "of",
    desc: "On what? (e.g. portal service)",
    add: "Record",
    empty: "No transactions yet. Add your first above.",
    count: (n) => `${n} transaction${n === 1 ? "" : "s"}`,
    signin: "Sign in",
    signup: "Create account",
    email: "Email",
    password: "Password",
    toSignup: "Need an account? Create one",
    toSignin: "Have an account? Sign in",
    signout: "Sign out",
    setupTitle: "Set up your fund",
    setupDesc: "Enter the amount you're starting with. You can change it anytime with the pencil.",
    setupCta: "Start tracking",
    detected: "Amount read from the message — edit if needed",
    paste: "Paste bank message",
    editTitle: "Edit fund title",
    titlePlaceholder: "Name this fund",
    tabSpend: "Spend",
    tabCredit: "Add funds",
    addCredit: "Add",
    creditDesc: "Where from? (e.g. another gift)",
    noCredit: "Added funds",
    credited: "added",
  },
  ar: {
    dir: "rtl",
    origin: "هدية من والدتي",
    remaining: "المتبقّي",
    spent: "المصروف",
    of: "من",
    desc: "على ماذا؟ (مثال: خدمة البوابة)",
    add: "تسجيل",
    empty: "لا توجد معاملات بعد. سجّل أول معاملة في الأعلى.",
    count: (n) => `${n} معاملة`,
    signin: "تسجيل الدخول",
    signup: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    toSignup: "لا تملك حساباً؟ أنشئ واحداً",
    toSignin: "لديك حساب؟ سجّل الدخول",
    signout: "تسجيل الخروج",
    setupTitle: "إعداد رصيدك",
    setupDesc: "أدخل المبلغ الذي تبدأ به. يمكنك تغييره لاحقاً بالقلم.",
    setupCta: "ابدأ التتبّع",
    detected: "تم استخراج المبلغ من الرسالة — عدّله إذا لزم",
    paste: "لصق رسالة البنك",
    editTitle: "تعديل عنوان الرصيد",
    titlePlaceholder: "سمِّ هذا الرصيد",
    tabSpend: "صرف",
    tabCredit: "إضافة رصيد",
    addCredit: "إضافة",
    creditDesc: "من أين؟ (مثال: هدية أخرى)",
    noCredit: "رصيد مُضاف",
    credited: "مُضاف",
  },
};

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

// Normalize Arabic-Indic digits/separators to Western so numbers parse.
const toWesternDigits = (s) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/٬/g, ""); // Arabic thousands separator

// Strip diacritics/tatweel and unify alef variants so keyword matching is robust.
const normalizeAr = (s) =>
  s
    .replace(/[ً-ْٰ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[آأإٱ]/g, "ا");

// A number like 1,540.09 — allows thousands commas and a decimal part.
const NUM = "([0-9][0-9,]*(?:\\.[0-9]+)?)";
// Riyal currency token as written across SMS variants: SAR, SR, ريال, ر.س.
const CUR = "(?:SAR|SR|ريال|ر\\.?\\s?س)";
const toNum = (m) => {
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// A riyal amount on a line, with the number on either side of the currency
// token: "4.51 SAR" or "SR 91.85". Foreign amounts (e.g. 350 EUR) don't match.
const riyalOnLine = (line) => {
  const before = toNum(line.match(new RegExp(NUM + "\\s*" + CUR, "i")));
  if (before != null) return before;
  return toNum(line.match(new RegExp(CUR + "\\s*" + NUM, "i")));
};

// Pull the riyal amount to deduct out of a bank purchase SMS.
// Priority: total amount due (incl. fees) → the "مبلغ" line → any other
// purchase line carrying a riyal amount. Balance ("رصيد"), fee ("رسوم") and
// exchange-rate ("سعر الصرف") lines are ignored so they can't be mistaken for
// the charge. Returns null when nothing confident is found.
function extractAmount(raw) {
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => normalizeAr(toWesternDigits(l)));

  // 1) إجمالي/اجمالي المبلغ المستحق — number after "المستحق" (always riyal).
  const dueLine = lines.find((l) => l.includes("المستحق"));
  if (dueLine) {
    const v = toNum(dueLine.match(new RegExp("المستحق[^0-9]*" + NUM)));
    if (v != null) return v;
  }

  // 2) The "مبلغ" line, when it carries a riyal amount (not a foreign one).
  const amtLine = lines.find((l) => l.includes("مبلغ"));
  if (amtLine) {
    const v = riyalOnLine(amtLine);
    if (v != null) return v;
  }

  // 3) Any remaining line with a riyal amount — e.g. "شراء … بـSR 91.85".
  for (const l of lines) {
    if (/رصيد|رسوم|سعر الصرف|المستحق|مبلغ/.test(l)) continue;
    const v = riyalOnLine(l);
    if (v != null) return v;
  }
  return null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [lang, setLang] = useState(
    () => localStorage.getItem("lang") || "en"
  );
  const t = STR[lang];

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) return <Screen center>…</Screen>;

  return session ? (
    <Tracker session={session} lang={lang} setLang={setLang} t={t} />
  ) : (
    <Auth lang={lang} setLang={setLang} t={t} />
  );
}

function Screen({ children, center }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: SANS,
        color: C.muted,
        display: center ? "flex" : "block",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <button
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      style={{
        border: `1px solid ${C.line}`,
        background: C.card,
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 12,
        color: C.ink,
        cursor: "pointer",
        fontFamily: SANS,
      }}
    >
      {lang === "en" ? "عربي" : "EN"}
    </button>
  );
}

function Auth({ lang, setLang, t }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setBusy(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password: pw })
        : await supabase.auth.signUp({
            email,
            password: pw,
            // Send the confirmation link back to whatever site we're on
            // (the deployed URL in production, localhost in dev) instead of
            // Supabase's default Site URL.
            options: { emailRedirectTo: window.location.origin },
          });
    if (error) setErr(error.message);
    setBusy(false);
  };

  return (
    <div
      dir={t.dir}
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: SANS,
        color: C.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ position: "absolute", top: 20, insetInlineEnd: 22 }}>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
        <span style={{ width: 22, height: 2, background: C.gold, display: "inline-block" }} />
        <span style={{ fontSize: 14, color: C.muted }}>{t.origin}</span>
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email}
          type="email"
          autoCapitalize="none"
          style={inputStyle}
        />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t.password}
          type="password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ ...inputStyle, marginTop: 10 }}
        />
        {err && (
          <div style={{ color: C.spent, fontSize: 13, marginTop: 10 }}>{err}</div>
        )}
        <button
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            marginTop: 14,
            border: "none",
            background: C.emerald,
            color: "#fff",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            fontFamily: SANS,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {mode === "signin" ? t.signin : t.signup}
        </button>
        <button
          onClick={() => {
            setErr("");
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          style={{
            width: "100%",
            marginTop: 12,
            border: "none",
            background: "transparent",
            color: C.muted,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: SANS,
          }}
        >
          {mode === "signin" ? t.toSignup : t.toSignin}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 15,
  fontFamily: SANS,
  color: C.ink,
  outline: "none",
  background: C.paper,
};

function Setup({ lang, setLang, t, onDone }) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = parseFloat(val);
    if (!v || v <= 0) return;
    setBusy(true);
    // user_id defaults to auth.uid() in Postgres, same as the transactions insert.
    const { error } = await supabase
      .from("fund_settings")
      .insert({ starting_balance: v });
    setBusy(false);
    if (!error) onDone(v);
  };

  return (
    <div
      dir={t.dir}
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: SANS,
        color: C.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ position: "absolute", top: 20, insetInlineEnd: 22 }}>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
        <span style={{ width: 22, height: 2, background: C.gold, display: "inline-block" }} />
        <span style={{ fontSize: 14, color: C.muted }}>{t.origin}</span>
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>{t.setupTitle}</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          {t.setupDesc}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            borderBottom: `1px solid ${C.line}`,
            paddingBottom: 10,
          }}
        >
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontFamily: MONO,
              fontSize: 30,
              fontWeight: 600,
              color: C.ink,
              background: "transparent",
              minWidth: 0,
              textAlign: t.dir === "rtl" ? "right" : "left",
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 14, color: C.muted }}>SAR</span>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            marginTop: 16,
            border: "none",
            background: C.emerald,
            color: "#fff",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            fontFamily: SANS,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {t.setupCta}
        </button>
      </div>
    </div>
  );
}

function Tracker({ session, lang, setLang, t }) {
  const [txs, setTxs] = useState([]);
  const [starting, setStarting] = useState(50000);
  const [title, setTitle] = useState(""); // custom fund title; empty → fall back to t.origin
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [entryKind, setEntryKind] = useState("expense"); // 'expense' | 'credit'
  const [autoFilled, setAutoFilled] = useState(""); // amount we auto-extracted, to avoid clobbering manual edits
  const [confirmId, setConfirmId] = useState(null);
  const [editStart, setEditStart] = useState(false);
  const [startDraft, setStartDraft] = useState("");
  const [editTitle, setEditTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const amountRef = useRef(null);
  const descRef = useRef(null);
  const userId = session.user.id;

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      setTxs(rows || []);

      const { data: s } = await supabase
        .from("fund_settings")
        .select("starting_balance, title")
        .maybeSingle();
      if (s) {
        setStarting(Number(s.starting_balance));
        setTitle(s.title || "");
      }
      else setNeedsSetup(true); // no row yet → first-time user, show setup screen
      setLoading(false);
    })();
  }, []);

  // Keep the note textarea sized to its content (handles typing and paste alike).
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [desc]);

  // Set the note and auto-fill the amount from it, without clobbering an
  // amount the user typed by hand.
  const applyDesc = (value) => {
    setDesc(value);
    const parsed = extractAmount(value);
    if (parsed != null) {
      const p = String(parsed);
      setAmount((cur) => (cur === "" || cur === autoFilled ? p : cur));
      setAutoFilled(p);
    }
  };

  const pasteMessage = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) applyDesc(text);
    } catch {
      // Clipboard read blocked/unsupported — focus so the user can paste manually.
    }
    descRef.current?.focus();
  };

  const addTx = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      amountRef.current?.focus();
      return;
    }
    const fallback =
      entryKind === "credit" ? t.noCredit : lang === "ar" ? "بدون وصف" : "No description";
    const description = desc.trim() || fallback;
    setAmount("");
    setDesc(""); // the [desc] effect collapses the grown textarea
    setAutoFilled("");
    amountRef.current?.focus();
    const { data, error } = await supabase
      .from("transactions")
      .insert({ amount: val, description, kind: entryKind })
      .select()
      .single();
    if (!error && data) setTxs((prev) => [data, ...prev]);
  };

  const removeTx = async (id) => {
    setConfirmId(null);
    setTxs((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("transactions").delete().eq("id", id);
  };

  const saveStart = async () => {
    const v = parseFloat(startDraft);
    setEditStart(false);
    if (v && v > 0) {
      setStarting(v);
      await supabase
        .from("fund_settings")
        .upsert({ user_id: userId, starting_balance: v }, { onConflict: "user_id" });
    }
  };

  const saveTitle = async () => {
    const next = titleDraft.trim();
    setEditTitle(false);
    setTitle(next);
    await supabase
      .from("fund_settings")
      .upsert({ user_id: userId, title: next || null }, { onConflict: "user_id" });
  };

  if (loading) return <Screen center>…</Screen>;

  if (needsSetup)
    return (
      <Setup
        lang={lang}
        setLang={setLang}
        t={t}
        onDone={(v) => {
          setStarting(v);
          setNeedsSetup(false);
        }}
      />
    );

  const totalSpent = txs.reduce((s, x) => (x.kind === "credit" ? s : s + Number(x.amount)), 0);
  const totalCredit = txs.reduce((s, x) => (x.kind === "credit" ? s + Number(x.amount) : s), 0);
  const totalFund = starting + totalCredit; // the base gift plus any credits added since
  const remaining = totalFund - totalSpent;
  // Vertical gauge shows what's left of the initial fund: full green when
  // healthy, emptying as the gift runs low (a signal to add credit).
  const pctRemaining = starting > 0 ? Math.min(100, Math.max(0, (remaining / starting) * 100)) : 0;
  const over = remaining < 0;

  const dateFmt = (iso) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      dir={t.dir}
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: SANS,
        color: C.ink,
        display: "flex",
        justifyContent: "center",
        padding: "0 0 40px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <div
          style={{
            padding: "20px 22px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 22, height: 2, background: C.gold, display: "inline-block", flexShrink: 0 }} />
            {editTitle ? (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder={t.titlePlaceholder}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") setEditTitle(false);
                  }}
                  style={{
                    fontSize: 13,
                    color: C.ink,
                    border: `1px solid ${C.line}`,
                    borderRadius: 6,
                    padding: "3px 7px",
                    outline: "none",
                    minWidth: 0,
                    width: 180,
                    maxWidth: "100%",
                    textAlign: t.dir === "rtl" ? "right" : "left",
                  }}
                />
                <Check size={15} color={C.emerald} style={{ cursor: "pointer", flexShrink: 0 }} onClick={saveTitle} />
                <X size={15} color={C.muted} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setEditTitle(false)} />
              </span>
            ) : (
              <span
                title={t.editTitle}
                onClick={() => {
                  setTitleDraft(title);
                  setEditTitle(true);
                }}
                style={{
                  display: "inline-flex",
                  gap: 5,
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: 13,
                  letterSpacing: 0.3,
                  color: C.muted,
                  minWidth: 0,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {title || t.origin}
                </span>
                <Pencil size={12} color={C.muted} style={{ flexShrink: 0 }} />
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <LangToggle lang={lang} setLang={setLang} />
            <LogOut
              size={18}
              color={C.muted}
              style={{ cursor: "pointer" }}
              onClick={() => supabase.auth.signOut()}
            />
          </div>
        </div>

        {/* Balance */}
        <div style={{ padding: "18px 22px 22px" }}>
         <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
          {/* Vertical fund gauge: full green = money left, empties as the fund runs low */}
          <div
            style={{
              position: "relative",
              width: 10,
              minHeight: 88,
              background: C.emeraldSoft,
              borderRadius: 5,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                insetInline: 0,
                bottom: 0,
                height: `${pctRemaining}%`,
                background: over ? C.spent : C.emerald,
                transition: "height .3s ease",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{t.remaining}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 44,
                fontWeight: 600,
                lineHeight: 1,
                color: over ? C.spent : C.emerald,
                letterSpacing: -1,
              }}
            >
              {fmt(remaining)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, color: C.muted }}>SAR</span>
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12.5,
              color: C.muted,
              fontFamily: MONO,
            }}
          >
            {editStart ? (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  value={startDraft}
                  onChange={(e) => setStartDraft(e.target.value)}
                  inputMode="decimal"
                  autoFocus
                  style={{
                    width: 80,
                    fontFamily: MONO,
                    fontSize: 12.5,
                    textAlign: "end",
                    border: `1px solid ${C.line}`,
                    borderRadius: 6,
                    padding: "2px 6px",
                  }}
                />
                <Check size={15} color={C.emerald} style={{ cursor: "pointer" }} onClick={saveStart} />
                <X size={15} color={C.muted} style={{ cursor: "pointer" }} onClick={() => setEditStart(false)} />
              </span>
            ) : (
              <span
                style={{ display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer" }}
                onClick={() => {
                  setStartDraft(String(starting));
                  setEditStart(true);
                }}
              >
                {t.of} {fmt(starting)}
                <Pencil size={12} color={C.muted} />
              </span>
            )}
          </div>
          </div>
         </div>
        </div>

        {/* Entry card */}
        <div
          style={{
            margin: "0 16px",
            background: C.card,
            borderRadius: 16,
            border: `1px solid ${C.line}`,
            padding: 14,
            boxShadow: "0 1px 2px rgba(28,42,35,.04)",
          }}
        >
          {/* Spend / Add-funds toggle */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 3,
              background: C.paper,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              marginBottom: 14,
            }}
          >
            {[
              { k: "expense", label: t.tabSpend },
              { k: "credit", label: t.tabCredit },
            ].map(({ k, label }) => {
              const active = entryKind === k;
              return (
                <button
                  key={k}
                  onClick={() => setEntryKind(k)}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 9,
                    padding: "8px 10px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: SANS,
                    cursor: "pointer",
                    background: active ? C.card : "transparent",
                    color: active ? (k === "credit" ? C.emerald : C.ink) : C.muted,
                    boxShadow: active ? "0 1px 2px rgba(28,42,35,.06)" : "none",
                    transition: "color .15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {entryKind === "expense" && (
            <button
              onClick={pasteMessage}
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: `1px dashed ${C.line}`,
                background: C.paper,
                color: C.muted,
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: SANS,
                marginBottom: 14,
              }}
            >
              <ClipboardPaste size={16} /> {t.paste}
            </button>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: `1px solid ${C.line}`,
              paddingBottom: 12,
              marginBottom: 12,
            }}
          >
            <input
              ref={amountRef}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              onKeyDown={(e) => e.key === "Enter" && addTx()}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontFamily: MONO,
                fontSize: 30,
                fontWeight: 600,
                color: C.ink,
                background: "transparent",
                minWidth: 0,
                textAlign: t.dir === "rtl" ? "right" : "left",
              }}
            />
            <span style={{ fontFamily: MONO, fontSize: 14, color: C.muted }}>SAR</span>
          </div>
          {amount !== "" && amount === autoFilled && (
            <div
              style={{
                fontSize: 12,
                color: C.emerald,
                marginTop: -4,
                marginBottom: 10,
              }}
            >
              {t.detected}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={descRef}
              value={desc}
              onChange={(e) => applyDesc(e.target.value)}
              placeholder={entryKind === "credit" ? t.creditDesc : t.desc}
              rows={1}
              onKeyDown={(e) => {
                // Enter adds a newline (multi-line notes); ⌘/Ctrl+Enter records.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  addTx();
                }
              }}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontFamily: SANS,
                fontSize: 15,
                lineHeight: 1.45,
                color: C.ink,
                background: "transparent",
                minWidth: 0,
                resize: "none",
                overflowY: "auto",
                maxHeight: 240,
                padding: 0,
              }}
            />
            <button
              onClick={addTx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "none",
                background: C.emerald,
                color: "#fff",
                borderRadius: 12,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: SANS,
                flexShrink: 0,
              }}
            >
              <Plus size={16} /> {entryKind === "credit" ? t.addCredit : t.add}
            </button>
          </div>
        </div>

        {/* Ledger list */}
        <div style={{ padding: "20px 22px 0" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontFamily: MONO }}>
            {t.count(txs.length)}
          </div>

          {txs.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 14, padding: "24px 0", textAlign: "center" }}>
              {t.empty}
            </div>
          ) : (
            txs.map((x) => (
              <div
                key={x.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "13px 0",
                  borderBottom: `1px solid ${C.line}`,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      color: C.ink,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {x.description}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, marginTop: 2 }}>
                    {dateFmt(x.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginInlineStart: 12 }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 15,
                      color: x.kind === "credit" ? C.emerald : C.spent,
                      fontWeight: 600,
                    }}
                  >
                    {x.kind === "credit" ? "+" : "−"}
                    {fmt(Number(x.amount))}
                  </span>
                  {confirmId === x.id ? (
                    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <Check size={17} color={C.spent} style={{ cursor: "pointer" }} onClick={() => removeTx(x.id)} />
                      <X size={17} color={C.muted} style={{ cursor: "pointer" }} onClick={() => setConfirmId(null)} />
                    </span>
                  ) : (
                    <Trash2
                      size={16}
                      color={C.muted}
                      style={{ cursor: "pointer", opacity: 0.6 }}
                      onClick={() => setConfirmId(x.id)}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
