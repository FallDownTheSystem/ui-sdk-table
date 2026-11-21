import { createInlineEdit, type InlineEditReason, type PrimitiveContext } from '@ui-sdk/core'

export type CellEditReason = InlineEditReason

export type CellEditDetails = { reason: CellEditReason; event?: Event }

/** `true` when the text was saved, or the message that says why it was refused. */
export type SaveResult = true | string

/**
 * The second half of a save whose check took time: it reports the value and
 * gives the result. It runs only when the edit is still wanted then. After
 * Escape, after a move to another cell and after the end of the table, it
 * never runs, so nothing is saved that the person took back.
 */
export type LateSave = Promise<() => SaveResult>

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
	 * Ends an edit that the person left for another cell: a text field saves
	 * its text, and another editor closes. `keep` is a cell whose editor stays.
	 * Returns false when an editor is still open after it: its text was
	 * refused, or its check runs.
	 */
	release(keep?: string, event?: Event): boolean
	/** Whether the check of a value runs, so a second save must wait. */
	checking(): boolean
	/**
	 * Ends the edit with the result of a save that the caller made itself, for
	 * an editor that is not a text field. A refusal keeps the editor open.
	 */
	settle(result: SaveResult | LateSave, details?: CellEditDetails): void
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
	context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
	options: {
		/** The state key with the id of the cell that is edited, or `null`. */
		key: keyof State & string
		/** The state key with the id of the cell whose new value is checked now, or `null`. */
		checking: keyof State & string
		/** The state key with the reason of a refusal, by cell id: a record with one entry at most. */
		errors: keyof State & string
		/** The text that the editor of a cell starts with. */
		text: (id: string) => string
		canEdit: (id: string) => boolean
		save: (id: string, text: string, details: CellEditDetails) => SaveResult | LateSave
		/** Runs when a text was refused, with the reason. */
		refused?: (id: string, message: string) => void
		/**
		 * Runs after an edit ended, saved or not. Focus is still in the input
		 * then, and this is the place to move it to a cell. `saved` is false
		 * after Escape. A function that it returns runs once more after the
		 * input left the page: the renderer can move focus when it takes the
		 * input out, and that function puts it right again.
		 */
		done?: (id: string, details: CellEditDetails & { saved: boolean }) => void | (() => void)
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
	let afterLeave: (() => void) | undefined

	function wait(next: { id: string } | undefined): void {
		pending = next
		const id = next?.id ?? null
		if (store.get()[options.checking] !== id) {
			store.set({ [options.checking]: id } as Partial<State>)
		}
	}

	// An answer that comes after the table is gone must find no edit to end.
	let gone = false
	context.onDestroy(() => {
		gone = true
		pending = undefined
		afterLeave = undefined
	})

	function finish(id: string, details: CellEditDetails & { saved: boolean }): void {
		afterLeave = options.done?.(id, details) ?? undefined
	}

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
	function later(id: string, result: LateSave, details: CellEditDetails): void {
		const waiting = { id }
		wait(waiting)
		// Where focus is when the wait starts. The answer moves focus only when
		// it is still there: a person who went to another field stays in it.
		const target = details.event?.target
		const page = input?.ownerDocument ?? (target instanceof Node ? target.ownerDocument : null)
		const held = page?.activeElement
		const stayed = () => {
			const now = page?.activeElement
			return details.reason !== 'focus-out' && (!now || now === held || now === page?.body)
		}
		void result
			.catch(
				(error: unknown) => (): SaveResult =>
					error instanceof Error ? error.message : String(error),
			)
			.then((save) => {
				// Escape, a move to another cell or the end of the table took the edit back.
				if (pending !== waiting) return
				wait(undefined)
				if (editingId() !== id) return
				// An error of a listener is an error of the page, and not a reason for the person.
				const answer = save()
				if (answer !== true) {
					refuse(id, answer)
					if (stayed()) input?.focus()
					return
				}
				// The value is saved, so the edit ends without a second save.
				setError(id, undefined)
				const move = stayed()
				edit.cancel()
				if (move) finish(id, { ...details, saved: true })
			})
	}

	const api: CellEditor<State> = {
		editing: (state) => edit.editing(state),
		isEditing: (state, id) => edit.editing(state) === id,
		error: (state, id) => (state[options.errors] as Readonly<Record<string, string>>)[id],
		start(id, details = { reason: 'imperative' }) {
			if (editingId() === id) return false
			// `createInlineEdit` drops the text of an open edit when another starts.
			if (!api.release(id, details.event)) return false
			setError(id, undefined)
			afterLeave = undefined
			return edit.start(id, details)
		},
		keydown(event, id) {
			if (!options.canEdit(id) || editingId() === id) return false
			// An editor that the person left open in another cell ends before a key opens this one.
			if (!api.release(id, event)) return false
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
				const after = afterLeave
				afterLeave = undefined
				// `leave` gives focus back to the cell in a microtask when the input
				// took focus with it. This runs after that, so it sees where focus is.
				if (after) {
					queueMicrotask(() => {
						if (!gone) after()
					})
				}
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
				finish(id, { reason, event, saved: true })
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
				if (reason !== 'focus-out') finish(id, { reason, event, saved: true })
			}
			return ended
		},
		cancel(event) {
			const id = editingId()
			if (id === null) return
			wait(undefined)
			setError(id, undefined)
			edit.cancel()
			finish(id, { reason: event ? 'escape-key' : 'imperative', event, saved: false })
		},
		drop() {
			const id = editingId()
			if (id === null) return
			wait(undefined)
			setError(id, undefined)
			edit.cancel()
		},
		release(keep, event) {
			const id = editingId()
			if (id === null || id === keep) return true
			if (pending) return false
			// A change of the text takes the reason away. So a reason that is still
			// there says that this text was refused, and the person knows it.
			if (errors()[id] !== undefined) return false
			// An editor that is no text field has no text to save. It saves when
			// the person chooses, so a person who left it chose nothing.
			if (!input) {
				api.drop()
				return true
			}
			// As when focus leaves the field: the text is saved, and focus is not moved back.
			if (!edit.end('focus-out', event)) return false
			setError(id, undefined)
			return true
		},
		checking: () => pending !== undefined,
		settle(result, details = { reason: 'imperative' }) {
			const id = editingId()
			if (id === null || pending) return
			if (typeof result === 'string') refuse(id, result)
			else if (result === true) {
				setError(id, undefined)
				edit.cancel()
				finish(id, { ...details, saved: true })
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
