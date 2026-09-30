/**
 * Audit logging service.
 *
 * Records security-sensitive mutations to the audit_logs table.
 * Non-blocking: audit failures are logged but never crash the request.
 *
 * NEVER log: passwords, tokens, or sensitive field values.
 * Log: action, resource identifiers, IP, user agent — non-sensitive context only.
 */

import { prisma } from '../../db/client.js';
import { createLogger } from '../../observability/logger.js';

const log = createLogger('audit');

export type AuditAction =
  | 'USER_REGISTER'
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_REVOKED'
  | 'FARM_CREATE'
  | 'FARM_UPDATE'
  | 'FARM_DELETE'
  | 'FIELD_CREATE'
  | 'FIELD_DELETE'
  | 'CROP_CYCLE_CREATE'
  | 'CROP_CYCLE_UPDATE'
  | 'ADVISORY_GENERATE'
  | 'DIAGNOSTIC_SUBMIT'
  | 'IMAGE_UPLOAD'
  | 'PROFILE_UPDATE';

export interface AuditEntry {
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  /**
   * Record an audit log entry asynchronously.
   * Errors are caught and logged — never thrown to callers.
   */
  async record(entry: AuditEntry): Promise<void> {
    prisma.auditLog
      .create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          // Truncate to fit column constraints
          ipAddress: entry.ipAddress?.slice(0, 45) ?? null,
          userAgent: entry.userAgent?.slice(0, 500) ?? null,
          metadata: entry.metadata ?? undefined,
        },
      })
      .catch((err) => {
        // Non-fatal — log and continue
        log.error({ err, action: entry.action }, 'Audit log write failed');
      });
  }
}

export const auditService = new AuditService();
