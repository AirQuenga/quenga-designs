"use server"

/**
 * Audit Types — Shared type definitions for the audit system.
 *
 * The actual audit logic lives in `audit-unified.ts`. This file exports only
 * the shared types used by that module and the import page UI.
 */

/* ------------------------------------------------------------------ types */

export interface AuditLogLine {
  level: "FIXED" | "SUCCESS" | "ERROR" | "WARN" | "INFO"
  message: string
}

export interface AuditBatchResult {
  scanned: number
  fixed: number
  failed: number
  nextOffset: number | null
  total: number
  logs: AuditLogLine[]
}
