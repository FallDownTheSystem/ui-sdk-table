/** The registry item that lies beside the script. */
export const itemPath: string

/** The path of every file from the app root, by its state. */
export type InstallResult = {
	written: string[]
	same: string[]
	different: string[]
	missing: string[]
	/** Files of the target folder that the item does not ship. */
	unknown: string[]
}

/**
 * Writes the files of the item under `src` of the app, byte for byte, or
 * compares them with `check` and writes nothing.
 */
export function installDataTable(
	appRoot: string,
	options?: { check?: boolean; item?: string },
): InstallResult
