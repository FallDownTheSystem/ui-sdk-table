/**
 * The Standard Schema interface, version 1 (https://standardschema.dev). Zod,
 * Valibot, ArkType and others give objects of this shape. The type is written
 * here, so the table needs no validation library.
 */
export type StandardSchemaV1<Input = unknown, Output = Input> = {
	readonly '~standard': {
		readonly version: 1
		readonly vendor: string
		readonly validate: (
			value: unknown,
		) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
		readonly types?: { readonly input: Input; readonly output: Output } | undefined
	}
}

export type StandardSchemaResult<Output> =
	| { readonly value: Output; readonly issues?: undefined }
	| { readonly issues: readonly { readonly message: string }[] }

/** The value that a schema gives back, or the reasons why it refuses the value. */
export type Checked = { value: unknown } | { issues: readonly string[] }

function read(result: StandardSchemaResult<unknown>): Checked {
	if (result.issues) return { issues: result.issues.map((issue) => issue.message) }
	return { value: result.value }
}

/**
 * Whether a value is a promise. A promise from another window or from a
 * library of its own is not an instance of `Promise` here, so the test is
 * the `then` method.
 */
export function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { then?: unknown }).then === 'function'
	)
}

/**
 * Checks a value with a schema. Without a schema, every value passes. The
 * answer is a promise only when the schema itself answers with one.
 */
export function checkValue(
	schema: StandardSchemaV1 | undefined,
	value: unknown,
): Checked | Promise<Checked> {
	if (!schema) return { value }
	const result = schema['~standard'].validate(value)
	return isThenable(result) ? Promise.resolve(result).then(read) : read(result)
}
