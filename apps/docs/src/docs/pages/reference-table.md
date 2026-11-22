# Table

Every prop, event and slot of `Table`, with the props that each slot gets.

Props are written in camel case here; a template takes them in kebab case (`default-sort`). Each state has three members: `<key>` controls it, `default<Key>` starts it when the table holds it, and the event `<key>Change` (`@sort-change`) reports a change that `details.cancel()` can stop. `v-model:<key>` binds the first and `update:<key>`. See [State and events](./state-and-events.md).

## Props

<Members of="TableProps" />

## Events

<Members of="TableEmits" />

## Slots

A slot with a column id in its name wins over the slot without one.

<Members of="TableSlots" />

## Slot props

### HeaderSlotProps

<Members of="HeaderSlotProps" />

### CellSlotProps

<Members of="CellSlotProps" />

### EditorSlotProps

<Members of="EditorSlotProps" />

### GroupSlotProps

<Members of="GroupSlotProps" />

### GroupTotalSlotProps

<Members of="GroupTotalSlotProps" />

### FootSlotProps

<Members of="FootSlotProps" />

### RowHeaderSlotProps

<Members of="RowHeaderSlotProps" />

### LetterSlotProps

<Members of="LetterSlotProps" />

### DetailSlotProps

<Members of="DetailSlotProps" />
