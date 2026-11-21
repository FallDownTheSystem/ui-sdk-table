import { createInlineEdit, type InlineEditReason, type PrimitiveContext } from '@ui-sdk/core'

export type CellEditReason = InlineEditReason

export type CellEditDetails = { reason: CellEditReason; event?: Event }

/** `true` when the text was saved, or the message that says why it was refused. */
export type SaveResult = true | string

export type CellEditor<State> = {
	/** The id of the cell that is edited, or `null`. */
	editing(state: State): string | null
	isEditing(state: State, id: string): boolean
	/** Why the text of the cell was refused, or `undefined`. */
	error(state: State, id: string): string | undefined
	/**
	 * Starts to edit a cell. An edit of another cell that is open is saved
	 * first; when it cannot be saved, it stays open and this returns `false`.
	 */
	start(id: string, details?: CellEditDetails & { text?: string }): boolean
	/** Handles a key on a cell: Enter or F2 start with the value, a character starts with that character. */
	keydown(event: KeyboardEvent, id: string): boolean
	dblclick(event: MouseEvent, id: string): boolean
	/** Joins the input of the editor. Return the result from the `bind` of its slot. */
	bindInput(el: HTMLInputElement | HTMLTextAreaElement): () => void
	/** Handles a key in the input: Enter and Tab save, Escape puts the text back. */
	inputKeydown(event: KeyboardEvent): boolean
	/** Saves the text of the input and ends the edit. Returns whether it ended. */
	end(reason?: CellEditReason, event?: Event): boolean
	/** Ends the edit without a save. */
	cancel(event?: Event): void
	/** Ends the edit without a save and without a move of focus: the cell is gone. */
	drop(): void
	/**
	 * Ends the edit with the result of a save that the caller made itself, for
	 * an editor that is not a text field. A refusal keeps the editor open.
	 */
	settle(result: SaveResult | Promise<SaveResult>, details?: CellEditDetails): void
	/**
	 * Handles focus that leaves the input: the text is saved. A text that is
	 * refused keeps the editor open, and when focus went to another place in
	 * `within`, it comes back to the input, so the person sees why.
	 */
	focusout(event: FocusEvent, within: HTMLElement | null | undefined): void
}

/**
 * Editing of one cell at a time. It wraps `createInlineEdit` of UI SDK, which
 * is experimental, and it is the only file that calls it.
 *
 * `createInlineEdit` knows a text and a function that saves it. A table adds
 * three rules. A value that is refused has a reason, which the person must
 * see and hear, so `save` returns the reason and the editor stays open with
 * it. A check can take time, so `save` can return a promise, and the editor
 * stays open until the answer is there. And focus is on a cell before and
 * after an edit, so the end of an edit says where focus goes.
 */
export function createCellEdit<State extends object>(
	context: Pick<PrimitiveContext<any, State, any>, 'store'>,
	options: {
		/** The state key with the id of the cell that is edited, or `null`. */
		key: keyof State & string
		/** The state key with the reason of a refusal, by cell id: a record with one entry at most. */
		errors: keyof State & string
		/** The text that the editor of a cell starts with. */
		text: (id: string) => string
		canEdit: (id: string) => boolean
		save: (id: string, text: string, details: CellEditDetails) => SaveResult | Promise<SaveResult>
		/** Runs when a text was refused, with the reason. */
		refused?: (id: string, message: string) => void
		/**
		 * Runs after an edit ended, saved or not. Focus is still in the input
		 * then, and this is the place to move it to a cell. `saved` is false
		 * after Escape.
		 */
		done?: (id: string, details: CellEditDetails & { saved: boolean }) => void
	},
): CellEditor<State> {
	const { store } = context
	const editingId = () => store.get()[options.key] as string | null
	const errors = () => store.get()[options.errors] as Readonly<Record<string, string>>
	const NONE: Readonly<Record<string, string>> = {}

	function setError(id: string, message: string | undefined): void {
		const current = errors()
		if (message === undefined) {
			if (Object.keys(current).length) store.set({ [options.errors]: NONE } as Partial<State>)
			return
		}
		if (current[id] !== message)
			store.set({ [options.errors]: { [id]: message } } as Partial<State>)
	}

	let input: HTMLInputElement | HTMLTextAreaElement | undefined
	// The check of a text that takes time. A second save waits for the first.
	let pending: { id: string } | undefined

	function refuse(id: string, message: string): void {
		setError(id, message)
		options.refused?.(id, message)
	}

	const edit = createInlineEdit(context, {
		key: options.key,
		value: options.text,
		disabled: (id) => !options.canEdit(id),
		commit: (id, text, details) => {
			if (pending) return false
			const result = options.save(id, text, details)
			if (result === true) return true
			if (typeof result === 'string') {
				refuse(id, result)
				return false
			}
			later(id, result, details)
			return false
		},
	})

	/** Waits for a check that takes time. The editor stays open until the answer is there. */
	function later(id: string, result: Promise<SaveResult>, details: CellEditDetails): void {
		const waiting = { id }
		pending = waiting
		void result
			.catch((error: unknown) => (error instanceof Error ? error.message : String(error)))
			.then((answer) => {
				if (pending !== waiting) return
				pending = undefined
				// The person ended the edit or went to another cell while the check ran.
				if (editingId() !== id) return
				if (answer !== true) {
					refuse(id, answer)
					if (details.reason !== 'focus-out') input?.focus()
					return
				}
				// The value is saved, so the edit ends without a second save.
				setError(id, undefined)
				edit.cancel()
				if (details.reason !== 'focus-out') options.done?.(id, { ...details, saved: true })
			})
	}

	const api: CellEditor<State> = {
		editing: (state) => edit.editing(state),
		isEditing: (state, id) => edit.editing(state) === id,
		error: (state, id) => (state[options.errors] as Readonly<Record<string, string>>)[id],
		start(id, details = { reason: 'imperative' }) {
			const open = editingId()
			if (open === id) return false
			// `createInlineEdit` drops the text of an open edit when another starts.
			if (open !== null && !api.end('imperative')) return false
			if (editingId() !== null) return false
			setError(id, undefined)
			return edit.start(id, details)
		},
		keydown(event, id) {
			if (editingId() !== null || !options.canEdit(id)) return false
			return edit.keydown(event, id)
		},
		dblclick(event, id) {
			if (!options.canEdit(id)) return false
			return api.start(id, { reason: 'double-click', event })
		},
		bindInput(el) {
			input = el
			// A person who changes the text has seen the reason of the refusal.
			const onInput = () => {
				const id = editingId()
				if (id !== null) setError(id, undefined)
			}
			el.addEventListener('input', onInput)
			const leave = edit.bindInput(el)
			// A renderer can call this before the input is in the page, and then the focus above did nothing.
			if (!el.isConnected) {
				queueMicrotask(() => {
					if (input === el && el.isConnected && el.ownerDocument.activeElement !== el) el.focus()
				})
			}
			return () => {
				el.removeEventListener('input', onInput)
				if (input === el) input = undefined
				leave()
			}
		},
		inputKeydown(event) {
			const id = editingId()
			if (id === null) return false
			if (event.key === 'Escape') {
				api.cancel(event)
				event.preventDefault()
				event.stopPropagation()
				return true
			}
			const handled = edit.inputKeydown(event)
			// Handled, and the edit is over: the text was saved, or it was the same as before.
			if (handled && editingId() === null) {
				setError(id, undefined)
				const reason = event.key === 'Tab' ? 'tab-key' : 'enter-key'
				options.done?.(id, { reason, event, saved: true })
			}
			// Tab stays in the table while the text is refused or checked.
			if (event.key === 'Tab') event.preventDefault()
			return handled || event.key === 'Tab'
		},
		end(reason = 'imperative', event) {
			const id = editingId()
			if (id === null) return false
			const ended = edit.end(reason, event)
			if (ended) {
				setError(id, undefined)
				if (reason !== 'focus-out') options.done?.(id, { reason, event, saved: true })
			}
			return ended
		},
		cancel(event) {
			const id = editingId()
			if (id === null) return
			pending = undefined
			setError(id, undefined)
			edit.cancel()
			options.done?.(id, { reason: 'escape-key', event, saved: false })
		},
		drop() {
			const id = editingId()
			if (id === null) return
			pending = undefined
			setError(id, undefined)
			edit.cancel()
		},
		settle(result, details = { reason: 'imperative' }) {
			const id = editingId()
			if (id === null || pending) return
			if (typeof result === 'string') refuse(id, result)
			else if (result === true) {
				setError(id, undefined)
				edit.cancel()
				options.done?.(id, { ...details, saved: true })
			} else later(id, result, details)
		},
		focusout(event, within) {
			const id = editingId()
			if (id === null) return
			const field = input
			if (edit.end('focus-out', event)) {
				setError(id, undefined)
				return
			}
			const to = event.relatedTarget
			if (!field || !(to instanceof Node) || !within?.contains(to) || field.contains(to)) return
			queueMicrotask(() => {
				if (editingId() === id && field.isConnected) field.focus()
			})
		},
	}
	return api
}
