import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// Bilingual copy, same convention as the original app: every UI string has an
// en and an ar variant, and the layout follows the language's direction.

const en = {
  dir: "ltr" as "ltr" | "rtl",
  langToggle: "العربية",
  appName: "Fund Tracker",
  loading: "Loading…",

  // auth
  appTagline: "One shared fund, one clear balance.",
  sellLog: "Log expenses the moment they happen",
  sellShare: "Share a link so others can log spending too",
  sellLeft: "Always see what's left before you spend",
  signInSubtitle: "Welcome back — open your funds.",
  signUpSubtitle: "Takes a minute. We'll text you a code — no password to set up.",
  emailHint: "Sign in with your email and password.",
  emailSignupHint: "Create your account with an email and a password.",
  magicHint: "We'll email you a sign-in link — no password to remember.",
  phoneHint: "We'll text you a 6-digit code — no password needed.",
  phoneSignupHint: "We'll text you a 6-digit code to confirm your number.",
  signIn: "Sign in",
  signUp: "Create account",
  email: "Email",
  password: "Password",
  displayName: "Your name",
  magicLinkMode: "Email me a sign-in link instead",
  passwordMode: "Use a password instead",
  sendLink: "Send sign-in link",
  linkSent: "Check your email — your sign-in link is on the way.",
  confirmSent: "Almost there — confirm your email from the message we just sent, then sign in.",
  toSignup: "Need an account? Create one",
  toSignin: "Have an account? Sign in",
  signOut: "Sign out",

  // phone auth
  emailTab: "Email",
  phoneTab: "Phone",
  phoneLabel: "Phone number",
  phonePlaceholder: "05xxxxxxxx",
  sendCode: "Send code",
  codeLabel: "Verification code",
  codeSent: "We sent you a code by SMS.",
  verifyCode: "Verify",
  invalidPhone: "Enter a valid phone number.",
  changeNumber: "Use a different number",

  // auth failures (mapped from GoTrue error codes — see authErrors.ts)
  errPhoneTaken:
    "That number already belongs to another account. Sign in with it instead, or use a different number.",
  errEmailTaken: "That email already has an account. Sign in instead.",
  errInvalidCredentials: "Wrong email or password.",
  errOtpExpired: "That code has expired. Ask for a new one.",
  errRateLimit: "Too many attempts. Wait a minute and try again.",
  errWeakPassword: "Pick a longer password — at least 6 characters.",
  errValidation: "Check the details you entered and try again.",
  errUnknown: "Something went wrong. Try again in a moment.",

  // account
  account: "Account",
  phoneWord: "Phone",
  notSet: "Not set",
  phoneSectionHint: "Add a phone number to also sign in with SMS codes.",
  addPhone: "Add phone",
  changePhone: "Change phone",
  phoneVerified: "Phone verified — you can now sign in with it.",

  // mandatory phone-setup gate (email accounts, first sign-in after the switch)
  setupPhoneTitle: "Add your phone number",
  setupPhoneSubtitle: "We're switching to phone sign-in. Verify your number to keep access to your account.",

  // dashboard
  yourFunds: "Your funds",
  sharedFunds: "Shared with you",
  newFund: "New fund",
  noFundsTitle: "No funds yet",
  noFundsBody: "Create your first fund, or open a share link someone sent you.",
  createFirst: "Create a fund",
  ownerBadge: "Owner",
  collabBadge: "Can spend",
  viewerBadge: "View only",
  noActivity: "No activity yet",
  errorLoading: "Couldn't load your data.",
  retry: "Try again",

  // create / edit fund
  createFundTitle: "Create fund",
  fundName: "Fund name",
  fundDesc: "Description (optional)",
  currency: "Currency",
  create: "Create",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",

  // fund detail
  remaining: "Remaining",
  ofInitial: (pct: number, amount: string) => `${pct}% of the opening ${amount}`,
  lowFundHint: "Running low — add credit to this fund.",
  deleteFund: "Delete fund",
  confirmDeleteFund: "Delete this fund and all its transactions?",
  confirmYes: "Yes, delete",
  fundNotFound: "This fund doesn't exist, or you no longer have access to it.",
  backHome: "Back to funds",

  // transactions
  tabSpend: "Spend",
  tabCredit: "Add funds",
  amount: "Amount",
  txDesc: "Description (optional)",
  descPlaceholder: "On what? (e.g. portal service)",
  creditDescPlaceholder: "Where from? (e.g. another gift)",
  invalidAmount: "Enter an amount greater than zero.",
  record: "Record",
  history: "History",
  filterAll: "All",
  filterExpenses: "Expenses",
  filterCredits: "Credits",
  fromDate: "From",
  toDate: "To",
  noTx: "No transactions yet. Add your first above.",
  noTxViewer: "No transactions yet.",
  noTxFiltered: "No transactions match these filters.",
  loadMore: "Load more",
  confirmDeleteTx: "Delete this transaction?",
  byName: (name: string) => `by ${name}`,

  // sharing & members
  membersTitle: "Members & sharing",
  share: "Share",
  shareLinks: "Share links",
  linkHint:
    "Anyone who opens a link joins this fund with the access you choose. Links stay active until you revoke them.",
  linkAccessLabel: "Choose what people with this link can do",
  linkRoleCollab: "Can spend",
  linkRoleViewer: "View only",
  linkRoleCollabDesc: "They can log expenses and see the balance and all transactions.",
  linkRoleViewerDesc: "They can see the balance and transactions, but can't make any changes.",
  expiryDays: "Expires after (days, optional)",
  maxUses: "Max uses (optional)",
  createLink: "Create link",
  linkExistsTag: "Already created",
  bothLinksExist: "You've created both links. Revoke one to create a different one.",
  copy: "Copy",
  copied: "Copied!",
  copyLink: "Copy link",
  linkCopied: "Link copied!",
  shareLinkBtn: "Share link",
  shareInvite: (fund: string) => `Join "${fund}" on Fund Tracker`,
  revoke: "Revoke",
  confirmRevokeLink: "Revoke this link? Anyone holding it will no longer be able to join.",
  usesLabel: (n: number, max: number | null) =>
    max
      ? `${n} of ${max} used`
      : n === 0
        ? "No one has joined yet"
        : n === 1
          ? "1 person joined"
          : `${n} people joined`,
  noLinks: "No links yet. Create one to invite someone.",
  members: "Members",
  removeMember: "Remove",
  confirmRemoveMember: "Remove this member? They'll lose access to this fund.",
  youLabel: "you",
  joining: "Joining fund…",
  joinInvalid: "This share link is invalid or has expired.",
  backToFund: "Back to fund",

  switchFund: "Switch fund",

  // bank-message paste
  paste: "Paste bank message",
  detected: "Amount read from the message — edit if needed",
  noAmountFound: "Couldn't find an amount in the message — enter it manually.",
  pasteFailed: "Couldn't read the clipboard — paste the message into the description instead.",
};

export type Strings = typeof en;

const ar: Strings = {
  dir: "rtl",
  langToggle: "English",
  appName: "متتبع الأرصدة",
  loading: "جارٍ التحميل…",

  appTagline: "رصيد مشترك واحد، ورصيد واضح.",
  sellLog: "سجّل المصروفات لحظة حدوثها",
  sellShare: "شارك رابطاً ليسجّل غيرك المصروفات أيضاً",
  sellLeft: "اعرف المتبقّي دائماً قبل أن تصرف",
  signInSubtitle: "أهلاً بعودتك — افتح أرصدتك.",
  signUpSubtitle: "دقيقة واحدة. سنرسل لك رمزاً — بلا كلمة مرور تعدّها.",
  emailHint: "سجّل الدخول ببريدك وكلمة المرور.",
  emailSignupHint: "أنشئ حسابك ببريد إلكتروني وكلمة مرور.",
  magicHint: "سنرسل لك رابط دخول على بريدك — بلا كلمة مرور تحفظها.",
  phoneHint: "سنرسل لك رمزاً من ٦ أرقام — بلا كلمة مرور.",
  phoneSignupHint: "سنرسل لك رمزاً من ٦ أرقام لتأكيد رقمك.",
  signIn: "تسجيل الدخول",
  signUp: "إنشاء حساب",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  displayName: "اسمك",
  magicLinkMode: "أرسل لي رابط دخول بدلاً من ذلك",
  passwordMode: "استخدام كلمة المرور بدلاً من ذلك",
  sendLink: "إرسال رابط الدخول",
  linkSent: "تحقق من بريدك — رابط الدخول في الطريق.",
  confirmSent: "خطوة أخيرة — أكّد بريدك من الرسالة التي أرسلناها لك، ثم سجّل الدخول.",
  toSignup: "لا تملك حساباً؟ أنشئ واحداً",
  toSignin: "لديك حساب؟ سجّل الدخول",
  signOut: "تسجيل الخروج",

  emailTab: "البريد",
  phoneTab: "الجوال",
  phoneLabel: "رقم الجوال",
  phonePlaceholder: "05xxxxxxxx",
  sendCode: "إرسال الرمز",
  codeLabel: "رمز التحقق",
  codeSent: "أرسلنا لك رمزاً عبر رسالة نصية.",
  verifyCode: "تحقق",
  invalidPhone: "أدخل رقم جوال صحيحاً.",
  changeNumber: "استخدام رقم آخر",

  errPhoneTaken:
    "هذا الرقم مرتبط بحساب آخر. سجّل الدخول به، أو استخدم رقماً مختلفاً.",
  errEmailTaken: "هذا البريد له حساب بالفعل. سجّل الدخول بدلاً من ذلك.",
  errInvalidCredentials: "البريد أو كلمة المرور غير صحيحة.",
  errOtpExpired: "انتهت صلاحية الرمز. اطلب رمزاً جديداً.",
  errRateLimit: "محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.",
  errWeakPassword: "اختر كلمة مرور أطول — ٦ أحرف على الأقل.",
  errValidation: "تحقّق من البيانات التي أدخلتها وحاول مرة أخرى.",
  errUnknown: "حدث خطأ ما. حاول مرة أخرى بعد قليل.",

  account: "الحساب",
  phoneWord: "الجوال",
  notSet: "غير محدد",
  phoneSectionHint: "أضف رقم جوالك لتسجيل الدخول برمز نصي أيضاً.",
  addPhone: "إضافة الجوال",
  changePhone: "تغيير الجوال",
  phoneVerified: "تم توثيق الجوال — يمكنك الآن تسجيل الدخول به.",

  setupPhoneTitle: "أضف رقم جوالك",
  setupPhoneSubtitle: "ننتقل إلى تسجيل الدخول بالجوال. وثّق رقمك للحفاظ على الوصول إلى حسابك.",

  yourFunds: "أرصدتك",
  sharedFunds: "مشتركة معك",
  newFund: "رصيد جديد",
  noFundsTitle: "لا توجد أرصدة بعد",
  noFundsBody: "أنشئ أول رصيد لك، أو افتح رابط مشاركة أرسله لك أحدهم.",
  createFirst: "إنشاء رصيد",
  ownerBadge: "مالك",
  collabBadge: "يمكنه الصرف",
  viewerBadge: "عرض فقط",
  noActivity: "لا نشاط بعد",
  errorLoading: "تعذّر تحميل بياناتك.",
  retry: "حاول مرة أخرى",

  createFundTitle: "إنشاء رصيد",
  fundName: "اسم الرصيد",
  fundDesc: "الوصف (اختياري)",
  currency: "العملة",
  create: "إنشاء",
  save: "حفظ",
  cancel: "إلغاء",
  edit: "تعديل",

  remaining: "المتبقّي",
  ofInitial: (pct: number, amount: string) => `${pct}٪ من المبلغ الافتتاحي ${amount}`,
  lowFundHint: "الرصيد شارف على النفاد — أضف رصيداً.",
  deleteFund: "حذف الرصيد",
  confirmDeleteFund: "حذف هذا الرصيد وجميع معاملاته؟",
  confirmYes: "نعم، احذف",
  fundNotFound: "هذا الرصيد غير موجود، أو لم يعد لديك وصول إليه.",
  backHome: "العودة إلى الأرصدة",

  tabSpend: "صرف",
  tabCredit: "إضافة رصيد",
  amount: "المبلغ",
  txDesc: "الوصف (اختياري)",
  descPlaceholder: "على ماذا؟ (مثال: خدمة البوابة)",
  creditDescPlaceholder: "من أين؟ (مثال: هدية أخرى)",
  invalidAmount: "أدخل مبلغاً أكبر من صفر.",
  record: "تسجيل",
  history: "السجل",
  filterAll: "الكل",
  filterExpenses: "المصروفات",
  filterCredits: "الإضافات",
  fromDate: "من",
  toDate: "إلى",
  noTx: "لا توجد معاملات بعد. سجّل أول معاملة في الأعلى.",
  noTxViewer: "لا توجد معاملات بعد.",
  noTxFiltered: "لا توجد معاملات تطابق هذه التصفية.",
  loadMore: "عرض المزيد",
  confirmDeleteTx: "حذف هذه المعاملة؟",
  byName: (name: string) => `بواسطة ${name}`,

  membersTitle: "الأعضاء والمشاركة",
  share: "مشاركة",
  shareLinks: "روابط المشاركة",
  linkHint:
    "كل من يفتح الرابط ينضم إلى هذا الرصيد بالصلاحية التي تختارها. تبقى الروابط فعّالة حتى تلغيها.",
  linkAccessLabel: "اختر ما يمكن لحامل الرابط فعله",
  linkRoleCollab: "يمكنه الصرف",
  linkRoleViewer: "عرض فقط",
  linkRoleCollabDesc: "يمكنه تسجيل المصروفات والاطلاع على الرصيد وجميع الحركات.",
  linkRoleViewerDesc: "يمكنه الاطلاع على الرصيد والحركات فقط، دون إجراء أي تغيير.",
  expiryDays: "تنتهي بعد (أيام، اختياري)",
  maxUses: "أقصى عدد استخدامات (اختياري)",
  createLink: "إنشاء رابط",
  linkExistsTag: "موجود بالفعل",
  bothLinksExist: "لقد أنشأت كلا الرابطين. ألغِ أحدهما لإنشاء رابط مختلف.",
  copy: "نسخ",
  copied: "تم النسخ!",
  copyLink: "نسخ الرابط",
  linkCopied: "تم نسخ الرابط!",
  shareLinkBtn: "مشاركة الرابط",
  shareInvite: (fund: string) => `انضم إلى "${fund}" على متتبع الأرصدة`,
  revoke: "إلغاء",
  confirmRevokeLink: "إلغاء هذا الرابط؟ لن يتمكن أي شخص يملكه من الانضمام بعد الآن.",
  usesLabel: (n: number, max: number | null) =>
    max
      ? `${n} من ${max} مستخدم`
      : n === 0
        ? "لم ينضم أحد بعد"
        : n === 1
          ? "انضم شخص واحد"
          : n === 2
            ? "انضم شخصان"
            : `انضم ${n} أشخاص`,
  noLinks: "لا توجد روابط بعد. أنشئ واحداً لدعوة أحدهم.",
  members: "الأعضاء",
  removeMember: "إزالة",
  confirmRemoveMember: "إزالة هذا العضو؟ سيفقد الوصول إلى هذا الرصيد.",
  youLabel: "أنت",
  joining: "جارٍ الانضمام إلى الرصيد…",
  joinInvalid: "رابط المشاركة هذا غير صالح أو منتهي الصلاحية.",
  backToFund: "العودة إلى الرصيد",

  switchFund: "تبديل الرصيد",

  paste: "لصق رسالة البنك",
  detected: "تم استخراج المبلغ من الرسالة — عدّله إذا لزم",
  noAmountFound: "تعذّر العثور على مبلغ في الرسالة — أدخله يدوياً.",
  pasteFailed: "تعذّرت قراءة الحافظة — الصق الرسالة في الوصف بدلاً من ذلك.",
};

const STR = { en, ar };
export type Lang = keyof typeof STR;

type LangState = { lang: Lang; t: Strings; toggle: () => void };
const LangContext = createContext<LangState>({ lang: "en", t: en, toggle: () => {} });

function initialLang(): Lang {
  const saved = localStorage.getItem("lang");
  if (saved === "en" || saved === "ar") return saved;
  return navigator.language?.startsWith("ar") ? "ar" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = STR[lang].dir;
  }, [lang]);

  const toggle = () => setLang((l) => (l === "en" ? "ar" : "en"));

  return (
    <LangContext.Provider value={{ lang, t: STR[lang], toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  return useContext(LangContext);
}
