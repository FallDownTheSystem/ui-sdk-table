/**
 * Why a formula cannot be read, as data. The words come from the code that
 * shows the issue, so the engine holds no language. `at` is the place in the
 * text, counted from 0.
 */
export type FormulaIssue =
	| { code: 'empty' }
	| { code: 'tooLong'; limit: number }
	| { code: 'tooDeep'; at: number; limit: number }
	/** `found` is the text that cannot stand there, or `''` when the formula ends too soon. */
	| { code: 'syntax'; at: number; found: string }
	/** A decimal sign of another language, such as `1.5` where the decimal sign is `,`. */
	| { code: 'decimalSign'; at: number; expected: '.' | ',' }
	/** A sign between arguments that this language does not use. */
	| { code: 'separator'; at: number; expected: ',' | ';' }
	| { code: 'unknownFunction'; at: number; name: string; valid: readonly string[] }
	| { code: 'unknownColumn'; at: number; name: string; valid: readonly string[] }
	/** Two or more columns have this header; `valid` holds their ids. */
	| { code: 'sharedHeader'; at: number; name: string; valid: readonly string[] }
	/** A word that is no function, no column and no value. */
	| { code: 'unknownName'; at: number; name: string }
	| {
			code: 'arguments'
			at: number
			name: string
			min: number
			max: number
			even?: boolean
			given: number
	  }
	/** A reference to another row, or a range, where only the own row can be read. */
	| { code: 'otherRow'; at: number; name: string }
	/** The formula of a column reads that column. */
	| { code: 'cycle'; at: number; name: string }

export type FormulaIssueCode = FormulaIssue['code']
