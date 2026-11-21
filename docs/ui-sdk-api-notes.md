# UI SDK API notes for the table primitive

Applies to `@ui-sdk/core@0.1.0-beta.13` and `@ui-sdk/vue@0.1.0-beta.13` (`vue` peer `>=3.5`, `@ui-sdk/core` peer `^0.1.0-beta.13`).
Sources: the shipped `.d.ts` files, `@ui-sdk/vue/docs/{llms.txt,core.md,rendering.md,custom-parts.md,agents.md}`, `docs/proof/RESULT.md` and `docs/proof/src/proofs/*`.
Anything not confirmed by docs or types says "unconfirmed". Compiled `dist/*.js` was not read, so runtime behavior that only the JS shows is unconfirmed.

Stable: `definePrimitive`, `createChange`, `createRovingFocus`, `createSelection`, `createReorder`, `createController`, `createParts`, `usePrimitive`, `usePart`, `visibleTreeRows`, `selects`, `live`, `direct`. Experimental: `createGridFocus`, `createCellRange`, `createResize`, `createVirtualizer`, `createInlineEdit`, `createCommit`, `dispatch`, `mount`, `checkPattern`, the `agent` key.
## 0. Import map

| Need | Import |
| --- | --- |
| `definePrimitive`, `createChange`, `createCommit`, `dispatch`, `elements`, `selects`, `live`, `direct`, `css`, `createController`, every `create*` behavior, `byCell`, `byCellRange`, `visibleTreeRows`, `isRTL`, `settleDraft`, `idPart`, `sourceOf`, `isDismissal`, types `ChangeDetails`, `CommitDetails`, `PrimitiveContext`, `Part`, `Store`, `OptionsOf`, `StateOf`, `PropsOf`, `SlotName`, `TypesOf`, `Attrs`, `PropSpec`, `PropSchema`, `SlotDefinition`, `SlotFactory`, `PrimitiveOptions`, `Primitive`, `PrimitiveInstance`, `ChangeReason`, `ChangeSource`, `ReasonVocabulary` | `@ui-sdk/core` |
| `mount`, `checkPattern`, `checkServer`, `checkDirection`, `settle`, `partAttrs`, `partState`, `partPresent`, `setPlatform` | `@ui-sdk/core/testing` |
| `createAgent`, `agentTools`, `registerTools`, `AgentAction`, `AgentChange`, `AgentComponent`, `AgentStep`, `ObservedChange` (Vue re-export) | `@ui-sdk/vue/agent` (same symbols in `@ui-sdk/core/agent`) |
| `createParts`, `usePrimitive`, `usePart`, `Parts`, `PartSlots`, `PartElement`, `PrimitiveHandle` | `@ui-sdk/vue/primitive` |
| `BaseSlotProps`, `Feature`, `Listener`, `PrimitiveGeneric`, `PrimitiveSchema`, `WithFeatures`, `WithGeneric`, `warn`, ... | `@ui-sdk/core/renderer` (JSDoc: "For framework renderers only ... nothing here is public API, may change with any release") |

Not exported from the `@ui-sdk/core` root: `Role`, `Focus`, `HandledKey`, `Unneeded`, `BaseSlotProps`, `Feature`, `Listener`, `SlotProps`, `Named`, `ReasonFor`, `RoleFields`, `AgentSurface`, `deriveState`, `deriveFromOptions`. Use `PropsOf<P, S>` instead of `SlotProps`.
Not in the `@ui-sdk/vue/primitive` entry (only in `dist/*.d.ts`): `withElement`, `RootPropsOf`, `provideHandle`, `useHandle`, `useScope`, `copyProps`, `renderElement`.

---

## 1. `definePrimitive`

Import: `import { definePrimitive } from '@ui-sdk/core'`

```ts
declare function definePrimitive<
  Options extends object, State extends object,
  Api extends ControlledBy<Options>, Slots extends Record<string, AnySlot>,
>(definition: {
  name: string                                   // prefixes data-slot; kebab case
  state: (options: Options) => State             // initial state; read default<Key> here
  live?: (keyof State)[]                         // keys that change often, never affect render
  asleep?: (options: Options) => boolean         // @experimental: lazy api/bind until first event
  sync?: (options: Options) => Partial<State>    // maps controlled options onto state, runs on every options change
  controlled?: (keyof State & string)[]          // defaults to whichever of open/value/checked exist in state
  commits?: (keyof State & string)[]             // @experimental: keys changed in steps then committed
  api: (context: PrimitiveContext<Options, State, string>) => Api
  slots: (slot: SlotFactory<State, Api>) => Slots
  label?: string                                 // name in warnings/devtools when not `name`
  agent?: {
    actions?: string[]; closed?: boolean; items?: (api: NoInfer<Api>) => unknown
    reveals?: boolean; shown?: (state: NoInfer<State>) => boolean; secret?: boolean
  }
} & OptionsSchema<Options>)                      // options: PropSchema<Omit<Options, keyof PrimitiveOptions>>
  : ((initialOptions: Options & { id: string }) => PrimitiveInstanceOfThis) & { options; slots }
```

`ControlledBy<Options> = NonNullable<(Options & { controller?: unknown })['controller']>`: if `Options` has `controller?: X`, then `api` must return something assignable to `X`.
`OptionsSchema`: `options` is optional only when `Options` has no keys besides `debug`. TypeScript requires every option to have a kind. `PrimitiveOptions = { debug?: boolean }` is added to every primitive automatically.

### 1.1 Field-by-field

| Field | Meaning and gotchas |
| --- | --- |
| `name` | Root element gets `data-slot="<name>"`, other slots `data-slot="<name>-<slot>"`. |
| `options` | Map of option name to `PropSpec`. Used by renderers to tell options from element attributes. See kinds below. Type the options once, on `state`'s parameter (`state: (options: TableOptions) => ...`), which types `context.options()`. |
| `state` | Pure, runs on the server too. Read `options.defaultX ?? options.x` here. A later change of `defaultX` does not reset state. |
| `sync` | Returns only the controlled keys (`{}` leaves state alone; `{ rows: undefined }` overwrites with undefined). The skeleton `table.ts` uses it for derived `rowCount`. |
| `controlled` | Only enables dev warnings (both `x` and `defaultX`, switching controlled/uncontrolled) and marks the keys the agent snapshot exposes. Default list is `open`, `value`, `checked` only. A key like `selected` or `sorting` must be listed. It does not itself write controlled values into state: `sync` does. |
| `live` | See section 3. |
| `commits` | Keys written step by step via `createChange` and finished with `createCommit` (see 2.3). `observe` reports one change per commit. |
| `asleep` | `@experimental`. Parts render and run `asleep` hooks; `api` and `bind` wait until the first handled event or first read of `instance.api`. |
| `api` | Runs once per instance. The returned object is what slots, adapters, controllers and the agent call. Behaviors are created here and returned on the api (`return { grid, range, change }`). |
| `slots` | Parts, built with the `slot` factory. |
| `agent` | See section 6. Put it after `api` so `items` sees the api types. |

### 1.2 Option / prop kinds (`PropSpec`)

```ts
type PropKind = 'string' | 'number' | 'boolean' | 'list' | 'value' | 'callback' | 'action' | 'id' | 'key'
type PropSpec = PropKind
  | { kind: PropKind; from: string; required?: boolean }   // nested part inherits prop from an enclosing slot
  | ((attribute: string | null) => unknown)                // custom attribute parser (web components)
type PropSchema<Props> = { [K in Exclude<keyof Props, 'id'> & string]: PropSpec } & { id?: PropSpec }
```

| Kind | Use |
| --- | --- |
| `'string' 'number' 'boolean'` | attribute-readable scalars |
| `'list'` | string or string[] (comma-separated as attribute) |
| `'value'` | anything else (arrays of rows, objects, functions, elements); property only. Use for `rows`, `columns`, `selected`, `sorting` |
| `'callback'` | function the component calls; Vue treats as an emit (`onValueChange` becomes `@value-change`) |
| `'action'` | function whose return value matters (Promise); stays a function prop in Vue |
| `'id'` | string the adapter generates when omitted |
| `'key'` | "A list item's value, of any type. The part is keyed by `api.internal.keyOf(value)`" (types comment only). Unconfirmed how to use in a custom primitive; `api.internal` is for adapters. Use `id: 'string'` instead. |

`{ kind: 'string', from: 'row' }` makes a cell take `rowId` from the enclosing `row` part when omitted; add `required: true` to throw outside that parent (docs, "Option Kinds").

### 1.3 What `api` receives: `PrimitiveContext`

```ts
type PrimitiveContext<Options, State extends object, Slot extends string> = {
  id: string                          // instance id; build part ids from it
  label: string
  store: Store<State>                 // get(), set(partial), subscribe(listener)
  options: () => Options              // newest options; call inside methods, not once in api
  onOptions: (listener: (options: Options, synced: Partial<State> | undefined) => ChangeSource | void) => void
  onDestroy: (cleanup: () => void) => void     // runs once at destroy()
  parts(): Iterable<Part>             // every rendered part
  element(slot: Slot, key?: string): HTMLElement | undefined   // undefined on the server
  props<Props extends object = object>(slot: Slot, key?: string): Props | undefined
}
type Store<State> = {
  get(): State
  set(patch: Partial<State>, delivered?: boolean): void   // merges; notifies only when a value changed by sameValue
  subscribe(listener: (liveOnly: boolean, delivered: boolean, changed: readonly string[]) => void): () => void
  // plus internal: setFanout, follow, view
}
```

- Element refs: `context.element('cell', '3:2')`, `context.props<{row:number}>('row', key)`, `elements(context, 'row')` (below). All undefined or empty on the server.
- Lifecycle: `context.onDestroy(() => clearTimeout(t))`. Per-element lifecycle goes in a slot's `bind` (return a cleanup).
- Options: `context.onOptions((o) => { if (o.rows === prev) return; ... context.store.set({ ... }) })` runs before `sync` writes.
- `context.store.set` is for bookkeeping with no callback (active cell, draft). User-visible changes go through `createChange`.

```ts
import { elements } from '@ui-sdk/core'
declare function elements<Props extends object = object>(
  context: { parts(): Iterable<Part> }, slot: string,
): { el: HTMLElement; key: string; props: Props }[]      // bound elements in document order
```

### 1.4 Slot fields

```ts
slot<Props extends object = {}, Public extends object = {}>(def: {
  // ROLE (see 8): role | role fn + roles[], plus focus / press / keys per role
  role?: Role | ((state, ctx: { id; key; props; api }) => Role | undefined)
  roles?: readonly Role[]
  focus?: 'roving' | 'tab-stop' | 'active-descendant' | 'native' | { none: string } | ((state, ctx) => ...)
  keys?: readonly HandledKey[] | ((state) => readonly HandledKey[]) | { none: string }
  press?: ((ctx: SlotContext, event?: Event) => void) | { none: string }
  // CONTENT
  props?: PropSchema<Props>               // required when the slot has props other than id
  attrs?: (state: State, ctx: { id; key; props: Props; api: Api }) => Attrs       // Record<string, string|undefined>; PURE; runs on the server
  state?: (state: State, ctx: { id; key; props: Props; api: Api }) => Public       // what the Vue default slot receives as `state`
  present?: (state, ctx) => boolean       // false removes the element (Vue adapter)
  // TARGETED UPDATES (section 3)
  selects?: Selects<State, Api, Props>
  live?: Live<State, Api, Props>
  direct?: Direct
  // EVENTS AND ELEMENT
  on?: { [E in keyof HTMLElementEventMap]?: (event, ctx: SlotContext) => void }
  bind?: (el: HTMLElement, part: Part<State, Api, Props>) => (() => void) | void     // client only; return cleanup
  asleep?: (el, part) => (() => void) | void                                          // @experimental
  connect?: (el: HTMLElement) => () => void
})

type SlotContext<State, Api, Props> = {
  el: HTMLElement | undefined   // undefined before bind, or for a press sent by a test
  id: string; key: string       // instance id; part key = props.id ?? String(props.value)
  props: Props; store: Store<State>; api: Api
}
type Part<State, Api, Props> = {
  readonly slot: string; readonly key: string; readonly id: string
  readonly api: Api; readonly store: Store<State>
  props: Props                  // newest render's props (stays current)
  el: HTMLElement | undefined
}
```

Facts:
- Roles go on the slot (`role`), never in `attrs` (types forbid ARIA attributes the role does not take, and docs say never put `role` in `attrs`).
- `attrs` values are strings; booleans are `'true'`/`'false'`, boolean attributes are `''` or `undefined`.
- `attrs` and `state` are pure. DOM work goes in `bind`. `state` may read live keys; `attrs` must not.
- `slot.state` results are compared by value (arrays and plain objects by content), so `state: (s) => ({ order: s.order })` creating new arrays each call does not re-render. `Date`, `Map`, elements compare by identity.
- Handlers: a handler passed by the component user runs first and can call `event.preventDefault()` to skip the primitive's handler (`on` and `press`). `press` is a click, plus Enter/Space and screen reader activation for pressable roles.
- Slot names with a hyphen become Pascal case in Vue (`tab-icon` becomes `TabIcon`).
- Id: a user-written `id` on an element wins over the slot's; build references from `part.id` (the instance id), not hard-coded strings. `idPart(value)` from `@ui-sdk/core` escapes spaces and `%` in ids built from values.

### 1.5 List item slots (row, cell, column header)

There is no special "item slot" construct: one slot definition, rendered many times, each rendering a **part** identified by its props. The per-item argument is the slot's props, and the item key is `part.key`:

```ts
// key = props.id ?? String(props.value)    (Part.key JSDoc). With neither, key is ''.
row: slot<{ id: string; index: number }>({
  props: { id: 'string', index: 'number' },
  role: 'row',
  attrs: (state, { key, props }) => ({ 'aria-rowindex': String(props.index + 1) }),
  //                 ^ key === props.id
}),
```

Every handler, `attrs`, `state`, `present`, `live`, `selects` and `bind` receives the item's `key` and `props`. `context.props('row', key)`, `context.element('row', key)`, `elements(context, 'row')` read parts from `api`.
Render the same slot as many parts as needed: `<TableRow v-for="r in rows" :key="r.id" :id="r.id" :index="i">`. The Vue `:key` is Vue's; the SDK key comes from the `id` prop. Keep both equal.
Grid behaviors need cell props `{ id: string; row: number; col: number }` with a stable cell `id` such as `"1:2"` (docs and proof).

---

## 2. State contract

### 2.1 Naming

For each controlled key `<key>` (e.g. `selected`): options `<key>` (controlled), `default<Key>` (initial), callback `on<Key>Change(value, details)`. In Vue: `v-model:<key>` (emits `update:<key>`), `:default-<key>`, `@<key>-change`.

```ts
type SelectedOptions = {
  selected?: string[]
  defaultSelected?: string[]
  onSelectedChange?: (value: string[], details: ChangeDetails<'item-press' | 'list-navigation'>) => void
}
const p = definePrimitive({
  name: 'x',
  options: { selected: 'value', defaultSelected: 'value', onSelectedChange: 'callback' },
  controlled: ['selected'],
  state: (o: SelectedOptions) => ({ selected: o.selected ?? o.defaultSelected ?? [] }),
  sync: (o) => (o.selected === undefined ? {} : { selected: o.selected }),
  // api: createChange(context) ...
})
```

How controlled values flow back in: the parent passes `selected`; `sync` copies it into state whenever options change. `createChange` calls `onSelectedChange` first; if the key is controlled it does not write state, so state only changes when the parent passes the new prop. If uncontrolled (option undefined) it writes state. "Controlled" detection details are unconfirmed (docs: "waits for it to come back through `muted`; if you leave out `muted`, it updates the button's own state"). Keep a key controlled or uncontrolled for the instance lifetime (dev warning otherwise).
The `col-reorder` proof had no `sync` or `controlled` and still worked as uncontrolled with a callback. Controlled mode for `value` there was not tested (unconfirmed).

### 2.2 `createChange`, `dispatch`, `ChangeDetails`

```ts
import { createChange, createCommit, dispatch, type ChangeDetails, type CommitDetails } from '@ui-sdk/core'

declare function createChange<Options, State extends object>(
  context: PrimitiveContext<Options, State, any>,
  source?: (reason: string, event?: Event) => ChangeSource,
): <Key extends keyof State & string>(key: Key, value: State[Key], details: {
  reason: ReasonFor<Options, Key, 'Change'>     // narrowed by the on<Key>Change callback's ChangeDetails<...> type; string if untyped
  event?: Event
  source?: ChangeSource
  [extra: string]: unknown                      // extra fields are merged into the callback's details at runtime
}) => boolean                                   // false: same value or canceled. For controlled state, true only means "accepted"; parent must pass the value back.

declare function dispatch<Value>(
  context: { options: () => unknown }, name: `on${string}`, value: Value,
  details: { reason: string; event?: Event; source?: ChangeSource; [extra: string]: unknown },
): boolean                                      // true when the callback canceled. @experimental. Writes no state.
```

```ts
type ChangeDetails<Reason extends string = string> = Reason extends unknown ? {
  reason: Reason
  event?: EventOf<Reason>                       // narrowed by reason: 'escape-key' gives KeyboardEvent; custom reasons give Event
  source: 'mouse' | 'touch' | 'pen' | 'keyboard' | 'virtual' | 'programmatic' | 'agent'
  cancel: () => void                            // refuses an uncontrolled change; ignored by controlled state
  readonly canceled: boolean
} : never
```

- `event.preventDefault()` alone does not cancel; call `details.cancel()`.
- `source: 'agent'` appears when the change came through `@ui-sdk/core/agent`. `'virtual'` = click with no pointer/key (assistive tech). Use for analytics and focus choices, "never for behavior".
- Reason vocabulary (`ReasonVocabulary`, `@stable`, with event types). Relevant to a table: `item-press` (member of a collection chosen), `list-navigation` (arrows/Home/End moved selection; Ctrl+A), `press`, `drag`, `move-key`, `input-change`, `input-commit`, `clear-press`, `escape-key`, `reset`, `restore`, `storage-sync`, `paste`, `cut`, `undo`, `redo`, `imperative` (controller or api call), `timeout`, `first-press`/`previous-press`/`next-press`/`last-press` (pagination), `drop`, `swipe`, `scroll`, `resize` (no event), `collapse`, `focus-out`, `remove-press`, `step-key`. Custom reasons are allowed; the event type is then plain `Event`.
- Behavior reasons: `GridFocusReason = 'list-navigation'|'item-press'|'imperative'`; `CellRangeReason = ... | 'drag'`; `ReorderReason = 'drag'|'move-key'|'imperative'`; `ResizeReason = 'drag'|'resize-key'|'imperative'`; `InlineEditReason = 'edit-key'|'type'|'double-click'|'enter-key'|'escape-key'|'focus-out'|'tab-key'|'imperative'`. Declare callbacks as `ChangeDetails<ReorderReason>` so `set: (v, d) => change('order', v, d)` type-checks.

### 2.3 Commits (drags: steps are changes, end is a commit)

```ts
declare function createCommit<Options, State extends object>(
  context: PrimitiveContext<Options, State, any>, source?: (reason: string, event?: Event) => ChangeSource,
): <Key extends { [N in keyof State & string]: `on${Capitalize<N>}Commit` extends keyof Options ? N : never }[keyof State & string]>(
  key: Key, value: State[Key], details: { reason: ReasonFor<Options, Key, 'Commit'>; event?: Event; [extra: string]: unknown },
) => void
// commit callback: (value, details: CommitDetails<Reason>) with { reason, event?, source }; cannot be canceled
```

Needs `on<Key>Commit` in the options type (else `Key` is `never`), `commits: ['key']` on the definition. Usage (docs "Commits"):

```ts
const change = createChange(context); const commit = createCommit(context)
change('widths', next, { reason: 'drag', event })        // each step
commit('widths', context.store.get().widths, { reason: 'drag', event })  // at release
```

### 2.4 Related helpers

- `settleDraft(store, value: () => unknown, before: unknown, clear: () => void)` `@experimental`: keeps a controlled drag draft visible until the parent returns the committed value. The reorder example in docs uses it; our proof did not.
- `createController<Api extends object>(): Api`: handle created outside components, passed as `controller` option (kind `'value'`); methods forward to the attached instance's `api`; before attach they do nothing and return `undefined`. Detaches at destroy. Declare `controller?: TableController` in `Options`; `api` must return that shape (`ControlledBy`). Controller methods choose their own reason (`'imperative'` by convention).

---

## 3. Targeted updates (select one row, re-render one row)

Mechanism (docs "Live State" and `selects.d.ts`): every part subscribes to the instance store. A slot's `selects` narrows which changes wake its parts.

```ts
import { selects, live, direct, byCell, byCellRange } from '@ui-sdk/core'

declare function selects<State, Api, Props>(reads: {
  [Key in keyof State]?:
    | readonly Selected[]                                      // fixed values every part of the slot shares; [] = never reads this key
    | ((part: { id; key; props: Props; api: Api }) => readonly Selected[])   // values this part reads the key by
    | Reader<State[Key], { id; key; props: Props; api: Api }>  // custom: { values(part): string[]; moved(prev, next, notify): boolean | void }
})
```

Semantics (verbatim idea from the type docs):
- A key listed by values: the part is woken only when the key takes or leaves one of its values.
- A key holding an array is read by **membership**: `selected: ({ key }) => [key]` wakes a row only when its key joins or leaves the array. A key holding a plain object is read by **entry** (`values[key]`).
- A key **not listed** is read whole: any change to it wakes **every** part of the slot. So list every state key the slot's `attrs`/`state` do not read as `[]`.
- Range comparisons ("fill every star up to the rating") cannot be expressed by values; use a `Reader`.
- A key read any other way than the declared one "must not be listed: the part would miss changes."
- Whether a woken part with unchanged `attrs` actually re-renders in Vue is unconfirmed (docs say only that `state` is compared by value).

Row selection recipe (adapted from docs "Live State" seats example, not tested here):

```ts
state: () => ({ selected: [] as string[], active: null as GridCell | null, order: [] as string[] }),
slots: (slot) => ({
  row: slot<{ id: string; index: number }>({
    props: { id: 'string', index: 'number' },
    role: 'row',
    selects: selects({ selected: ({ key }) => [key], active: [], order: [] }),
    attrs: (state, { key, props }) => ({
      'aria-rowindex': String(props.index + 1),
      'aria-selected': String(state.selected.includes(key)),
      'data-selected': state.selected.includes(key) ? '' : undefined,
    }),
  }),
  cell: slot<{ id: string; row: number; col: number }>({
    props: { id: 'string', row: 'number', col: 'number' },
    role: 'gridcell', focus: 'roving',
    selects: selects({ active: byCell, selected: [] }),   // cells do not read `selected`
    // ...
  }),
})
```

Keep the **root** slot's `state` free of selection (the root's default slot re-renders when root `state` changes).
`active` per row (for a row highlight): `byCell` expects `props.row` and `props.col`, so a row slot needs a custom `Reader`, e.g. `{ values: ({ props }) => [String(props.index)], moved: (prev, next, notify) => { if (prev) notify(String(prev.row)); if (next) notify(String(next.row)) } }`. The value strings must match what `values` returns, and the exact notify-name contract of the shipped `byCell` (it returns `true | undefined` from `moved`) is unconfirmed beyond the types.

Other readers:
- `byCell`: `{ values: ({props: GridCell}) => string[]; moved(prev, next, notify) => true | undefined }`. Use `selects({ active: byCell })` on a cell slot whose props are `{ row, col }`; a move wakes the cell it leaves and the one it lands on.
- `byCellRange`: same shape for `CellRange | null`: wakes cells that join/leave the range and cells on the sides that move. Use `selects({ active: byCell, range: byCellRange })`.
- Roving focus item: `selects({ focused: ({ key }) => [key, null] })` (JSDoc of `createRovingFocus`; `null` so the group wakes when the stop resets).

`live` (attributes written straight to the element, no render):

```ts
definePrimitive({ live: ['hovered'], /* ... */ slots: (slot) => ({
  cell: slot({ live: live((state, part) => ({ 'data-hovered': state.hovered === part.key ? '' : undefined })) }),
}) })
declare function live<State, Api, Props>(read: (state: State, part: { id; key; props: Props; api: Api }) => Attrs)
```

- Keys in `live: [...]` "change often and never affect rendering". A part re-renders for a live key only when its `state` render function actually read it. `attrs` must never read live keys.
- Behavior drafts that update every pointer move should be live: docs say to "list `draft` in `live`" for `createResize` (also lasso, move, swipe). `createReorder`'s `draft` is read by `reorder.order(state)` and by `moving/dragging`, so it is not live in the docs example.

`direct` (attributes that stay in `attrs`, rendered on the server, but are patched without re-render):

```ts
item: slot<{ value: string }>({ props: { value: 'string' }, direct: direct(['hidden']),
  attrs: (state, part) => ({ hidden: matches(part.key, state.query) ? undefined : '' }) })
```

Intended for "a keystroke can hide hundreds" (docs). Candidate for column-visibility or filtered-out row `hidden`. Not tested here.

---

## 4. Behaviors

General rules (docs "Reference"): a behavior is `create<Thing>(context, options)`; rules are function options (`rows: () => number`); it returns methods you call from slot handlers; it never knows other behaviors; they meet only in `api`. All take `context` from `api`, wire through slots (`on`, `bind` returning a cleanup, pure `attrs`).

### 4.1 `createGridFocus` (`@experimental`)

```ts
import { createGridFocus, byCell, type GridCell, type GridFocus, type GridFocusOptions } from '@ui-sdk/core'
type GridCell = { row: number; col: number }               // from 0
type GridFocusOptions<State> = {
  key: keyof State & string                                // state key holding GridCell | null
  rows: () => number                                       // header rows included when they hold cells
  cols: () => number
  pageSize?: () => number                                  // default 10
  disabled?: (cell: GridCell) => boolean                   // skipped by arrows and by the pre-entry tab stop
  reveal?: (cell: GridCell) => void                        // scroll an unrendered cell in, e.g. virtual.scrollToIndex
  onMove?: (cell: GridCell, d: { from: GridCell | null; reason: GridFocusReason; event?: Event; shift: boolean }) => void
}
declare function createGridFocus<State extends object>(
  context: Pick<PrimitiveContext<any, State, any>, 'store' | 'options' | 'parts'>, options: GridFocusOptions<State>,
): {
  active(): GridCell | null
  tabIndex(state: State, cell: GridCell): '0' | '-1'       // before entry, first non-disabled cell row by row
  isActive(state: State, cell: GridCell): boolean          // keep "last active" marked after focus leaves
  placeOf(el: Element): GridCell | undefined               // element -> cell for joined cells
  bind(el: HTMLElement, cell: GridCell): () => void        // return from the cell slot's bind
  focus(cell: GridCell, d?: { reason: GridFocusReason; event?: Event; shift?: boolean }): boolean
  keydown(event: KeyboardEvent): boolean                   // arrows, Home/End, mod+Home/End, PageUp/Down; Left/Right flip in RTL
}
```

Needs: state `active: GridCell | null` initial `null`; cell parts with props `{ id, row, col }` (stable `id`); cell slot with `tabindex` from `tabIndex`, `keydown`, `pointerdown`, `bind`. Cells are addressed by numeric `row`/`col`, not DOM structure, so `thead`/`tbody`, `th`/`td` are fine (proof b: header cells are row 0 of the grid). `aria-rowindex`/`aria-colindex` are yours. `rows` must count the header row if header cells are in the grid.

```ts
cell: slot<{ id: string; row: number; col: number }>({
  props: { id: 'string', row: 'number', col: 'number' },
  role: 'gridcell', focus: 'roving',
  selects: selects({ active: byCell }),
  keys: ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','mod+Home','mod+End','PageUp','PageDown'],
  attrs: (state, { props, api }) => ({ tabindex: api.grid.tabIndex(state, props) }),
  on: {
    keydown: (event, { api }) => { api.grid.keydown(event) },
    pointerdown: (event, { api, props }) => { api.grid.focus(props, { reason: 'item-press', event }) },
  },
  bind: (el, { api, props }) => api.grid.bind(el, props),
}),
```

Gotchas: Enter/F2 on a cell does not enter a button inside it (no interaction mode; proof b). Arrow keys pressed while an inner button has focus still move the grid. With a virtualizer, focus lands "when the cell binds" so `reveal` may scroll first. Without `keep`, scrolling the focused row out drops focus to `body` and the grid has 0 tab stops (proof e).

### 4.2 `createSelection` (`@stable`) for rows

```ts
import { createSelection, type SelectionModel, type SelectionOptions } from '@ui-sdk/core'
type SelectionOptions<Key extends string, Reason extends string> = {
  key: Key                                                       // state key: string[]
  set: (value: string[], details: { reason: Reason; event?: Event }) => boolean   // wire to change(...)
  order: () => readonly string[]                                 // EVERY key in list order, including unrendered rows
  multiple?: () => boolean                                       // default false
  selectable?: (key: string) => boolean                          // skip for choose-add/toggle/range; choose/replace can still remove
}
declare function createSelection<Options, State extends object, Key extends keyof State & string, Reason extends string = ReasonFor<Options, Key>>(
  context: Pick<PrimitiveContext<Options, State, any>, 'store' | 'options' | 'onDestroy'>, options: SelectionOptions<Key, Reason>,
): {
  isSelected(key: string): boolean
  choose(key: string, why: { reason: Reason; event?: Event }): void         // only this item; moves anchor
  toggle(key: string, why): void                                            // Ctrl/Cmd+click, Space; single mode: select or clear
  extend(key: string, why & { from?: string | null; additive?: boolean }): void  // Shift range from anchor (additive default true)
  toggleAll(why): void                                                      // Ctrl+A; multiple mode only; all selectable or none
  anchor(): string | null
  setAnchor(key: string | null): void                                       // move anchor without selecting (checkbox column)
}
```

```ts
const change = createChange(context)
const selection = createSelection(context, {
  key: 'selected',
  set: (value, details) => change('selected', value, details),
  order: () => allRowIds(),                       // full list, not just rendered rows
  multiple: () => context.options().multiple ?? false,
})
// row press:  if (e.shiftKey) selection.extend(key, { reason: 'item-press', event: e, from: grid.active-row-key })
//             else if (e.metaKey || e.ctrlKey) selection.toggle(key, why) else selection.choose(key, why)
```

Gotchas: selection is always a `string[]` (even for single). It writes no ARIA; render `aria-selected` yourself. A selection set from outside (controlled value, controller) resets the anchor. The reason type defaults to what `on<Key>Change` declares.

### 4.3 `createRovingFocus` (`@stable`)

```ts
import { createRovingFocus, type RovingFocus, type RovingFocusOptions, type RovingFocusItem, type RovingFocusMoveContext } from '@ui-sdk/core'
type RovingFocusOptions<State, Props = any> = {
  slot: string                                   // the slot whose parts are the items
  key: keyof State & string                      // state key of the item key with the stop; init null
  orientation?: () => 'horizontal' | 'vertical' | 'both'   // default 'vertical'
  loop?: () => boolean
  remember?: boolean                             // default true
  disabled?: (item: RovingFocusItem<Props>) => boolean
  focusable?: (item) => boolean                  // skipped when false (e.g. collapsed tree children)
  preferred?: (item) => boolean
  claims?: (state: State, item) => boolean       // which item holds the stop before anything binds (SSR: exactly one stop)
  move?: (event: KeyboardEvent, ctx: { from; items; rtl: boolean }) => string | undefined   // custom target key
  onItemsChange?: () => void
}
declare function createRovingFocus<State extends object, Props = any>(
  context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>, options: RovingFocusOptions<State, Props>,
): {
  bind(el: HTMLElement, part: RovingFocusItem<Props>): () => void
  tabIndex(state: State, part: RovingFocusItem<Props>): '0' | '-1'
  keydown(event: KeyboardEvent, el: HTMLElement): { key: string; from: string; shift: boolean } | undefined
  items(): { key: string; props: Props; el: HTMLElement }[]       // focusable items in document order
  focus(itemKey?: string): void
  remember(itemKey: string): void
  check(): void
  stopFor(preferred: (item) => boolean): string | undefined
}
```

Table use: column header focus (proof c), or a treegrid row-level stop with `move` for tree order (docs "Any Layout"). Needs the item slot's `bind` to call `roving.bind(el, part)` and `attrs` to render `tabindex`. DOM: items must be bound elements in document order.

### 4.4 `createCellRange` (`@experimental`)

```ts
import { createCellRange, byCellRange, cellsToText, textToCells, cellRangeMessage,
         type CellRange, type CellBounds, type CellRangeOptions, type CellRangeReason } from '@ui-sdk/core'
type CellRange = { anchor: GridCell; end: GridCell }
type CellBounds = { top: number; left: number; bottom: number; right: number }     // inclusive, from 0
type CellRangeOptions<State> = {
  key: keyof State & string                  // state key: CellRange | null
  grid: GridFocus                            // the object from createGridFocus
  rows: () => number; cols: () => number
  reveal?: (cell: GridCell) => void
  set?: (range: CellRange | null, d: { reason: CellRangeReason; event?: Event }) => boolean   // default writes state; pass change(...) to report
  message?: (bounds: CellBounds) => string   // live-region announcement after keyboard selection (English default)
}
declare function createCellRange<State extends object>(
  context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>, options: CellRangeOptions<State>,
): {
  bounds(state: State): CellBounds | null        // range, else active cell alone, else null
  contains(state: State, cell: GridCell): boolean
  cellAttrs(state: State, cell: GridCell): { 'aria-selected': string; 'data-selected'?: string; 'data-range-edge'?: string }  // e.g. "top left"
  select(range: CellRange | null, d?): boolean
  selectAll(d?): boolean
  selectRows(from: number, to?: number, d?): boolean
  selectColumns(from: number, to?: number, d?): boolean
  bind(el: HTMLElement, cell: GridCell): () => void   // ALSO binds grid focus: do not call grid.bind too
  keydown(event: KeyboardEvent): boolean              // Shift+arrows/Home/End, Shift+Space rows, mod+Space columns, mod+A all, Escape clear; else forwards to grid.keydown
  pointerdown(event: PointerEvent, cell: GridCell): void   // drag-paint, auto-scroll near edges; Shift stretches
  text(state: State, read: (cell: GridCell) => string): string   // tab/newline text for copy
}
```

State: `{ active: GridCell | null; range: CellRange | null }`. Cell slot: `selects({ active: byCell, range: byCellRange })`; `attrs` spreads `...api.range.cellAttrs(state, props)`; keys list adds `shift+Arrow*`, `shift+Home/End`, `'shift+ '`, `'mod+ '`, `'mod+a'`, `'Escape'`; `on.keydown: api.range.keydown`, `on.pointerdown: api.range.pointerdown(event, props)`, `bind: api.range.bind`. Create it after `createGridFocus` and pass the same `rows`/`cols`.
Gotcha (proof d): header cells at grid row 0 are inside Ctrl+A, Shift+Space and drags; there is no option to exclude rows. Clamp in `set` or exclude the header row from the grid. The doc example sets `aria-multiselectable="true"` on the root.
Copy: handle `copy` yourself: `event.clipboardData?.setData('text/plain', range.text(state, ({ row, col }) => text(row, col)))`. `textToCells(text): string[][]` and `cellsToText(rows)` for paste.

### 4.5 `createInlineEdit` (`@experimental`; not tested in the proof)

```ts
import { createInlineEdit, type InlineEdit, type InlineEditOptions } from '@ui-sdk/core'
type InlineEditOptions<State> = {
  key: keyof State & string                      // state key: id being edited | null
  value: (id: string) => string                  // text put into the input at start
  commit: (id: string, text: string, d: { reason: InlineEditReason; event?: Event }) => boolean   // false keeps editing
  disabled?: (id: string) => boolean
}
declare function createInlineEdit<State extends object>(context: Pick<PrimitiveContext<any, State, any>, 'store'>, options: InlineEditOptions<State>): {
  editing(state: State): string | null
  start(id: string, d?: { reason: InlineEditReason; event?: Event; text?: string }): boolean
  keydown(event: KeyboardEvent, id: string): boolean        // Enter/F2 with the value, a printable char with that char
  dblclick(event: MouseEvent, id: string): boolean
  bindInput(el: HTMLInputElement | HTMLTextAreaElement): () => void   // fills + focuses; return from input slot's bind
  inputKeydown(event: KeyboardEvent): boolean               // Enter and Tab save, Escape cancels; true = handled (Tab returns true so a grid can move on)
  end(reason?: InlineEditReason, event?: Event): boolean    // save; wire to input focusout with 'focus-out'
  cancel(): void
}
```

Notes: `key` holds a single string id, so for cells use the cell `id` (e.g. `"1:2"`) as the edit id. Unchanged text ends editing without calling `commit`. Focus is restored if removing the input would lose it. Render the input where `edit.editing(state) === id`. Doc sample:

```ts
input: slot({
  on: { keydown: (e, { api }) => api.edit.inputKeydown(e), focusout: (e, { api }) => api.edit.end('focus-out', e) },
  bind: (el, { api }) => api.edit.bindInput(el as HTMLInputElement),
}),
```

Tab handling: `if (event.key === 'Tab' && edit.inputKeydown(event)) nextCell.focus()` (docs "Moving on").

### 4.6 `createReorder` (`@stable`)

```ts
import { createReorder, type Reorder, type ReorderDraft, type ReorderOptions, type ReorderOrientation } from '@ui-sdk/core'
type ReorderDraft = { key: string; keys: string[]; order: string[]; pointer: boolean }
type ReorderOptions<State, Props = any> = {
  slot: string                                    // item slot; each part joins via reorder.bind in the slot's bind
  key: keyof State & string                       // committed order: string[]
  draft: keyof State & string                     // ReorderDraft | null, init null
  set: (value: string[], d: { reason: 'drag' | 'move-key' | 'imperative'; event?: Event }) => boolean
  orientation?: () => 'horizontal' | 'vertical' | 'grid'     // default 'vertical'
  group?: (key: string) => string[]               // keys that move together
  preview?: boolean                               // drag a top-layer copy
  createAutoScroll?: Omit<AutoScrollOptions, 'onScroll' | 'ignore'> | false
  disabled?: (item: { key: string; props: Props }) => boolean
  label?: (key: string) => string | undefined     // name for screen readers
  message?: (m: ReorderMessage) => string
}
declare function createReorder<State extends object, Props = any>(context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>, options): {
  bind(el: HTMLElement, part: { key: string; props: Props }): () => void
  order(state: State): string[]                   // draft's while moving, else committed; render from this
  moving(state: State, key: string): boolean
  dragging(state: State, key: string): boolean
  keydown(event: KeyboardEvent, key: string): boolean   // Space/Enter grab+drop, arrows/Home/End move, Escape cancel, Tab cancel+move on; swallows every other key while grabbed
  pointerdown(event: PointerEvent, key: string): void   // starts after dragThreshold, so a click stays a click
  grab(key: string): boolean; moveTo(index: number): void; drop(event?: Event): void; cancel(): void
  move(key: string, index: number): boolean
}
```

Drop position comes from measured rects of the bound items. It writes `--drag-x`/`--drag-y` on the dragged element; you apply the transform. Proof c: `keydown: if (!api.reorder.keydown(event, key) && el) api.roving.keydown(event, el)`; bind both behaviors and return both cleanups. In the proof, `--drag-x` was written only on the `th`; body cells did not travel visually. A resize handle inside a reorderable `th` must `preventDefault()` its `pointerdown` (docs: a prevented pointerdown does not start a reorder); untested together.

### 4.7 `createResize` (`@experimental`)

```ts
import { createResize, resizeBox, type Resize, type ResizeBox, type ResizeDraft, type ResizeHandle, type ResizeOptions } from '@ui-sdk/core'
type ResizeBox = { x: number; y: number; width: number; height: number }
type ResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move'       // PHYSICAL compass points
type ResizeOptions<State> = {
  boxes: (state: State) => Record<string, ResizeBox>
  draft: keyof State & string                     // ResizeDraft | null; docs say list it in `live`
  set: (value: Record<string, ResizeBox>, d: { reason: 'drag' | 'resize-key' | 'imperative'; event?: Event }) => boolean
  min?: (key: string) => { width: number; height: number }      // default 1x1
  max?: (key: string) => { width: number; height: number } | undefined
  bounds?, aspect?, step?: () => number /* default 1 */, largeStep?: () => number /* default 10*step */, scale?: () => number,
  disabled?: (key: string) => boolean, label?: (key: string) => string | undefined, message?: (m: ResizeMessage) => string
}
// returns: box(state, key): ResizeBox; resizeTo(key, box, d?, handle?); resizeBy(key, handle, dx, dy, d?);
//   keydown(event, key, handle): boolean; pointerdown(event, key, handle, el); dragging(state, key): ResizeHandle | undefined;
//   boxStyle(state, key): string | undefined; style(state, key): string | undefined; handleAttrs(handle): { 'data-resize-handle': ResizeHandle; style: string }
```

There is no column-resize behavior. Proof a bridge (~17 lines): each column is a `ResizeBox` `{ x: 0, y: 0, width, height: 1 }`; `set` maps boxes back to widths; read width via `resize.box(state, key).width`; own `role="separator"` handle with `aria-valuenow/min/max/orientation` and `tabindex="0"` (`handleAttrs` gives only `data-resize-handle` and a cursor/touch-action style); the handle edge is physical, so use `isRTL(el) ? 'w' : 'e'` (arrows are physical too). `focus: 'native'` on a `<span>` triggers a dev warning; use `'tab-stop'` with `tabindex="0"`. Drag during pointer: committed value unchanged until release; Escape restores.

### 4.8 `createVirtualizer` (`@experimental`, no context)

```ts
import { createVirtualizer, type VirtualItem, type Virtualizer } from '@ui-sdk/core'
type VirtualItem = { index: number; key: string; start: number; size: number; found?: true }
createVirtualizer(o: {
  count: () => number; estimate: (index: number) => number; key?: (index: number) => string
  overscan?: number /* 4 */; horizontal?: boolean; scrollMargin?: number
  keep?: () => readonly number[]                 // indexes always rendered (focused row)
  onEnd?: () => void; endThreshold?: number /* 10 */
  findable?: (index: number) => string | readonly string[]
}): {
  items(): VirtualItem[]; size(): number; subscribe(l: () => void): () => undefined
  connect(el: HTMLElement, o?: { findable?: boolean }): () => void
  measure(index: number, el: HTMLElement | null): () => void       // ResizeObserver; corrects scrollTop
  scrollToIndex(index: number, o?: { align?: 'auto'|'start'|'center'|'end'; behavior?: ScrollBehavior }): void
  refresh(): void; findableText(index: number, el: HTMLElement | null, part?: number): () => void; reset(): void
}
```

Proof e findings: bridge with `subscribe -> store.set({ window, size })`; spacer `<tr aria-hidden>` rows with stable positional keys in every gap (`keep()` makes `items()` non-contiguous); `start` and `size()` exclude `scrollMargin` (undocumented); grid row = data index + 1 when a header row is not virtualized; `measure` writes `scrollTop` synchronously while Vue patches, which caused a jump to top when a spacer key was new. Variable heights drifted at the end (3 jumps to reach last row). A `div role=grid` with absolutely positioned rows avoids these issues. Call `refresh()` after count/order changes and `reset()` after changes that resize every row.

### 4.9 `createController`, `visibleTreeRows`

```ts
declare function createController<Api extends object>(): Api         // section 2.4

import { visibleTreeRows, type TreeItemData, type TreeRow } from '@ui-sdk/core'
type TreeItemData = { value: string; label: string; children?: TreeItemData[]; disabled?: boolean; href?: string }
type TreeRow = { item: TreeItemData; parent: string | null; level: number /* from 1 */; index: number /* from 0, among visible rows */ }
declare function visibleTreeRows(items: readonly TreeItemData[], expanded: readonly string[]): TreeRow[]
```

Pure function, no DOM. `item` is the same object you passed (children included). Input must be nested `TreeItemData` with string `value` and `label`; it is not generic over row type, so group/tree rows need mapping to this shape first (`value` = row/group id). `expanded` holds branch `value`s. An item with `children` (even `[]`) is a branch. Related: `createTreeCollection(nodes)` gives `level(key)`, `position(key) => { index, size }` (from 1, matching `aria-level`, `aria-posinset`, `aria-setsize`), `visible(expanded)`, `children`, `descendants`, `ancestors`, `parent`, `isBranch`, `keys()`, `size`; `treeDataNodes`, `treeFromPaths`.

`createTypeahead(timeout?)` returns `((key, labels: string[], current: number) => number) & { reset(); active() }`.

---

## 5. Vue layer (`@ui-sdk/vue/primitive`)

```ts
declare function createParts<P extends Primitive, const Tags extends { [S in SlotName<P>]?: string }>(primitive: P, tags: Tags): Parts<P, Tags>
// Parts = { Root: ... } & { [slot in Exclude<keyof Tags,'root'> as Pascal<slot>]: component }

declare function usePrimitive<P extends Primitive>(primitive: P, options: () => OptionsOf<P>): PrimitiveHandle<P>
type PrimitiveHandle<P> = {
  primitive: P
  instance: ReturnType<P>                  // core instance; its get() tracks nothing, read `state` in renders
  api: TypesOf<P>['api']
  readonly state: TypesOf<P>['state']      // reading in a render tracks it
  present<S extends SlotName<P>>(name: S, props?: PropsOf<P, S>): boolean
  slot<S extends SlotName<P>>(name: S, props?: PropsOf<P, S>, user?: Record<string, any>): Record<string, any>   // attrs + listeners + ref
}
declare function usePart<P extends Primitive, S extends SlotName<P>>(
  handle: P | PrimitiveHandle<P>,          // pass the primitive to use the nearest ancestor instance
  slot: S,
  slotProps?: () => PropsOf<P, S>,
  props?: () => Record<string, unknown>,   // replaces element props (default: component attrs)
  element?: string | PartElement<StateOf<P, S>>,
): (() => VNode | VNode[] | null) & { state: StateOf<P, S> }
type PartElement<State> = { tag: string; children?: (state: State) => unknown; hidden?: () => VNode; extend?: (props: Record<string, any>) => Record<string, any> }
type PartSlots<P, S> = SlotsType<{ default?: (scope: { state: StateOf<P,S> }) => VNode[]; render?: (scope: { props; state; children: FunctionalComponent }) => VNode[] }>
```

### 5.1 `createParts`

```ts
const { Root: TableRoot, Row: TableRow, Cell: TableCell } = createParts(table, { root: 'table', row: 'tr', cell: 'td' })
const { Cell: TableHeaderCell } = createParts(table, { cell: 'th' })   // second call; ignore its Root
```

- `Root` creates the instance and shares it with all parts below via Vue context. With a `root` tag it renders that element and its default slot receives `{ state }` of the root slot; without a `root` tag it renders only its children (slot has no state).
- Each part takes: the slot's `props`, the element's attributes and events (typed per tag), a default slot `({ state })` and a `#render` slot `({ props, state, children })`. A part must be inside its `Root` (otherwise it throws, per `useHandle` docs "Throws outside one").
- Root props = primitive `options` (callbacks are emits) + root slot props + element attrs.

### 5.2 Slots and slot props

- Default slot scope is `{ state }`, the slot's `state()` return (`Public`). That is the only slot prop the SDK supplies. There is no built-in per-row or per-cell scope (row object, value). In templates the `v-for` variable is in scope anyway:

```vue
<TableRoot v-slot="{ state }" :rows="rows" aria-label="Orders">
  <TableRow v-for="(r, i) in rows" :key="r.id" :id="r.id" :index="i">
    <TableCell v-for="(c, ci) in columns" :key="c.id" :id="`${i}:${ci}`" :row="i" :col="ci">{{ r[c.id] }}</TableCell>
  </TableRow>
</TableRoot>
```

- `#render` replaces the element: `<TableCell v-slot:render="{ props }"><a v-bind="props">...</a></TableCell>`. Bind `props` with `v-bind` to keep behavior; `children` is the part's own content (`<component :is="children" />`). Keep the supplied roles, ids and ARIA (a user `aria-label`, `title`, `aria-labelledby`, `aria-description`, `autocomplete`... replace the slot's; roles, `tabindex`, references and `data-slot` stay the part's).
- To give a part custom scoped slot props (e.g. `{ row, value, state }`), write the part by hand with `defineComponent` and `usePart` (section 5.5). `PartElement.children?: (state) => unknown` lets you render your own content from state (type only; unconfirmed in practice).
- User listeners run first; `preventDefault()` skips the built-in handler. Classes and styles merge; slot attrs win over component attrs.

### 5.3 `v-model:<key>` mapping

Type-level rule (`create-parts.d.ts`): for each callback `on<Name>` prop, an event `<name>` (`onValueChange` becomes `@value-change`); and for each `on<Key>Change` where `<key>` is also a prop, an event `update:<key>`, so `v-model:<key>` works for any key (`v-model:selected`, `v-model:sorting`). Plain `v-model` (`modelValue`) maps to the first of `value | checked | pressed | open | page | layout` that exists as an option with `on<Key>Change`. Requirements: declare `<key>` in the options type and schema (the proof's `col-reorder` declared only `defaultValue`, so it had `@value-change` but no `v-model:value`).
The generated emit calls the same callback the primitive reports; whether `update:<key>` is skipped when `details.canceled` is unconfirmed for `createParts`. The hand-written root in docs skips it: `if (!details.canceled) emit('update:value', value)`.

```ts
const handle = usePrimitive(table, () => ({
  selected: props.selected, defaultSelected: props.defaultSelected,
  onSelectedChange(value, details) {
    emit('selected-change', value, details)
    if (!details.canceled) emit('update:selected', value)
  },
}))
return usePart(handle, 'root', undefined, undefined, 'table')
```

(with `inheritAttrs: false`, `props: ['selected','defaultSelected']`, `emits: ['selected-change','update:selected']`, `slots: Object as PartSlots<typeof table, 'root'>`; define with `defineComponent`, even under Vapor: `<script setup vapor>` cannot call the helpers.)
Pass options as a getter so reactive props stay in sync. 
### 5.4 Generic row types for slot props

`createParts` reads an optional `generic` marker on the primitive type: `P extends { generic?: infer G extends PrimitiveGeneric }`. If present, `Root` becomes `new <A extends G['T'], B extends G['U']>(props) => ...` and parts with entries in `G['props']` become generic in `A`. Shipped components do this (e.g. Tabs):

```ts
import type { PrimitiveGeneric, WithGeneric } from '@ui-sdk/core/renderer'   // internal, not public API
interface TableGeneric extends PrimitiveGeneric {
  T: object                                   // the row type; U is a second parameter (unknown here)
  options: TableOptions<this['T']>            // options typed with the row
  state?: { root: TableRootState<this['T']> } // slot -> public state type
  props?: { row: TableRowProps<this['T']> }   // slot -> props type
  defaults?: { T?: unknown }                  // used when nothing infers T
}
export interface TablePrimitive extends WithGeneric<typeof tableBase, TableGeneric> {}
export const table = tableBase as TablePrimitive
```

Precedent: `TabsGeneric` (`T: string; options: TabsOptions<this['T'] & string>; state: { root: TabsState<T> }`) and `SelectGeneric` (`T: unknown; defaults: { T: string }; options; props: { item: SelectItemProps<T> }`). Inference of `T` from `rows` then types `v-slot="{ state }"` on Root. Unconfirmed for a user-defined primitive (nothing exercised it); `@ui-sdk/core/renderer` is documented as unstable. The simpler, public route: a hand-written wrapper component with its own generic (`defineComponent` with a generic signature or `<script setup generic="Row">`) that calls `usePrimitive`/`usePart` and exposes `{ row, state }` itself. `TypesOf<P>`, `OptionsOf<P>`, `StateOf<P,S>`, `PropsOf<P,S>` are the public type helpers. Interfaces named with `Named<T>` (kernel, not root-exported) avoid giant emitted types; unconfirmed whether declaration emit for a custom primitive hits `TS2742` on `BaseSlotProps`/`Feature`/`Listener`/`SlotProps`. Check by building the packages.

### 5.5 One primitive rendering both `th` and `td`

A slot is one element tag per `createParts` mapping. Proof b: "one slot can't render both `th` and `td`; calling `createParts` a second time with `{cell: 'th'}` works, but it is not documented". How, exactly:

```ts
// slot (single definition shared by both):
cell: slot<{ id: string; row: number; col: number; header?: boolean }>({
  props: { id: 'string', row: 'number', col: 'number', header: 'boolean' },
  role: (_state, { props }) => (props.header ? 'columnheader' : 'gridcell'),
  roles: ['columnheader', 'gridcell'],         // every role the function can return
  focus: 'roving', keys: [...], /* attrs, on, bind as in 4.1 */
}),
// parts: two createParts calls on the same primitive
export const { Root: Table, Row: TableRow, Cell: TableCell } = createParts(table, { root: 'table', row: 'tr', cell: 'td' })
export const { Cell: TableHeaderCell } = createParts(table, { cell: 'th' })   // use only Cell; do NOT use its Root
```

Both Cells find the same instance because the context is keyed by the primitive (proof: works). Render header cells as `<TableHeaderCell ... header>`. Alternatives (unconfirmed for td/th): (a) `#render` slot with `<th v-bind="props">`; (b) a hand-written part calling `usePart(table, 'cell', () => slotProps, undefined, 'th')` (tag fixed at setup). For row-level `thead`/`tbody`/`tr`/`colgroup`, mix plain elements with parts: the proof used native `<thead>`, `<tbody>`, `<colgroup>` with parts only for `tr`/`th`/`td`.
`role` in the `roles` list must match what the function returns, and the role function means the role is not static for dev-time checks (dev build checks each listed role).

---

## 6. Agent bridge

```ts
import { createAgent, agentTools, registerTools } from '@ui-sdk/vue/agent'   // re-exports @ui-sdk/core/agent
declare function createAgent(options?: {
  allow?: (step: AgentAction, ctx: { signal: AbortSignal }) => boolean | Promise<boolean>
  timeout?: number                                    // ms waiting for allow, default 5 min
}): {
  snapshot(): AgentComponent[]
  act(input: { steps: AgentStep[] }): Promise<{ ok: boolean; error?: { step: number; message: string }; steps: { step: number; ref: string; result?: unknown; changes?: AgentChange[]; gone?: string[] }[]; values: Record<string, unknown>; appeared: AgentComponent[]; open?: AgentComponent[] }>
  query(input: { text?: string; within?: string; kind?: string }): Promise<AgentComponent[] | { error: string }>
  subscribe(listener: (change: ObservedChange) => void): () => void
}
type AgentStep = { ref: string; action: string; args?: unknown[] }
type AgentAction = { ref: string; component: string; label?: string; action: string; args: unknown[]; confirm?: string }
type AgentChange = { component: string; label?: string; key: string; value: unknown }
type AgentComponent = { ref: string; component: string; label?: string; row?: string; actions: string[]; items?: { value: string; label: string }[]; text?: string[]; buttons?: string[]; pending?: boolean; error?: string; confirm?: string; offPage?: true; source?: string; [state: string]: unknown }
declare function registerTools(agent, { allow }: { allow: Allow }): () => void   // WebMCP; allow is required
```

Create once in the browser (not on the server); the bridge finds existing components and registers new ones. It has no `destroy`.

### 6.1 The `agent` key of `definePrimitive`

```ts
agent: {
  actions?: string[]                  // api method names an agent may call; dev warning for a name the api lacks
  closed?: boolean                    // value is always one of the items; unknown text refused with the real items
  items?: (api) => unknown            // items as data when not in state.items
  reveals?: boolean                   // closed items hide other components (tabs, accordion)
  shown?: (state) => boolean          // whether an agent sees it now
  secret?: boolean                    // value reads "[redacted]"
}
```

- Without `actions`, the bridge picks methods named `set<Capital>...` and the verbs `open close toggle select clear next previous first last play pause show hide expand collapse increment decrement reset submit add remove insert` (alone or followed by a capital). `keydown`, `focus`, `moveBy` are never picked. The skeleton `table.ts` has `agent: { actions: [] }`.
- **Action shape**: an action is a plain api method. A step `{ ref, action: 'sortBy', args: ['price', 'desc'] }` calls `api.sortBy('price', 'desc')`. It calls the api directly: no pointer or key simulation. Route user-visible changes through `createChange` so callbacks see `details.source === 'agent'` and can `cancel()`.
- **Arguments**: the bridge validates only a `set<Key>` action's first argument against that option's kind in the schema (`boolean` accepts only true/false; `number` accepts a number or numeric text; a custom parser kind uses its parser). All other args, including those of every custom action like `sortBy`, arrive unchecked: validate in the method and `throw new Error('No column "x". Columns: a, b, c.')`. A throw fails the step with your message and stops later steps (no rollback). A returned promise reports `"pending"`; a rejection before the step ends fails it. A canceled change does not fail the step (`ok: true`), so read `steps[].changes` and `values`.
- The snapshot exposes the state keys listed in `controlled` (default `open`, `value`, `checked`); list others there. `items` appear in the snapshot when on the page or 10 or fewer in data; longer lists via `query({ within })` (50 max per call).
- Naming: the root needs `aria-label` (or `aria-labelledby`). A `group` does not take its name from content. The step `ref` can be that label (whole-word match, case/accent-insensitive), the `c1`-style ref, an item, or the component kind. Ambiguous labels fail with the list of refs. `row` text (nearby text) helps tell cells apart.
- Components inside `data-agent-hidden` are absent; hidden by CSS/`hidden`/`aria-hidden`/closed `<details>` are skipped; `inert` regions list as `disabled`.

### 6.2 `data-agent-*` attributes (set on elements)

| Attribute | Effect |
| --- | --- |
| `data-agent-confirm="Sentence"` | The covered element and everything inside need a person: `AgentAction.confirm` carries the sentence. Without an `allow` callback the step fails "Needs a person". Do not write an `allow` that returns `true` without reading `step.confirm`. |
| `data-agent-hidden` | Contents omitted from `snapshot`/`query`; steps naming them are refused. `observe` (not `agent.subscribe`) still sees changes. |
| `data-agent-secret` | Value shows `"[redacted]"` once filled; the agent can still fill it. |
| `data-review-loc="file:line"` | Dev-only `source` field in snapshot. |

Misspelled marks warn in dev.

---

## 7. Testing

```ts
import { mount, checkPattern, checkServer, checkDirection, settle, partAttrs, partState, partPresent } from '@ui-sdk/core/testing'

declare function mount<P extends Primitive>(primitive: P, options: OptionsOf<P>, markup: string): {
  root: HTMLElement                                           // first element of the markup
  part(slot: SlotName<P>, key?: string): HTMLElement | undefined
  readonly state: StateOf instance                            // current state
  api: TypesOf<P>['api']
  changes: ObservedChange[]                                   // every accepted change with reason/source
  settled: ObservedChange[]                                   // one per commit
  announced: string[]                                         // screen-reader announcements
  keys(...names: string[]): Promise<void>                     // 'Tab', 'Shift+Tab', 'Space', 'ArrowDown', 'Control+End' style names (exact modifier spelling unconfirmed)
  type(text: string): Promise<void>
  click(el: Element): Promise<void>
  drag(el: Element, target: { to: Element } | { by: { x: number; y: number } }): Promise<void>
  hover(el: Element): Promise<void>
  settle(): Promise<void>                                     // microtasks, a timer turn, two animation frames
  unmount(): void                                             // always call
}
declare function checkPattern(root: Element, pattern: Pattern): Promise<void>   // throws one error listing every problem
declare function checkServer<P extends Primitive>(primitive: P, options: OptionsOf<P>, markup: string): string   // HTML, no DOM; throws on browser globals/clock/randomness in create/attrs/state/present
declare function checkDirection<P extends Primitive>(primitive: P, options: OptionsOf<P>, markup: string): Promise<void>
```

`mount` markup rules: "Tags that match slots become parts; their attributes supply the part props" (parsed by the slot's schema); ordinary HTML tags stay; `as="form"` picks a tag; the first element is `root`. Needs jsdom or happy-dom. In the repo, `packages/core/src/table.test.ts`:

```ts
import { mount } from '@ui-sdk/core/testing'
const view = mount(table, { rows: ['a', 'b', 'c'] }, `<root></root>`)
try { expect(view.root.getAttribute('aria-rowcount')).toBe('3') } finally { view.unmount() }
```

Grid example (adapted; markup attribute parsing for `row`/`col` number props follows the slot schema):

```ts
const view = mount(grid, { rows: 2, cols: 2 }, `<root><row id="r0"><cell id="0:0" row="0" col="0">a</cell><cell id="0:1" row="0" col="1">b</cell></row></root>`)
try {
  await view.keys('Tab', 'ArrowRight')
  expect(view.state.active).toEqual({ row: 0, col: 1 })
  expect(view.changes.at(-1)).toMatchObject({ reason: 'list-navigation', source: 'keyboard' })   // only if the move goes through createChange
} finally { view.unmount() }
```

`checkPattern` patterns (`Pattern`): `'listbox' | 'menu' | 'menubar' | 'tabs' | 'radio-group' | 'toolbar' | 'tree' | 'dialog' | 'alertdialog' | 'disclosure' | 'accordion' | 'combobox' | 'slider' | 'switch' | 'checkbox'`. **There is no `grid` or `treegrid` pattern**: grid/treegrid keyboard, roles and tab stops need our own tests. Use `checkPattern(root, 'listbox')` only for list-like pieces (e.g. a column-visibility menu: open it first; a menu check presses Enter on an item and runs its action).

```ts
const view = mount(tabs, { defaultValue: 'a' }, markup)
await checkPattern(view.root, 'tabs')    // roles, names, ids, one tab stop per composite, arrows (by aria-orientation, RTL swapped), Home/End, Escape...
```

Other helpers: `partAttrs(instance.part('cell', { id: '0:0', row: 0, col: 0 }))`, `partState(part)`, `partPresent(part)` read a part with no DOM (`const instance = table({ id: 't', rows: [] }); instance.api...; instance.destroy()`). `setPlatform('apple' | 'other')`. `globalThis.__UI_SDK_STRICT__ = true` in test setup turns every dev warning into an error. `rerenderOf(mounted)` exists in `testing/mount.d.ts` ("for this repo's tests") but is not exported from the `@ui-sdk/core/testing` entry. Framework renderer tests (`@vue/test-utils`, see `packages/vue/src/parts.test.ts`): jsdom needs `showPopover`/`hidePopover`/`getAnimations` stubs only for popups; `await settle()` for delayed work.

---

## 8. ARIA grid / treegrid

Role type (`roles.d.ts`) includes: `grid gridcell row rowgroup rowheader columnheader cell table treegrid treeitem separator`.
- **Roles go on slots** via `role`, not in `attrs`. Types reject ARIA attributes the role does not take (`aria-orientation isn't allowed on a group`). Docs inconsistency: core.md grid snippets and the "Complete Primitive" rating put `role` in `attrs`; the "Roles, Focus and Keys" section and `createGridFocus` JSDoc use the slot `role`. Use the slot `role`.
- `gridcell` is a focusable role: the slot must declare `focus`. `grid`/`treegrid` are keyed roles: the slot must declare `keys` (or `{ none: 'why' }`; the proof root used `{ none: 'Focus stays on a cell, whose keydown handles them.' }`) and a listed `keys` needs `on.keydown`. `row`, `columnheader`, `rowheader`, `cell`, `table`, `rowgroup` need neither (`columnheader` is not in the focusable list, but a cell slot with `role` fn + `roles: ['columnheader','gridcell']` and `focus: 'roving'` worked in the proof). `press` is required only for pressable roles (`treeitem`, `option`, `button`, `checkbox`...), not for `gridcell`.
- Allowed ARIA (from `ariaSupport`): `aria-rowcount`, `aria-colcount`, `aria-multiselectable`, `aria-readonly` (grid), `aria-orientation` (treegrid); on `row`: `aria-rowindex`, `aria-colindex`, `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`, `aria-selected`, `aria-activedescendant`; on `gridcell`/`columnheader`/`rowheader`: `aria-rowindex`, `aria-colindex`, `aria-rowspan`, `aria-colspan`, `aria-selected`, `aria-readonly`, `aria-required`, `aria-expanded` (gridcell, columnheader, rowheader); `aria-sort` only on `columnheader`/`rowheader`; `aria-level`/`aria-posinset`/`aria-setsize` are NOT allowed on `gridcell`.
- None of the behaviors writes `aria-rowindex`/`aria-colindex`; the proof sets them in `attrs` (rowindex = index + 1, colindex = col + 1). For virtualized rows the docs say: "use `aria-rowcount` and `aria-rowindex` for a grid" (header row counts as row 1 in the proof: `aria-rowcount = rows + 1`).
- `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` on `row` for trees: values from `visibleTreeRows` (`level` from 1, `index` from 0) or `createTreeCollection.position()`. `Waterfall` (shipped component) documents the treegrid pattern: row `role='row'` with those attributes, `aria-selected="true"` on the selected row, `rowheader` for the name cell, `gridcell` for the rest; one tab stop; Right/Left expand/collapse or move into/out of cells; Down/Up keep the column; Enter/Space select. Use it as a pattern reference (`docs/components/waterfall.md`); its internals are not a reusable behavior.
- Selection: `createCellRange.cellAttrs` returns `aria-selected` (string, present on every cell) plus `data-selected` and `data-range-edge`. Row selection via `createSelection` needs your own `aria-selected` on the `row` and `aria-multiselectable="true"` on the root.
- Edit mode: `createInlineEdit` provides Enter/F2/typing/double-click start, Enter/Tab save, Escape cancel, focus restore, and no ARIA. APG "interaction mode" (Enter moves focus into a widget inside the cell, Escape returns) is not provided (proof b). While editing, render the input inside the cell; `focus-out` saves.
- Announcements: `createCellRange`, `createReorder`, `createResize` announce through a live region (options `message`, `label`).

---

## 9. Not available in beta.13, must be built by us

- A table or data-grid component, a cell editing component (only `createInlineEdit`).
- A derived-data helper: `deriveState`/`deriveFromOptions` exist in `foundation/kernel/derive.d.ts` but are not exported from `@ui-sdk/core` or `@ui-sdk/core/renderer`. Keep our own per-stage memo inside `api` (as `CLAUDE.md` says).
- Interaction mode (Enter/F2 on a cell moving into an inner button, Escape back).
- Column resize (only 2-D box resize, physical compass handles, no ARIA, absolute-box assumption); `ResizeBox` bridge needed.
- A way to exclude header rows (or any rows) from `createCellRange`.
- Virtualizer support for `<tr>` (absolute positioning); spacer-row bridge, `scrollTop` hazard, drift for variable heights.
- A `grid`/`treegrid` pattern in `checkPattern`.
- Types not exported from the `@ui-sdk/core` root: `BaseSlotProps`, `Feature`, `Listener`, `SlotProps` (use `PropsOf`), plus `Role`, `Focus`, `HandledKey`, `Named`, `ReasonFor`. `BaseSlotProps`, `Feature`, `Listener` are only in `@ui-sdk/core/renderer`.
- Scoped slot props for rows/cells (row data, value) from `createParts`: the default slot carries only `{ state }`.
- `v-model` for any key requires the key and `on<Key>Change` in the options; plain `v-model` only for `value|checked|pressed|open|page|layout`.
- No changelog ships in either package; 13 betas in 8 days (proof). Everything table-critical except `createReorder`, `createRovingFocus`, `createSelection`, `createTypeahead` is `@experimental`: keep each behind one table behavior of ours.
- Copy/paste glue (`copy`/`paste` handlers), column pinning, sorting UI, filtering UI, pagination state: no helper (only `cellsToText`/`textToCells`, and the shipped `Pagination` component).

## 10. Proofs for the sheet behaviors (beta.13)

Each line is a test that fails first when a new UI SDK version changes the rule. Unit proofs are in `packages/core/src/proofs/`, browser proofs in `apps/docs/e2e/proofs.spec.ts` (Chromium only; Firefox and Safari are not proven).

- **P1, two reports in one turn** (`proofs/history-owner.test.ts`): the fault was real. `applyEdits` looked for the row object of an edit and dropped an edit whose object the owner had replaced, without a word, and a second value for one cell was held against the rows of the last render. Fixed at the cause: `applyEdits` finds the row by `edit.rowId` when the object is gone, and the table reads a cell that it reported in this turn from `edit/turn.ts`. After the turn the rows of the owner are the truth again.
- **P2, a range while focus moves** (`proofs/range-focus.test.ts`): `grid.focus(cell)` keeps the range of `createCellRange`, also with an event that holds Shift. The next Shift+arrow grows the range from its own end, not from the active cell. An arrow without Shift drops the range. `selectAll`, `selectRows` and `selectColumns` leave the active cell where it is, also outside the new range, so the table moves it in.
- **P3, browser events on a cell** (`e2e/proofs.spec.ts`): a `cut` event reaches a `td` with a tab index, as a `copy` does, and `preventDefault` with `clipboardData.setData` writes the clipboard. `keydown` for Control+Y and Control+D reaches the page and is cancelable. Not proven: what the browser itself does with these keys in a window with its own menus, and Command+Y on a Mac.
- **P4, a drag while rows come and go** (`e2e/proofs.spec.ts`, page `?page=proofs`): `bindDrag(root, event, ...)` on the root of the table keeps its moves and its end after the row window took the pressed row out of the page. `createAutoScroll` scrolls the frame of the table with the pointer near its edge, over the sticky footer, and `document.elementFromPoint` finds the cell under the pointer by its `aria-rowindex` and `aria-colindex`. The row of the active cell stays in the page, so the proof takes the press away from the table.
- **P5, a reader of our own for `selects`** (`proofs/reader.test.ts`): a reader is `{ values({ props }), moved(previous, next, notify) }`. `values` gives the names that a part listens to, `moved` names the parts that a change reaches, and only those parts run `attrs`. Any text is a name. The Vue half holds too (`packages/vue/src/proofs/reader.test.ts`): a part that a reader of our own wakes runs its default slot again when its `state` changed, and no other part does. So one new cell format renders one cell.
- **R8, who made a step**: `dispatch` gives back only whether a listener canceled. The table calls the listener of the owner through one of its own and reads `details.source` there, so a step of an agent says `agent` (`packages/vue/src/history.test.ts`).
- **R7, a large state key in the snapshot of an agent** (`packages/vue/src/proofs/reader.test.ts`): the assumption was wrong, as feared. `createAgent().snapshot()` holds every key of `controlled` whole: 989 kB for a table with 50,000 cell formats, at every look of an agent. So `cellFormats` is not in `controlled`. `createChange` still treats the key as controlled when the option is given (the same file proves it), so the state contract holds: `cellFormats`, `defaultCellFormats`, `onCellFormatsChange`. An agent reads a format with `getCellFormat`. `columnAggregates` is small and stays in `controlled`.
- **R11, a third role on the cell slot** (`packages/core/src/row-header.test.ts`): `role: 'rowheader'` passes the type check of `definePrimitive` and the pattern check of `@ui-sdk/core/testing` without new required state. The cell of a row number is a `th` with that role, and it is not `aria-selected`.
- **R6, the editor of a percent cell**: a decision, not a proof, pinned by a test (`packages/vue/src/sheet.test.ts`). At first a cell that shows `25%` opened with `0.25`, the value as the data holds it. The owner asked for the number of the screen: the text field now opens with `25` and reads `30` as 0.3 (`fieldText`, and `field` of `parseText` in `edit/value.ts`). A paste, a fill and a text from code still hold the value itself, so a copy and a paste between columns change no value.
- **R9, the cost of formats in every text**: holds. A table without formats pays one test for each text; the numbers are in `docs/benchmarks.md`, "Sheet, 50,000 rows".
- **A live key that a part lists with `[]` in `selects` never reaches the `live()` of that part.** `data-filling` and `data-fill-target` were never written for that reason, and only a browser showed it. A key that a part reads in `live()` is either not in the `selects` of that part, or has a reader that names the parts it changes (`byFillDraft` in `behaviors/fill.ts`, pinned in `packages/core/src/fill.test.ts`).
- **Two changes of one owner-held key in one turn**: the second `createChange` reads the state of the last render, so it would drop the first (the owner has not passed the new value yet). The same cause as P1, for a state key. `createTurnValue` of `edit/turn.ts` holds what was reported in this turn; `cellFormats` and `columnAggregates` read through it (`packages/core/src/edit/turn.test.ts`).
- **A new object for a state prop at each render is a new state.** `:column-pinning="{ start: ['product'] }"` in a template made every key press on the sheet page render the whole table (about one second with 50,000 rows). Pass a constant or a ref.
- **A part without a `value` shares one part with its siblings of the same slot.** The key of a part is `${slot}:${value}`, and two `header-row` parts without a `value` were one part with one cached Vue ref: each render bound the last header row and released the one before. With header groups and `stickyHeader`, only the last header row had a `--table-sticky-offset`, so two header rows stuck at the same place. Every header row has a `value` now (`letters`, `header-0`, ...). Pinned by "with header groups, each sticky header row stands under the one before it" in `apps/docs/e2e/columns.spec.ts`, which fails without the `value`. A new slot that renders several parts needs a `value` for each.
- **A range of whole columns through `createCellRange`**: `selectColumns(from, to)` of UI SDK selects from grid row 0 to the last row, the letters and the footer too. `createTableRange` cuts every range to the rows of the body, and a range that starts on a letter (`pointerdownColumns`, `selectWholeColumns`) is cut to whole columns of the body for the whole drag, as a range from a row number is cut to whole rows. The cell under a dragging pointer is found among the joined cells, so a letter cell is joined to the range like any cell (`range.bind`).
- `mount` of `@ui-sdk/core/testing` never passes new options, and `rerenderOf` is no runtime export. A test of rows that the owner replaces is a Vue test; the core tests of the sheet use an owner with a store beside its rows (`packages/core/src/sheet/harness.ts`).
- `createController` warns in development for each method that is called before a component attached, `subscribe` too. `createTableController` of `packages/vue` does not ask it before the first table arrived.

### Unconfirmed list (collected)

1. `update:<key>` skipped on `details.canceled` in `createParts` Roots; the exact controlled-detection rule in `createChange`.
2. Confirmed in section 10 (P5): a part woken by a reader of our own patches in Vue, and any text is a name.
3. Generic types on a custom primitive; declaration emit (`TS2742`) for exported primitives; the `'key'` prop kind.
4. `th` via `#render` or `usePart` with a dynamic tag; scoped slot props via `PartElement.children`; `mount().keys()` modifier spelling.
5. `direct()` for hiding rows; `createInlineEdit` in a grid; resize handle in a reorderable header; reorder with `createGridFocus`.

## 11. Proofs for the formulas (beta.13)

The proofs that the formulas build on, run before the engine is in the table. Unit proofs are in `packages/core/src/proofs/` and `packages/vue/src/proofs/`, browser proofs in `apps/docs/e2e/formula-proofs.spec.ts` on the hidden page `?page=formula-proofs`. That file also runs in Firefox and WebKit with `PROOF_BROWSERS=1 vp run test:e2e`, after `playwright install firefox webkit`.

- **P1, a report from a microtask after new rows** (`packages/vue/src/proofs/recalculate.test.ts`): holds. A check beside the table runs a microtask after the owner passes new rows and reports a formula cell whose row holds another value. The report comes before Vue renders the new rows, so the owner takes the result in the same flush: one render for the load and the result, not two. An owner that rounds the result or refuses it gets one report and no loop, because the same value is never reported twice in a row for one cell. Two loads in one turn give one report with the value of the last load. `editCell` throws for a refused value, so a check that reports with it catches the error.
- **P2, values and an owner-held key in one act, and an undo in the same turn** (`proofs/formula-step.test.ts`, with `cellFormats` in place of `cellFormulas`): holds for a key that the table keeps itself, and **fails for a key that the owner holds**. `createChange` compares the new value with the state of the last render, not with what it told the owner in this turn. In one turn the state is still the value before the first change, so a second change that goes back to it is "no change": `createChange` returns false and calls no listener, and the table takes the false for a refusal. An undo of a format in the turn of the format throws "The change was not taken back", and the owner keeps the format. This is a fault of `cellFormats` today. `cellFormulas` needs a way around it before slice 3: when the value of the turn and the state differ, the table tells the change itself (`dispatch` calls the listener without the comparison).
- **P3, a column with a kept value** (`proofs/computed-column.test.ts`): holds. A group by a day text keeps the order of the sort, a date range filter reads it, and a sort and a group compute each row once. The same column objects run no stage again, and new column objects run them all. An owner that changes a row object in place gets the value that was kept for that object; a new object is computed again.
- **P5, the text of a week in a browser** (`e2e/formula-proofs.spec.ts`): holds in Chromium, Firefox and WebKit. The first day of a week comes from the formula alone (`WEEKOF(d, [type])`, as the type of Excel's `WEEKNUM`), never from a locale, so `firstDayOfWeek` is no part of the proof. `Intl.DateTimeFormat#formatRange` writes one range for a week ("Nov 16 – 22, 2026", "16.–22.11.2026") and for a week across a new year ("Dec 29, 2025 – Jan 4, 2026", "29.12.2025–4.1.2026"); the spaces around the dash are thin spaces in some browsers. The offset of a zone kept by day is proven in slice 2 against the clock of the library (`formulas/zone.test.ts`).
- **P6, an error text in a number column** (`proofs/error-text.test.ts`): holds as the plan says. A number format shows `#DIV/0!` as an empty cell (`invalidValue`), and so does a CSV, which writes the text of the screen: one rule in `text()` fixes both. A sum and a mean leave it out, a count counts it. A sort compares it with the numbers as a text, so it comes before them going up and after them going down. A range filter leaves the row out, a search finds the code, a select facet lists it, and the range of the facets counts the numbers only.
- **P7, the cost with the real report and history** (`proofs/formula-cost.perf.test.ts`, `BENCH=1`): a formula is a plain function there. One edit and a report of 11 cells cost 0.2 and 0.26 ms. A report of 100,000 cells through a paste costs 162 ms, over the 100 ms of the plan, and 50,000 same-row formulas read through the values of the turn add 35 ms. A chain of 50,000 cells is 22 ms to order and 69 ms to report. The paste reads every text with `parseText`, which a report of dependents does not, so the budgets of the report are written again before slice 5, with the real path of dependents.
- **P8, the separate entry**: measured with the engine of slice 1 (`formulas-entry.test.ts` and "Size of the build" in `docs/benchmarks.md`). The glue in the main entry does not exist before slice 3, so its size is not measured.
- **P9, `=` on a keyboard where it is Shift+0** (`e2e/formula-proofs.spec.ts`): holds. The key `=` on the code `Digit0` with Shift, as a Finnish keyboard sends it, opens the editor of a sheet cell with `=`. A key of a composition (`isComposing`, or the key `Process`) opens no editor, in all three browsers. Sending a key of another layout needs the protocol of Chromium, so that half runs in Chromium only.
- **P10, a large key outside `controlled`, and a description on a cell**: the snapshot half is R7 of section 10, which holds for any name of the key. A grid cell takes `aria-description` in `attrs` and loses it again without a warning (`proofs/cell-description.test.ts`). `checkPattern` of `@ui-sdk/core/testing` has no grid pattern, so no pattern check reads a grid cell at all.
- **P4, the letters and the numbers read one function each** (read on `master` at `f96f84c`): holds for the reading, and the rule differs from the address. Every part of the row of letters reads `lettersByColumn` of `sheet/chrome.ts` through `letterOf`, and the number of a row is `rowNumber` of `table.ts`: one place each for the address mode of slice 4. Both are places of the view today, as `column-letters.test.ts` ("the letter of a column") and `row-header.test.ts` ("the number counts the rows of the pages before, and follows a sort") pin: a hidden column has no letter and the columns after it move up, a moved or pinned column takes the letter of its new place, and a column that leads has no letter. The address of the plan is a place of the document, where a hidden column keeps its letter and a column that leads has one. So slice 4 gives `lettersByColumn` a second mode, as the plan says for this case, and settles the gap that a hidden column leaves in the row of letters (A, C).
