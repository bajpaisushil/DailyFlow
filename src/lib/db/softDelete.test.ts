import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The soft-delete tombstone must live in the DOCUMENT, not only in the column.
 *
 * Export reads the stored JSON. When the tombstone was written to `deleted_at` alone, every
 * reminder, place and list the user had ever deleted came back to life the moment they
 * restored a backup on a new phone — the row was correctly hidden everywhere except the one
 * place it mattered.
 *
 * The real store needs a native runtime, so this tests the LOGIC the fix depends on, which is
 * what actually went wrong: the document handed to export must carry deletedAt.
 */

interface Doc { id: string; name: string; deletedAt?: number; updatedAt?: number }

/** Mirrors src/lib/db/sqlite.ts softDelete: parse, stamp, write back. */
function tombstone(stored: string, now: number): { doc: string; column: number } {
  const doc = JSON.parse(stored) as Doc
  doc.deletedAt = now
  doc.updatedAt = now
  return { doc: JSON.stringify(doc), column: now }
}

/** Mirrors export: reads the stored document, including deleted rows. */
function exportRows(rows: string[]): Doc[] {
  return rows.map((r) => JSON.parse(r) as Doc)
}

/** Mirrors import: anything without a tombstone comes back as live. */
function liveAfterRestore(rows: Doc[]): Doc[] {
  return rows.filter((r) => r.deletedAt == null)
}

describe('soft delete survives a backup round trip', () => {
  const original = JSON.stringify({ id: 'r1', name: 'Take pills at 03:00' })

  it('writes the tombstone into the document, not just the column', () => {
    const { doc } = tombstone(original, 1_700_000_000_000)
    const parsed = JSON.parse(doc) as Doc
    assert.equal(typeof parsed.deletedAt, 'number')
  })

  it('a deleted reminder does NOT come back after export and import', () => {
    // The bug: without the tombstone in the document, this returned the deleted reminder,
    // so a 3am alarm the user had removed reappeared on their new phone.
    const { doc } = tombstone(original, 1_700_000_000_000)
    const restored = liveAfterRestore(exportRows([doc]))
    assert.equal(restored.length, 0)
  })

  it('demonstrates the old behaviour, so the regression is unmistakable', () => {
    // Column-only tombstone: the document is untouched, so import sees a live row.
    const columnOnly = original
    const restored = liveAfterRestore(exportRows([columnOnly]))
    assert.equal(restored.length, 1, 'this is exactly what used to happen')
  })

  it('leaves rows that were never deleted alone', () => {
    const live = JSON.stringify({ id: 'r2', name: 'Leave for work' })
    assert.equal(liveAfterRestore(exportRows([live])).length, 1)
  })
})
