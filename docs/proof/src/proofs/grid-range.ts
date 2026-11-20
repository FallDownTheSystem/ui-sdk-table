import {
  byCell,
  byCellRange,
  createCellRange,
  createGridFocus,
  definePrimitive,
  selects,
  type CellRange,
  type GridCell,
} from "@ui-sdk/core"
import { createParts } from "@ui-sdk/vue/primitive"

type GridRangeOptions = { rows?: number; cols?: number }

export const gridRange = definePrimitive({
  name: "grid-range",
  options: { rows: "number", cols: "number" },
  state: (_options: GridRangeOptions) => ({ active: null as GridCell | null, range: null as CellRange | null }),
  api: (context) => {
    const rows = () => context.options().rows ?? 0
    const cols = () => context.options().cols ?? 0
    const grid = createGridFocus(context, { key: "active", rows, cols })
    const range = createCellRange(context, { key: "range", grid, rows, cols })
    return { grid, range }
  },
  slots: (slot) => ({
    root: slot<{}, { bounds: { top: number; left: number; bottom: number; right: number } | null }>({
      role: "grid",
      keys: { none: "Focus stays on a cell, whose keydown handles them." },
      attrs: () => ({ "aria-multiselectable": "true" }),
      state: (state, { api }) => ({ bounds: api.range.bounds(state) }),
    }),
    row: slot<{ id: string; index: number }>({
      props: { id: "string", index: "number" },
      role: "row",
      attrs: (_state, { props }) => ({ "aria-rowindex": String(props.index + 1) }),
    }),
    cell: slot<{ id: string; row: number; col: number; header?: boolean }>({
      props: { id: "string", row: "number", col: "number", header: "boolean" },
      role: (_state, { props }) => (props.header ? "columnheader" : "gridcell"),
      roles: ["columnheader", "gridcell"],
      focus: "roving",
      keys: [
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "mod+Home", "mod+End",
        "PageUp", "PageDown", "shift+ArrowUp", "shift+ArrowDown", "shift+ArrowLeft", "shift+ArrowRight",
        "shift+Home", "shift+End", "shift+ ", "mod+ ", "mod+a", "Escape",
      ],
      selects: selects({ active: byCell, range: byCellRange }),
      attrs: (state, { props, api }) => ({
        tabindex: api.grid.tabIndex(state, props),
        "aria-colindex": String(props.col + 1),
        ...api.range.cellAttrs(state, props),
      }),
      on: {
        keydown: (event, { api }) => {
          api.range.keydown(event)
        },
        pointerdown: (event, { api, props }) => api.range.pointerdown(event, props),
      },
      bind: (el, { api, props }) => api.range.bind(el, props),
    }),
  }),
})

export const { Root: RangeGrid, Row: RangeRow, Cell: RangeCell } = createParts(gridRange, { root: "table", row: "tr", cell: "td" })
export const { Cell: RangeHeaderCell } = createParts(gridRange, { cell: "th" })
