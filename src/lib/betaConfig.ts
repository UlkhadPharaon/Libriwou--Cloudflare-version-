/**
 * Beta Tester Demo Account Configuration
 * Centralizes the pre-configured shared demo account used for one-click beta access.
 *
 * Normal users -> Google OAuth (loginWithGoogle)
 * Beta testers -> One click -> loginAsBetaTesteur() -> shared Firebase email/password account
 *                 Company profile is auto-seeded if missing, so onboarding is skipped.
 */

// Env-overridable so you can rotate credentials without code change.
// Fallback defaults are intentional for local dev / first setup.
// For production you SHOULD set VITE_BETA_EMAIL / VITE_BETA_PASSWORD in Cloudflare/Netlify env.
export const BETA_EMAIL = (import.meta as any).env?.VITE_BETA_EMAIL || "beta@libriwouo.bf";
export const BETA_PASSWORD = (import.meta as any).env?.VITE_BETA_PASSWORD || "LibriwouoBeta2026!";

// Helper: is this Firebase User the beta demo account?
export function isBetaEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === BETA_EMAIL.toLowerCase() ||
    normalized === "beta@libriwouo.bf" ||
    normalized === "demo@libriwouo.bf" ||
    normalized === "beta.libriwouo@demo.local"
  );
}

// Pre-configured company used to auto-seed companies/{betaUid} on first beta login.
// This is what makes beta testers skip onboarding: hasProfile becomes true immediately.
export const BETA_COMPANY_TEMPLATE = {
  companyName: "Entreprise Démo Libriwouô SARL",
  ifu: "000123456A",
  rccm: "BF OUA 2024 B 1234",
  phone: "+226 70 00 00 00",
  email: BETA_EMAIL,
  address: "Koulouba, Ouagadougou, Burkina Faso",
  legalStatus: "SARL" as const,
  sector: "Commerce Général",
  estimatedRevenue: "25000000",
  // taxRegime is computed via determineTaxRegime(25_000_000) = RSI
  notificationSettings: { daysBefore: 7 },
} as const;

export const BETA_SEED_META = {
  isBetaDemo: true,
  betaSeedVersion: 1,
} as const;
