/**
 * Resolves the `@/…` path alias for Node's built-in test runner.
 *
 * Metro handles this alias in the app itself; the test runner needs its own resolver, and a
 * fifteen-line hook is cheaper than adding a whole test framework as a dependency.
 */
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

export function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const target = path.join(root, 'src', specifier.slice(2))
    // Source files import without extensions; the runner needs an explicit one.
    const withExt = /\.[cm]?[jt]sx?$/.test(target) ? target : `${target}.ts`
    return next(pathToFileURL(withExt).href, context)
  }
  return next(specifier, context)
}
