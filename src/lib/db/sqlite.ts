import * as SQLite from 'expo-sqlite'

/**
 * On-device storage. Nothing in here is ever transmitted anywhere — there is no network
 * layer in this application at all.
 *
 * Shape: a single document table per collection rather than a wide relational schema.
 * The domain model (src/lib/types.ts) is document-shaped, volumes are small (tens of places
 * and routines, a capped event log), and every query the app runs is either "all rows in a
 * collection" or "one row by id". A document store serves those in one indexed lookup while
 * keeping migrations trivial — adding a field to a type needs no ALTER TABLE.
 *
 * Ordering/scan columns are promoted to real indexed columns so hot queries never
 * deserialise JSON they are going to throw away.
 */

export type Collection =
  | 'settings'
  | 'places'
  | 'checklists'
  | 'checklistRuns'
  | 'routines'
  | 'automations'
  | 'commuteProfiles'
  | 'commuteSessions'
  | 'activity'
  | 'firings'

const COLLECTIONS: Collection[] = [
  'settings', 'places', 'checklists', 'checklistRuns', 'routines',
  'automations', 'commuteProfiles', 'commuteSessions', 'activity', 'firings',
]

let dbRef: SQLite.SQLiteDatabase | null = null

/**
 * Opened synchronously so the first screen can read without an await-induced blank frame.
 * `expo-sqlite` supports a sync open on native; this is the single biggest startup win
 * available to us.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!dbRef) {
    dbRef = SQLite.openDatabaseSync('dailyflow.db')
    initialise(dbRef)
  }
  return dbRef
}

function initialise(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `)

  for (const c of COLLECTIONS) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS ${c} (
        id         TEXT PRIMARY KEY NOT NULL,
        doc        TEXT NOT NULL,
        sort       REAL,
        updated_at INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_${c}_sort ON ${c} (sort);
      CREATE INDEX IF NOT EXISTS idx_${c}_live ON ${c} (deleted_at);
    `)
  }

  // Ledger lookups are by automation, and pruning is by time.
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_firings_auto ON firings (sort);`)
}

interface Row {
  id: string
  doc: string
  sort: number | null
  updated_at: number
  deleted_at: number | null
}

/** Column promoted out of the document so ordered scans avoid JSON parsing. */
function sortKeyOf(collection: Collection, doc: Record<string, unknown>): number | null {
  switch (collection) {
    case 'activity':
    case 'firings':
      return typeof doc.at === 'number' ? doc.at : typeof doc.firedAt === 'number' ? doc.firedAt : null
    case 'commuteSessions':
      return typeof doc.startedAt === 'number' ? doc.startedAt : null
    default:
      return typeof doc.createdAt === 'number' ? doc.createdAt : null
  }
}

export function put<T extends { id: string; deletedAt?: number }>(
  collection: Collection,
  doc: T,
): void {
  const db = getDb()
  const record = doc as unknown as Record<string, unknown>
  db.runSync(
    `INSERT INTO ${collection} (id, doc, sort, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       doc = excluded.doc, sort = excluded.sort,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
    [
      doc.id,
      JSON.stringify(doc),
      sortKeyOf(collection, record),
      typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
      doc.deletedAt ?? null,
    ],
  )
}

/** One transaction for a batch — import and routine-compilation both depend on this. */
export function putMany<T extends { id: string; deletedAt?: number }>(
  collection: Collection,
  docs: T[],
): void {
  if (docs.length === 0) return
  const db = getDb()
  db.withTransactionSync(() => {
    for (const d of docs) put(collection, d)
  })
}

export function get<T>(collection: Collection, id: string): T | null {
  const db = getDb()
  const row = db.getFirstSync<Row>(`SELECT * FROM ${collection} WHERE id = ?`, [id])
  if (!row) return null
  return JSON.parse(row.doc) as T
}

/** Live rows only (soft-deleted excluded), oldest-first by the promoted sort column. */
export function all<T>(collection: Collection, opts?: { includeDeleted?: boolean; desc?: boolean; limit?: number }): T[] {
  const db = getDb()
  const where = opts?.includeDeleted ? '' : 'WHERE deleted_at IS NULL'
  const order = `ORDER BY sort ${opts?.desc ? 'DESC' : 'ASC'}`
  const limit = opts?.limit ? `LIMIT ${Math.floor(opts.limit)}` : ''
  const rows = db.getAllSync<Row>(`SELECT doc FROM ${collection} ${where} ${order} ${limit}`)
  return rows.map((r) => JSON.parse(r.doc) as T)
}

export function count(collection: Collection): number {
  const db = getDb()
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${collection} WHERE deleted_at IS NULL`,
  )
  return row?.n ?? 0
}

/** Soft delete keeps history coherent and makes export round-trips honest. */
export function softDelete(collection: Collection, id: string): void {
  const db = getDb()
  const now = Date.now()
  db.runSync(`UPDATE ${collection} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id])
}

export function hardDelete(collection: Collection, id: string): void {
  getDb().runSync(`DELETE FROM ${collection} WHERE id = ?`, [id])
}

/** Used by the ledger and the event log, both of which are strictly capped. */
export function pruneOlderThan(collection: Collection, cutoff: number): number {
  const db = getDb()
  const res = db.runSync(`DELETE FROM ${collection} WHERE sort IS NOT NULL AND sort < ?`, [cutoff])
  return res.changes
}

export function pruneToMostRecent(collection: Collection, keep: number): number {
  const db = getDb()
  const res = db.runSync(
    `DELETE FROM ${collection} WHERE id NOT IN (
       SELECT id FROM ${collection} ORDER BY sort DESC LIMIT ?
     )`,
    [Math.max(0, Math.floor(keep))],
  )
  return res.changes
}

export function clearCollection(collection: Collection): void {
  getDb().execSync(`DELETE FROM ${collection}`)
}

/** "Delete everything" — the user must always be able to fully erase the app's memory. */
export function clearAll(): void {
  const db = getDb()
  db.withTransactionSync(() => {
    for (const c of COLLECTIONS) db.execSync(`DELETE FROM ${c}`)
  })
}

/** Bytes on disk, for the storage panel the user asked for (REQUIREMENTS.md #41). */
export function collectionBytes(collection: Collection): number {
  const db = getDb()
  // LENGTH() on TEXT counts characters; casting to BLOB counts real bytes, which is what
  // the user is being shown.
  const row = db.getFirstSync<{ n: number | null }>(
    `SELECT SUM(LENGTH(CAST(doc AS BLOB))) AS n FROM ${collection}`,
  )
  return row?.n ?? 0
}

export function rowCount(collection: Collection): number {
  const row = getDb().getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${collection}`)
  return row?.n ?? 0
}

export const ALL_COLLECTIONS = COLLECTIONS
