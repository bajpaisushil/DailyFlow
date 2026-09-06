/**
 * Module resolution for Node's built-in test runner.
 *
 * Metro resolves two things Node does not: the `@/…` path alias, and relative imports
 * written without a file extension. Rather than contort the source to suit the test runner,
 * this hook teaches the runner to resolve them the way the bundler does.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const HAS_EXTENSION = /\.[cm]?[jt]sx?$/

/** Add the extension Node needs, preferring a real file over an index. */
function withExtension(absolute) {
  if (HAS_EXTENSION.test(absolute)) return absolute
  for (const candidate of [`${absolute}.ts`, `${absolute}.tsx`, path.join(absolute, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return `${absolute}.ts`
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const target = path.join(root, 'src', specifier.slice(2))
    return next(pathToFileURL(withExtension(target)).href, context)
  }

  // Relative imports inside our own source, written without an extension.
  if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
    const parentDir = path.dirname(new URL(context.parentURL).pathname)
    const target = path.resolve(parentDir, specifier)
    if (!HAS_EXTENSION.test(target)) {
      return next(pathToFileURL(withExtension(target)).href, context)
    }
  }

  return next(specifier, context)
}
