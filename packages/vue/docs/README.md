# ui-sdk-table-vue docs

The docs of ui-sdk-table for Vue, as Markdown. Every page here is generated from the same source as the docs site, for the commit this package came from.

Start with [llms.txt](./llms.txt): what the library is and the conventions every page shares, then an index of every page, in one file for an agent's context. Each page below has the rest.

## Get started

- [Introduction](./introduction.md): A headless table for Vue: the logic of a data table, and no looks.
- [Installation](./installation.md): Add the packages to your Vue app.
- [First table](./first-table.md): Put a table on a page and give it looks.

## Using the table

- [Columns](./column-definitions.md): Say what each column shows, how its value becomes text, and how a person can change its place and width.
- [Cells and slots](./cells-and-slots.md): Put your own content in a header, a cell, a footer or the empty table, and give rows and cells your own attributes.
- [State and events](./state-and-events.md): Start a state where you want it, hold it in your app, and hear each change with its reason.
- [Styling](./styling.md): Give the table the looks of your app with CSS that reads its parts and its state.
- [Controller and view](./controller-and-view.md): Change the table from a control beside it, and read what it shows now.
- [Sort, filter and search](./sort-filter-and-search.md): Sort by one or more columns, filter each column, and search every column with a pause in the typing.
- [Groups and totals](./groups-and-totals.md): Group the rows by the values of a column, and show a total of a column under it, for each group and for the table.
- [Pages and server mode](./pages-and-server-mode.md): Show the rows a page at a time, and take the rows, the pages, the sort and the filters from a server.
- [Rows](./rows.md): Show rows with child rows, a detail row under a row, rows pinned to an edge, and many thousand rows in a window.
- [Selection and keyboard](./selection-and-keyboard.md): Let a person select rows, and move through the table with the keys of a grid.
- [Editing](./cell-editing.md): Let a person change the value of a cell, check it first, and put it into your rows.
- [Export](./export.md): Write the rows of the table to a CSV or an Excel file, with the text that the screen shows.
- [Agents](./agents.md): Let an agent find a table on the page, read it and act on it, with the same actions that a person has.

## Data sheet

- [The sheet options](./sheet-options.md): Turn a table into a data sheet: cells that a person types into, ranges, undo and a fill handle.
- [Range, copy and paste](./range-copy-and-paste.md): Let a person select a block of cells, copy it, paste into it and read its sum.
- [Fill](./fill.md): Let a person drag the corner of a range to fill more cells, with a series where the values have one step.
- [History](./history.md): Let a person take a change back with Control+Z and put it on again with Control+Y.
- [Formats](./formats.md): Let a person make cells bold, give them a colour, or show a number as a percentage, and save that with the document.
- [Row numbers and letters](./row-numbers-and-letters.md): Give a sheet a column of row numbers and a row of column letters, where a person selects whole rows and columns.
- [Formulas](./sheet-formulas.md): Compute values with formulas as in a spreadsheet: a computed column, or a formula in one cell.
- [A formula writer](./formula-writer.md): Build a field that helps a person write a formula: suggestions of functions, a hint for the argument at the caret, references picked with the pointer or the arrow keys, and the cells of each reference in colour.
- [An Excel file with formulas](./excel-formulas.md): Download a sheet as an Excel file whose cells keep their formulas, where Excel computes them the same way.

## Build on it

- [A styled table for an app](./styled-table.md): Build the table component of your design system on the headless table: the order of the work, and for each control what the library gives and what your app writes.
- [How the table is built](./how-the-table-is-built.md): The four layers of the table, from the behaviors to the `Table` component, and which word means what.

## Reference

- [Table](./reference-table.md): Every prop, event and slot of `Table`, with the props that each slot gets.
- [ColumnDef](./reference-columns.md): Every key of a column definition, and the shapes of the state that names columns.
- [Controller](./reference-controller.md): Every method of the controller that `createTableController()` makes.
- [View](./reference-view.md): Every field of `getView()`, the plain data that the controls beside a table read.
- [Messages](./reference-messages.md): Every text that the table writes itself, for the `messages` prop.
- [Formulas](./reference-formulas.md): The types of the entry `ui-sdk-table-vue/formulas`.
- [Export](./reference-export.md): The types of `exportData` and of the entry `ui-sdk-table-vue/export`.

## Source and licence

The format of these pages, the layout of `llms.txt` and parts of the text of Introduction, Installation and First table follow the docs of UI SDK (`@ui-sdk/vue/docs`, https://ui-sdk.dev), which are licensed under the Apache License 2.0.
