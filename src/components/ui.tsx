import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`surface border border-line rounded-2xl p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  tone = "emerald",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  tone?: "emerald" | "spent";
}) {
  // tone picks the gradient rather than a caller-supplied bg-* override: two
  // background-images at equal specificity resolve by stylesheet order, not
  // class order, so an override would be a coin flip.
  const styles =
    variant === "primary"
      ? `${tone === "spent" ? "bg-[image:var(--grad-spent)]" : "bg-[image:var(--grad-emerald)]"}
         text-white hover:brightness-110 disabled:opacity-50`
      : "text-emerald hover:bg-emerald-soft";
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-muted mb-1">{label}</span>
      <input
        className={`w-full rounded-xl border border-line bg-paper/70 px-3.5 py-2.5 text-ink
          placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald/40
          focus:border-emerald ${className}`}
        {...props}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-muted mb-1">{label}</span>
      <textarea
        rows={2}
        className={`w-full resize-y rounded-xl border border-line bg-paper/70 px-3.5 py-2.5 text-ink
          placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald/40
          focus:border-emerald ${className}`}
        {...props}
      />
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-spent bg-spent/5 border border-spent/20 rounded-xl px-3.5 py-2.5">
      {children}
    </p>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted text-sm">
      {label}
    </div>
  );
}
