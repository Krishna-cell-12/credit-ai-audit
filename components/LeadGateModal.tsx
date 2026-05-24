"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from "react";
import {
  ShieldCheck,
  X,
  Loader2,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadData {
  name: string;
  email: string;
  company: string;
}

interface LeadGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with validated lead data. May be async — throw to surface errors. */
  onSuccess: (data: LeadData) => void | Promise<void>;
}

interface FormFields {
  name: string;
  email: string;
  company: string;
}

interface FormErrors {
  name?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateForm(fields: FormFields): FormErrors {
  const errors: FormErrors = {};
  if (!fields.name.trim()) {
    errors.name = "Full name is required.";
  }
  if (!fields.email.trim()) {
    errors.email = "Business email is required.";
  } else if (!isValidEmail(fields.email)) {
    errors.email = "Please enter a valid email address.";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

const TRUST_POINTS = [
  "Zero spam — one-time report delivery only",
  "Never sold or shared with third parties",
  "Delete your data any time via email",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeadGateModal({
  isOpen,
  onClose,
  onSuccess,
}: LeadGateModalProps) {
  // ── Form state ──────────────────────────────────────────────────────────
  const [fields, setFields] = useState<FormFields>({
    name: "",
    email: "",
    company: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof FormFields, boolean>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Reset + focus when modal opens ─────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setFields({ name: "", email: "", company: "" });
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setIsDone(false);
      const id = setTimeout(() => firstInputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // ── Escape key ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    },
    [isSubmitting, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // ── Focus trap ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    dialog.addEventListener("keydown", trap);
    return () => dialog.removeEventListener("keydown", trap);
  }, [isOpen, isDone]);

  // ── Body scroll lock ────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ── Field handlers ──────────────────────────────────────────────────────
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));

    if (touched[name as keyof FormFields]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof FormErrors];
        return next;
      });
    }
  }

  function handleBlur(e: ChangeEvent<HTMLInputElement>) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldErrors = validateForm(fields);
    setErrors((prev) => ({
      ...prev,
      ...(fieldErrors[name as keyof FormErrors]
        ? { [name]: fieldErrors[name as keyof FormErrors] }
        : {}),
    }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ name: true, email: true });
    const fieldErrors = validateForm(fields);

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSuccess({
        name: fields.name.trim(),
        email: fields.email.trim().toLowerCase(),
        company: fields.company.trim(),
      });
      setIsDone(true);
    } catch {
      setErrors({ email: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render guard ────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // ── Input class builder ─────────────────────────────────────────────────
  function inputCls(field: keyof FormErrors) {
    const hasError = touched[field] && errors[field];
    return [
      "w-full rounded-xl border bg-slate-900/80 px-4 py-3 pl-11",
      "text-sm text-slate-100 placeholder-slate-600 outline-none ring-0",
      "transition-all duration-200",
      "disabled:cursor-not-allowed disabled:opacity-50",
      hasError
        ? "border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
        : "border-slate-700/80 hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
    ].join(" ");
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lgm-title"
      aria-describedby="lgm-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* ── Glassmorphic backdrop ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={() => !isSubmitting && onClose()}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
      />

      {/* ── Dialog panel ─────────────────────────────────────────────── */}
      <div
        ref={dialogRef}
        className={[
          "relative z-10 w-full max-w-md",
          "rounded-3xl border border-white/[0.07]",
          "bg-gradient-to-b from-slate-800/95 to-slate-900/98",
          "shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]",
          "backdrop-blur-2xl",
          "transition-all duration-300 ease-out",
        ].join(" ")}
      >
        {/* Top glow line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-px left-1/2 h-px w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent"
        />
        {/* Ambient glow blob */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl"
        />

        {/* ── Close button ─────────────────────────────────────────── */}
        {!isSubmitting && (
          <button
            id="lgm-close"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-150 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}

        <div className="p-7 sm:p-8">
          {/* ════════════════════════════════════════════════════════
              SUCCESS STATE
          ════════════════════════════════════════════════════════ */}
          {isDone ? (
            <div className="flex flex-col items-center py-8 text-center">
              {/* Animated check */}
              <div className="relative mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                  <CheckCircle2
                    size={32}
                    strokeWidth={1.5}
                    className="text-emerald-400"
                  />
                </div>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-2xl ring-1 ring-emerald-500/30 [animation-duration:2s]"
                />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                You&apos;re all set!
              </h2>
              <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-slate-400">
                Your full optimization report is now unlocked and loading below.
              </p>
              <button
                id="lgm-done-close"
                type="button"
                onClick={onClose}
                className="mt-6 rounded-xl bg-white/5 px-6 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                View Report →
              </button>
            </div>
          ) : (
            <>
              {/* ══════════════════════════════════════════════════════
                  ICON + HEADER
              ══════════════════════════════════════════════════════ */}
              <div className="mb-7 flex flex-col items-center text-center">
                {/* Shield icon with pulse ring */}
                <div className="relative mb-5">
                  <div className="flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-purple-500/10 ring-1 ring-white/10 shadow-inner">
                    <ShieldCheck
                      size={28}
                      strokeWidth={1.5}
                      className="text-indigo-400"
                    />
                  </div>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-2xl ring-1 ring-indigo-500/25 [animation-duration:2.6s]"
                  />
                </div>

                <h2
                  id="lgm-title"
                  className="bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-[1.35rem] font-extrabold leading-tight tracking-tight text-transparent"
                >
                  Unlock Your Full
                  <br />
                  Optimization Report
                </h2>

                <p
                  id="lgm-desc"
                  className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400"
                >
                  Your AI spend analysis is ready. Enter your details to access
                  your personalized savings breakdown — your data stays private.
                </p>
              </div>

              {/* ══════════════════════════════════════════════════════
                  FORM
              ══════════════════════════════════════════════════════ */}
              <form
                id="lead-gate-form"
                onSubmit={handleSubmit}
                noValidate
                className="space-y-4"
              >
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lgm-name"
                    className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Full Name{" "}
                    <span className="text-indigo-400" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className="relative">
                    <User
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      ref={firstInputRef}
                      id="lgm-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Smith"
                      value={fields.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                      aria-required="true"
                      aria-invalid={!!(touched.name && errors.name)}
                      aria-describedby={
                        touched.name && errors.name
                          ? "lgm-name-error"
                          : undefined
                      }
                      className={inputCls("name")}
                    />
                  </div>
                  {touched.name && errors.name && (
                    <p
                      id="lgm-name-error"
                      role="alert"
                      className="text-[11px] text-red-400"
                    >
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Business Email */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lgm-email"
                    className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Business Email{" "}
                    <span className="text-indigo-400" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className="relative">
                    <Mail
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      id="lgm-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="jane@company.com"
                      value={fields.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                      aria-required="true"
                      aria-invalid={!!(touched.email && errors.email)}
                      aria-describedby={
                        touched.email && errors.email
                          ? "lgm-email-error"
                          : undefined
                      }
                      className={inputCls("email")}
                    />
                  </div>
                  {touched.email && errors.email && (
                    <p
                      id="lgm-email-error"
                      role="alert"
                      className="text-[11px] text-red-400"
                    >
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Company Name (optional) */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lgm-company"
                    className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Company Name
                    <span className="rounded-full bg-slate-700/60 px-1.5 py-px text-[9px] font-normal normal-case tracking-normal text-slate-600">
                      optional
                    </span>
                  </label>
                  <div className="relative">
                    <Building2
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      id="lgm-company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      placeholder="Acme Corp"
                      value={fields.company}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className={[
                        "w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 pl-11",
                        "text-sm text-slate-100 placeholder-slate-600 outline-none ring-0",
                        "transition-all duration-200",
                        "hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      ].join(" ")}
                    />
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  id="lgm-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className={[
                    "group relative mt-2 w-full overflow-hidden rounded-xl",
                    "bg-gradient-to-r from-indigo-600 to-violet-600",
                    "px-6 py-3.5 text-sm font-semibold text-white",
                    "shadow-lg shadow-indigo-900/50",
                    "transition-all duration-200",
                    "hover:brightness-110 hover:shadow-indigo-700/60",
                    "active:scale-[0.98]",
                    "disabled:cursor-not-allowed disabled:opacity-60 disabled:brightness-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                  ].join(" ")}
                >
                  {/* Hover shine sweep */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full"
                  />

                  <span className="relative flex items-center justify-center gap-2.5">
                    {isSubmitting ? (
                      <>
                        <Loader2
                          size={15}
                          strokeWidth={2.5}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        <span>Unlocking Report…</span>
                      </>
                    ) : (
                      <>
                        <Lock
                          size={13}
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span>Unlock My Report</span>
                        <ArrowRight
                          size={13}
                          strokeWidth={2.5}
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* ══════════════════════════════════════════════════════
                  TRUST SIGNALS
              ══════════════════════════════════════════════════════ */}
              <div className="mt-5 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4">
                <div className="mb-2.5 flex items-center gap-1.5">
                  <Lock
                    size={10}
                    strokeWidth={2.5}
                    className="text-slate-600"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                    Privacy Guarantee
                  </span>
                </div>
                <ul className="space-y-1.5" aria-label="Privacy guarantees">
                  {TRUST_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <CheckCircle2
                        size={11}
                        strokeWidth={2}
                        className="mt-0.5 shrink-0 text-emerald-500/60"
                        aria-hidden="true"
                      />
                      <span className="text-xs leading-relaxed text-slate-500">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
