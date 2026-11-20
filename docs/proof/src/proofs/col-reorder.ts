import {
  createChange,
  createReorder,
  createRovingFocus,
  definePrimitive,
  type ChangeDetails,
  type ReorderDraft,
} from "@ui-sdk/core"
import { createParts } from "@ui-sdk/vue/primitive"

type ColReorderOptions = {
  defaultValue?: string[]
  onValueChange?: (value: string[], details: ChangeDetails<"drag" | "move-key" | "imperative">) => void
}

export const colReorder = definePrimitive({
  name: "col-reorder",
  options: { defaultValue: "value", onValueChange: "callback" },
  state: (options: ColReorderOptions) => ({
    value: options.defaultValue ?? [],
    moving: null as ReorderDraft | null,
    focused: null as string | null,
  }),
  api: (context) => {
    const change = createChange(context)
    const roving = createRovingFocus(context, { slot: "header", key: "focused", orientation: () => "horizontal" })
    const reorder = createReorder(context, {
      slot: "header",
      key: "value",
      draft: "moving",
      orientation: () => "horizontal",
      set: (value, details) => change("value", value, details),
    })
    return { roving, reorder }
  },
  slots: (slot) => ({
    root: slot<{}, { order: string[] }>({
      state: (state, { api }) => ({ order: api.reorder.order(state) }),
    }),
    header: slot<{ value: string }>({
      props: { value: "string" },
      role: "columnheader",
      focus: "roving",
      keys: ["ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter", "Escape"],
      attrs: (state, part) => ({
        tabindex: part.api.roving.tabIndex(state, part),
        "aria-describedby": "reorder-help",
        "aria-roledescription": "sortable column",
        "data-moving": part.api.reorder.moving(state, part.key) ? "" : undefined,
        "data-grabbed": part.api.reorder.dragging(state, part.key) ? "" : undefined,
      }),
      on: {
        keydown: (event, { el, api, key }) => {
          if (!api.reorder.keydown(event, key) && el) api.roving.keydown(event, el)
        },
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event, key),
      },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.reorder.bind(el, part)]
        return () => cleanups.forEach((cleanup) => cleanup())
      },
    }),
  }),
})

export const { Root: ReorderTable, Header: ReorderHeader } = createParts(colReorder, { root: "table", header: "th" })
