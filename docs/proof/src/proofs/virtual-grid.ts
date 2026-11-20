import {
  byCell,
  createGridFocus,
  createVirtualizer,
  definePrimitive,
  selects,
  type GridCell,
  type VirtualItem,
} from "@ui-sdk/core"
import { createParts } from "@ui-sdk/vue/primitive"

export const ROW_HEIGHT = 24
export const HEADER_HEIGHT = 24

type VirtualGridOptions = {
  count?: number
  cols?: number
  variable?: boolean
  keepFocused?: boolean
}

export const virtualGrid = definePrimitive({
  name: "virtual-grid",
  options: { count: "number", cols: "number", variable: "boolean", keepFocused: "boolean" },
  state: (_options: VirtualGridOptions) => ({
    active: null as GridCell | null,
    window: [] as VirtualItem[],
    size: 0,
  }),
  api: (context) => {
    const count = () => context.options().count ?? 0
    const virtual = createVirtualizer({
      count,
      estimate: () => (context.options().variable ? 40 : ROW_HEIGHT),
      key: (index) => `row-${index}`,
      overscan: 4,
      scrollMargin: HEADER_HEIGHT,
      keep: () => {
        const active = context.store.get().active
        return context.options().keepFocused && active && active.row > 0 ? [active.row - 1] : []
      },
    })
    const grid = createGridFocus(context, {
      key: "active",
      rows: () => count() + 1,
      cols: () => context.options().cols ?? 0,
      pageSize: () => 10,
      // Bridge: grid row 0 is the header, which is not virtualized.
      reveal: ({ row }) => {
        if (row > 0) virtual.scrollToIndex(row - 1)
      },
    })
    const sync = () => context.store.set({ window: virtual.items(), size: virtual.size() })
    return { grid, virtual, sync }
  },
  slots: (slot) => ({
    root: slot<{}, { window: VirtualItem[]; size: number }>({
      state: (state) => ({ window: state.window, size: state.size }),
      bind: (el, { api }) => {
        const disconnect = api.virtual.connect(el)
        const unsubscribe = api.virtual.subscribe(api.sync)
        api.sync()
        return () => {
          disconnect()
          unsubscribe()
        }
      },
    }),
    table: slot({
      role: "grid",
      keys: { none: "Focus stays on a cell, whose keydown handles them." },
    }),
    row: slot<{ id: string; index: number; measure?: boolean }>({
      props: { id: "string", index: "number", measure: "boolean" },
      role: "row",
      attrs: (_state, { props }) => ({ "aria-rowindex": String(props.index + 1) }),
      bind: (el, { api, props }) => (props.measure && props.index > 0 ? api.virtual.measure(props.index - 1, el) : undefined),
    }),
    cell: slot<{ id: string; row: number; col: number; header?: boolean }>({
      props: { id: "string", row: "number", col: "number", header: "boolean" },
      role: (_state, { props }) => (props.header ? "columnheader" : "gridcell"),
      roles: ["columnheader", "gridcell"],
      focus: "roving",
      keys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "mod+Home", "mod+End", "PageUp", "PageDown"],
      selects: selects({ active: byCell }),
      attrs: (state, { props, api }) => ({
        tabindex: api.grid.tabIndex(state, props),
        "aria-colindex": String(props.col + 1),
      }),
      on: {
        keydown: (event, { api }) => {
          api.grid.keydown(event)
        },
        pointerdown: (event, { api, props }) => {
          api.grid.focus(props, { reason: "item-press", event })
        },
      },
      bind: (el, { api, props }) => api.grid.bind(el, props),
    }),
  }),
})

export const {
  Root: VirtualScroller,
  Table: VirtualTable,
  Row: VirtualRow,
  Cell: VirtualCell,
} = createParts(virtualGrid, { root: "div", table: "table", row: "tr", cell: "td" })
export const { Cell: VirtualHeaderCell } = createParts(virtualGrid, { cell: "th" })
