/**
 * Identifier generation, deliberately kept free of any dependency.
 *
 * It lives on its own so modules that only need an id — the routine compiler, for one —
 * do not have to pull in the whole database layer, which also keeps them unit-testable
 * outside a native runtime.
 */
export function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  )
}
