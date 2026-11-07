/**
 * Local error reporting helper (replaces `firebaseUtils.ts`).
 *
 * Same call signature as the old Firestore helper so page migrations are a
 * one-line import change. There is no server auth context anymore: the "authInfo"
 * block is gone, replaced by the local collection path that failed.
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface LocalErrorInfo {
  error: string;
  operationType: OperationType;
  /** e.g. "transactions", "companies/{userId}" */
  path: string | null;
  at: string;
}

/**
 * Logs a structured error and rethrows a readable message.
 * Kept throwing (like the old helper) so existing `catch` blocks keep working.
 */
export function handleLocalError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: LocalErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    at: new Date().toISOString(),
  };
  console.error('Local data error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/** Non-throwing variant for optional paths (telemetry, best-effort sync). */
export function logLocalError(error: unknown, operationType: OperationType, path: string | null): void {
  console.warn(
    'Local data warning: ',
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
    } satisfies Omit<LocalErrorInfo, 'at'>)
  );
}
