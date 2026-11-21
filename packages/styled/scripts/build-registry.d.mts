/** The place of the registry file on disk. */
export const registryPath: string

/**
 * The text of the registry file, from the source files as they are now.
 * A test gives a folder of its own.
 */
export function buildRegistry(source?: string): string

/** The text of the registry file on disk with LF line ends, or an empty text when there is none. */
export function readRegistry(): string

/** The version of a package in the `catalog` of `pnpm-workspace.yaml`. */
export function catalogVersion(name: string): string

/** Every import of a file: `from '…'`, `import('…')` and `import '…'` for a side effect. */
export function importsOf(content: string): string[]
