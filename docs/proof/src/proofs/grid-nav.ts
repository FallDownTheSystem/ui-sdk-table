import { byCell, createGridFocus, definePrimitive, selects, type GridCell } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/vue/primitive"

type GridNavOptions = { rows?: number; cols?: number; pageSize?: number }

export const gridNav = definePrimitive({
  name: "grid-nav",
  options: { rows: "number", cols: "number", pageSize: "number" },
  state: (_options: GridNavOptions) => ({ active: null as GridCell | null }),
  api: (context) => ({
    grid: createGridFocus(context, {
      key: "active",
      rows: () => context.options().rows ?? 0,
      cols: () => context.options().cols ?? 0,
      pageSize: () => context.options().pageSize ?? 10,
    }),
  }),
  slots: (slot) => ({
    root: slot({
      role: "grid",
      keys: { none: "Focus stays on a cell, whose keydown handles them." },
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
      keys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "mod+Home", "mod+End", "PageUp", "PageDown"],
      selects: selects({ active: byCell }),
      attrs: (state, { props, api }) => ({
        tabindex: api.grid.tabIndex(state, props),
        "aria-colindex": String(props.col + 1),
        "data-active": api.grid.isActive(state, props) ? "" : undefined,
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

export const { Root: NavGrid, Row: NavRow, Cell: NavCell } = createParts(gridNav, { root: "table", row: "tr", cell: "td" })
export const { Cell: NavHeaderCell } = createParts(gridNav, { cell: "th" })
