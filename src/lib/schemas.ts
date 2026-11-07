/**
 * Firestore input/output validation schemas (Phase 2.1).
 *
 * Goal: every document written to Firestore is validated with Zod BEFORE `setDoc` /
 * `addDoc`, so a malformed payload fails loudly in the console instead of silently
 * corrupting downstream tax calculations.
 *
 * RULES (from the master plan, Task 2.1):
 *  - Never throw on read paths. Existing documents that predate a schema must keep
 *    working, so every schema is either `.partial()`-tolerant or used through
 *    `safeParseWithoutThrow` below, which logs a warning and returns the data as-is.
 *  - No `any` in the exported types. Use `z.infer`.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** F CFA amounts. Must be a finite number (NaN/Infinity rejected). */
const moneySchema = z
  .number({ invalid_type_error: 'Le montant doit être un nombre' })
  .finite('Le montant doit être un nombre fini');

/** ISO date string YYYY-MM-DD (Firestore stores `date` as string in this app). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit être au format AAAA-MM-JJ');

export const taxRegimeSchema = z.enum(['CME', 'RSI', 'RNI', 'UNKNOWN']);

export const legalStatusSchema = z.enum([
  'SARL',
  'SA',
  'SAS',
  'EI',
  'SNC',
  'Association',
  'Coopérative',
  'Autre',
]);

export const notificationSettingsSchema = z.object({
  daysBefore: z.number().int().min(0).max(90),
  emailAlerts: z.boolean().optional(),
  smsAlerts: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// CompanyProfile — shape of `companies/{uid}`
// ---------------------------------------------------------------------------

export const companyProfileSchema = z.object({
  /** Always the authenticated uid. Enforced by Firestore rules too. */
  userId: z.string().min(1, 'userId est requis'),
  companyName: z
    .string()
    .trim()
    .min(2, 'Le nom de la société doit contenir au moins 2 caractères')
    .max(150, 'Le nom de la société ne peut pas dépasser 150 caractères'),
  ifu: z
    .string()
    .trim()
    .min(1, 'L\'IFU est requis')
    .max(50, 'L\'IFU ne peut pas dépasser 50 caractères'),
  rccm: z.string().trim().max(50, 'Le RCCM ne peut pas dépasser 50 caractères').optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  email: z.string().trim().email('Email invalide').max(120).optional().or(z.literal('')),
  address: z.string().trim().max(250).optional().default(''),
  legalStatus: legalStatusSchema.default('Autre'),
  sector: z
    .string()
    .trim()
    .min(1, 'Le secteur d\'activité est requis')
    .max(100, 'Le secteur ne peut pas dépasser 100 caractères'),
  /** Stored as a string in Firestore (legacy), e.g. "25000000". */
  estimatedRevenue: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === null ? '' : String(v)))
    .pipe(z.string().max(30)),
  taxRegime: taxRegimeSchema.optional(),
  currency: z.string().max(8).optional().default('XOF'),
  exchangeRate: z.number().positive().optional().default(1),
  aiCompanionName: z.string().max(60).optional(),
  notificationSettings: notificationSettingsSchema.default({ daysBefore: 7 }),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

/**
 * Strict variant for onboarding/profile writes: this is the one that must fail
 * loudly when `companyName` or `ifu` is missing (acceptance criterion 2.2).
 */
export const companyProfileWriteSchema = companyProfileSchema.refine(
  (data) => data.companyName.length >= 2,
  { message: 'Le nom de la société est obligatoire', path: ['companyName'] }
);

// ---------------------------------------------------------------------------
// Transaction — shape of `transactions/{id}`
// ---------------------------------------------------------------------------

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE', 'PAYROLL', 'PROPOSED']);

export const transactionSchema = z.object({
  userId: z.string().min(1, 'userId est requis'),
  type: transactionTypeSchema.default('EXPENSE'),
  date: isoDateSchema,
  /** Gross amount excluding VAT, in F CFA. */
  amountExclTax: moneySchema,
  amountInclTax: moneySchema.optional(),
  tvaAmount: moneySchema.optional().default(0),
  vatAmount: moneySchema.optional().default(0),
  vendorName: z.string().trim().max(150).optional().default(''),
  category: z.string().trim().max(80).optional().default(''),
  description: z.string().trim().max(1000).optional().default(''),
  syscohadaCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z.\- ]{0,20}$/, 'Code SYSCOHADA invalide')
    .optional()
    .or(z.literal('')),
  fecFingerprint: z.string().trim().max(120).optional(),
  fecValid: z.boolean().optional().default(false),
  fraudSuspected: z.boolean().optional(),
  fraudReason: z.string().max(300).optional(),
  paymentMethod: z.string().max(40).optional(),
  currency: z.string().max(8).optional().default('XOF'),
  exchangeRate: z.number().positive().optional().default(1),
  /** Original amount before currency conversion (multi-currency support). */
  originalAmountExclTax: moneySchema.optional(),
  originalAmountInclTax: moneySchema.optional(),
  lineItems: z.array(z.record(z.unknown())).max(500).optional(),
  invoiceData: z.record(z.unknown()).optional(),
  status: z.string().max(30).optional().default('validated'),
  source: z.string().max(40).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/**
 * Bank imports can produce rows with a 0 amount, which must be filtered before
 * the strict schema runs (see BankPage). Use this for the manual "catégoriser
 * sans facture" flow that writes an absolute value.
 */
export const bankTransactionSchema = transactionSchema
  .omit({ date: true })
  .extend({
    date: isoDateSchema,
    source: z.literal('BANK_IMPORT'),
  });

// ---------------------------------------------------------------------------
// IntelligenceNews — shape of `intelligence_feed/{id}`
// ---------------------------------------------------------------------------

export const intelligenceCategorySchema = z.enum(['FISCAL', 'OPPORTUNITY', 'MARKET', 'TECH']);

export const intelligenceNewsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, 'Le titre doit contenir au moins 4 caractères')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
  excerpt: z
    .string()
    .trim()
    .min(10, 'Le résumé doit contenir au moins 10 caractères')
    .max(600, 'Le résumé ne peut pas dépasser 600 caractères'),
  category: intelligenceCategorySchema.default('MARKET'),
  date: isoDateSchema,
  url: z
    .string()
    .url('URL invalide')
    .or(z.literal(''))
    .optional()
    .default(''),
  targetSectors: z
    .array(z.string().trim().min(1).max(60))
    .max(12)
    .default(['GLOBAL']),
  createdAt: z.any().optional(),
});

export type IntelligenceNews = z.infer<typeof intelligenceNewsSchema>;

// ---------------------------------------------------------------------------
// Conversation / Hub chat history
// ---------------------------------------------------------------------------

export const chatRoleSchema = z.enum(['user', 'assistant', 'system']);

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string().max(20000),
  timestamp: z.number().optional(),
});

export const conversationSchema = z.object({
  userId: z.string().min(1, 'userId est requis'),
  title: z.string().trim().max(200).default('Nouvelle conversation'),
  messages: z.array(chatMessageSchema).max(200),
  projectId: z.string().max(120).optional(),
  isEphemeral: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Conversation = z.infer<typeof conversationSchema>;

// ---------------------------------------------------------------------------
// Encrypted Fiscal Vault — shape of `encrypted_fiscal_vaults/{uid}`
// ---------------------------------------------------------------------------

export const encryptedVaultSchema = z.object({
  userId: z.string().min(1, 'userId est requis'),
  /** Base64 AES-GCM ciphertext. Structure is opaque to the server (zero-knowledge). */
  ciphertext: z.string().min(1, 'Le chiffré est vide'),
  iv: z.string().min(1, 'Le vecteur d\'initialisation est requis').optional(),
  algorithm: z.string().max(40).optional().default('AES-GCM-256'),
  updatedAt: z.any().optional(),
});

/** Inferred shape of a stored encrypted vault document. */
export type EncryptedVault = z.infer<typeof encryptedVaultSchema>;

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Non-throwing validation used on every Firestore read path and on legacy writes.
 * Logs a warning (visible in console — acceptance criterion) but never crashes the app.
 */
export function safeValidate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[Zod] Validation ignorée (${context}) — données conservées telles quelles :`,
      result.error.issues.map((i) => `${i.path.join('.') || '(racine)'}: ${i.message}`).join(' | ')
    );
    return data as z.infer<T>;
  }
  return result.data;
}

/**
 * Strict validation used before every `setDoc` / `addDoc` write.
 * Throws a ZodError with actionable messages when the payload is invalid.
 */
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown, context: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(
      `[Zod] Écriture refusée (${context}) :`,
      result.error.issues.map((i) => `${i.path.join('.') || '(racine)'}: ${i.message}`)
    );
    throw result.error;
  }
  return result.data;
}

/**
 * Fire-and-forget validation for local-first writes (IndexedDB mirrors Firestore).
 * Returns the original data if validation fails so the offline copy is never lost.
 */
export function validateLocal<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[Zod] Validation locale échouée (${context}) — copie IndexedDB conservée :`,
      result.error.issues.map((i) => `${i.path.join('.') || '(racine)'}: ${i.message}`)
    );
    return data as z.infer<T>;
  }
  return result.data;
}
