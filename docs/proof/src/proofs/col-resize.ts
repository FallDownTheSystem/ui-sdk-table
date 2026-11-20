import {
  createChange,
  createResize,
  definePrimitive,
  isRTL,
  type ResizeBox,
  type ResizeHandle as Edge,
  type ResizeDraft,
} from "@ui-sdk/core"
import { createParts } from "@ui-sdk/vue/primitive"

export const MIN_WIDTH = 60
export const MAX_WIDTH = 400

type ColResizeOptions = {
  widths?: Record<string, number>
  onWidthsChange?: (widths: Record<string, number>) => void
}

// Bridge: a column is a ResizeBox whose only meaningful field is width.
function toBoxes(widths: Record<string, number>): Record<string, ResizeBox> {
  return Object.fromEntries(Object.entries(widths).map(([id, width]) => [id, { x: 0, y: 0, width, height: 1 }]))
}

// Bridge: createResize's compass handles are physical, so the inline-end edge is "w" in right-to-left.
const edge = (el: HTMLElement): Edge => (isRTL(el) ? "w" : "e")

export const colResize = definePrimitive({
  name: "col-resize",
  options: { widths: "value", onWidthsChange: "callback" },
  state: (options: ColResizeOptions) => ({
    boxes: toBoxes(options.widths ?? {}),
    draft: null as ResizeDraft | null,
  }),
  api: (context) => {
    const change = createChange(context)
    const resize = createResize(context, {
      boxes: (state) => state.boxes,
      draft: "draft",
      set: (value, details) => {
        const ok = change("boxes", value, details)
        if (ok) {
          context.options().onWidthsChange?.(Object.fromEntries(Object.entries(value).map(([k, b]) => [k, b.width])))
        }
        return ok
      },
      min: () => ({ width: MIN_WIDTH, height: 1 }),
      max: () => ({ width: MAX_WIDTH, height: 1 }),
      step: () => 1,
      largeStep: () => 10,
      label: (key) => `Column ${key}`,
    })
    return { resize }
  },
  slots: (slot) => ({
    root: slot({
      attrs: (state, { api }) => {
        const total = Object.keys(state.boxes).reduce((sum, key) => sum + api.resize.box(state, key).width, 0)
        return { style: `width:${total}px` }
      },
    }),
    col: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, { key, api }) => ({ style: `width:${api.resize.box(state, key).width}px` }),
    }),
    handle: slot<{ id: string; column: string; label: string }>({
      props: { id: "string", column: "string", label: "string" },
      role: "separator",
      focus: "tab-stop",
      keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
      attrs: (state, { props, api }) => ({
        ...api.resize.handleAttrs("e"),
        tabindex: "0",
        "aria-orientation": "vertical",
        "aria-label": `Resize ${props.label}`,
        "aria-valuenow": String(api.resize.box(state, props.column).width),
        "aria-valuemin": String(MIN_WIDTH),
        "aria-valuemax": String(MAX_WIDTH),
      }),
      on: {
        pointerdown: (event, { el, api, props }) => api.resize.pointerdown(event, props.column, edge(el!), el!),
        keydown: (event, { el, api, props }) => {
          api.resize.keydown(event, props.column, edge(el!))
        },
      },
    }),
  }),
})

export const {
  Root: ResizeTable,
  Col: ResizeCol,
  Handle: ResizeHandle,
} = createParts(colResize, { root: "table", col: "col", handle: "span" })
