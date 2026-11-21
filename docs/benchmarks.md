# Benchmarks

Each column is from one computer. Use the numbers to compare one change against another on the same computer, not as absolute values.

- The column `2026-11-20` is from a development computer (Windows 11, Node.js 26).
- The columns with `cloud` in the name are from a cloud Linux machine, which is about two times slower. The difference between a `cloud` column and the first column is the computer, not the code.

## Row pipeline, 50,000 rows

Run it with:

```bash
BENCH=1 vp test run packages/core/src/rows/rows.perf --silent=false
```

Each value is the median of 9 runs, in milliseconds. Rows have 5 columns.

| Operation | 2026-11-20 | 2026-11-20 cloud, with the omit stage and detail rows | 2026-11-21 cloud, with manual stages | 2026-11-21 cloud, with day bounds in the time zone of the column | 2026-11-21 cloud under load, the code of the column before | 2026-11-21 cloud under load, with facet stages and group parents | 2026-11-21 cloud, with the function of a total chosen at run time / the code of `6bd796c` in the same minute |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build row nodes | 2.9 | 6.9 | 6.4 | 6.3 | 9.9 | 9.5 | 8.0 / 8.6 |
| Search, one keystroke | 8.3 | 18.0 | 14.0 | 15.2 | 21.6 | 20.8 | 20.6 / 26.3 |
| Search on sorted rows, one keystroke | 8.8 | 21.7 | 19.7 | 18.5 | 48.8 | 45.5 | 28.8 / 46.8 |
| Number range filter | 1.6 | 2.4 | 1.9 | 1.8 | 3.1 | 2.8 | 2.5 / 3.3 |
| Sort by text | 123.5 | 228.9 | 190.2 | 186.4 | 328.3 | 323.1 | 297.5 / 306.3 |
| Sort by number | 23.9 | 48.1 | 37.8 | 38.9 | 86.6 | 79.6 | 60.4 / 73.6 |
| Group by two columns, with totals | 4.8 | 10.4 | 8.7 | 9.0 | 17.7 | 18.6 | 12.6 / 13.4 |
| Page change on sorted rows | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 / 0.0 |
| Pin one row, all rows listed | not measured | 2.5 | 2.4 | 2.2 | 3.8 | 4.2 | 3.0 / 3.3 |
| Open a detail row, all rows listed | not measured | 1.6 | 5.3 | 4.8 | 8.8 | 8.5 | 6.9 / 7.6 |
| Facet values of a column, all rows | not measured | not measured | not measured | not measured | not measured | 3.0 | 3.1 / 2.9 |
| Search keystroke, then facet values of a column | not measured | not measured | not measured | not measured | not measured | 23.4 | 20.9 / 23.5 |
| Facet range after a filter on another column | not measured | not measured | not measured | not measured | not measured | 4.4 | 3.6 / 4.3 |
| Search keystroke, then facet values of a column that filters | not measured | not measured | not measured | not measured | not measured | 31.5 | 27.3 / 29.8 |
| Facet rows after a new filter of the column itself | not measured | not measured | not measured | not measured | not measured | 0.0 | 0.0 / 0.0 |

What the numbers show:

- A page change costs nothing, because no earlier stage runs again.
- A keystroke in the search costs the same with and without a sort. The pipeline sorts before it filters, so a keystroke never sorts.
- A pinned row and an open detail row cost one pass over the rows. No row is sorted or filtered again.
- The manual stages of the server-side mode add one check to the sort, filter and page stages. No number of that column is higher for that reason.
- The last column has the filter stage that takes the bounds of a day in the time zone of the column, and the value key that facets, select filters and groups share. The zone is read one time for each filter, not for each row, so the number range filter and the search cost the same as before.
- The value for an open detail row is 5.3 in the last column and 1.6 in the column before it. The code of that path is the same in both: the commit of the earlier column gives 5.5 on the same computer on 2026-11-21, so the 1.6 was a value from a faster moment of the cloud machine, not a faster program.
- The last two columns are from one minute on the cloud machine while another job used it, so both are slower than the columns before them. They are the pair to compare: the code of the commit `c6709bc`, and the code with a stage for the facets of each column, with the group above each group, and with one function for the totals of the footer, of a group and of an export. No stage that existed before is slower.
- The facets of a column are counted when a control asks for them. A column without a filter of its own counts the rows that the table shows, so a keystroke in the search filters one time, for the table, and the count adds about 3 ms. A column that filters leaves its own filter out, which is one more pass over the rows: about 10 ms more for one keystroke. A new value of the filter of the column itself keeps the rows of its facets, and costs nothing.
- The last column holds two runs of one minute: the code with a total whose function a person chooses at run time (`columnAggregates`), and the code before it. The aggregate stage asks one more question for each column, which function it has now, and not for each row: "Group by two columns, with totals" is 12.6 against 13.4, inside the spread of the runs. No other stage changed.
- A text sort is the most expensive operation. Its time goes to `Intl.Collator`, which gives the correct order for the locale and for numbers inside text.

## Sheet, 50,000 rows

Run it with:

```bash
BENCH=1 vp test run packages/core/src/sheet/sheet.perf --silent=false
```

Each value is the median of 9 runs, in milliseconds, with a turn between the runs. The table has 50,000 rows of 5 columns and renders no cell, so the numbers are the work of the table itself. A block is 10,000 rows by 5 columns, 50,000 cells.

| Operation | 2026-11-21 cloud, the code of `4d4e397` | 2026-11-21 cloud, with the writer, the history and the sheet keys | 2026-11-21 cloud, with the fill, the summary, the totals at run time and the cell formats |
| --- | --- | --- | --- |
| Paste of 50,000 cells, history off | 40.3 (39.2 to 44.1 in 5 runs) | 44.7 (41.5 to 49.2 in 5 runs) | 46.1 |
| Two pastes of 50,000 cells in one turn | not measured | 91.7 | 95.4 |
| Paste of 50,000 cells, history on (records a step) | not measured | 46.8 | 51.9 |
| Undo of a step of 50,000 cells | not measured | 70.4 | 55.2 |
| Redo of a step of 50,000 cells | not measured | 67.2 | 53.3 |
| Clear of 50,000 cells (Delete), with its step | not measured | 35.6 | 36.7 |
| Paste of 2 by 5 cells that repeats over 50,000 cells | not measured | 43.3 | 44.1 |
| `getView` with a selection of 50,000 cells, first call | not measured | 0.17 | 0.19 |
| `getView` with the same selection, again | not measured | 0.02 | 0.02 |
| `applyEdits`, 50,000 edits on 50,000 rows | not measured | 7.2 | 7.7 |
| `applyEdits`, the same edits on rows that were replaced | not measured | 8.9 | 11.1 |
| Fill down of 49,999 cells from one line, with its step | not measured | not measured | 44.3 |
| Fill down of 49,998 cells as a series from two lines | not measured | not measured | 51.5 |
| Summary of 250,000 selected cells, first ask | not measured | not measured | 27.6 |
| Summary of the same selection, again | not measured | not measured | 0.01 |
| `setFormats`, one format for 50,000 cells of one column | not measured | not measured | 14.3 |
| `setFormats`, a second property on the same 50,000 cells | not measured | not measured | 38.3 |
| `setFormats`, a whole column over 50,000 cell formats | not measured | not measured | 44.8 |
| `formatCells`, 50,000 cells (10,000 rows by 5 columns), with its step | not measured | not measured | 3.3 |
| Undo of that format step | not measured | not measured | 0.19 |
| `formatCells`, a whole column of 50,000 rows | not measured | not measured | 2.7 |
| Change of the function of a total, then the totals | not measured | not measured | 4.9 |
| The same with 25 groups, then the totals of each group | not measured | not measured | 21.3 |
| Export of 250,000 texts, no cell format | not measured | not measured | 93.3 (85.1 in a second run; the code of `6bd796c`: 91.5, 90.0, 90.4) |
| Export of 250,000 texts, one column with a format | not measured | not measured | 116.3 (124.8) |
| Export of 250,000 texts, 49,999 cells with a format of their own | not measured | not measured | 147.1 (137.1) |

What the numbers show:

- The paste went from `pasteText` in `table.ts` to the writer of `behaviors/write.ts`, and reads each value through the values of the turn. It costs about 4 ms more for 50,000 cells, which is inside the spread of the runs on this computer. Most of the time of a paste is the parse of 50,000 texts.
- The history costs about 2 ms for a step of 50,000 cells: one small object for each cell. A step holds ids and values and no row object.
- An undo builds 50,000 edits from the rows of now and reports them. The number holds the owner of the measurement, which puts each value into a `Map`; the table's part is about the time of a paste.
- A second report in one turn reads the values of the first report from a map that is built at that moment. Two pastes in one turn cost the time of two pastes.
- The selection in `getView` counts the data rows of the range one time for each range, and is free after that.
- `applyEdits` finds a row by its object first. When the owner replaced the objects already, as at the second report of one turn, it finds the rows by id in a second pass, which costs about 2 ms for 50,000 rows.
- A fill is a write as a paste is: the values of the source go through the schema of each column, and one report holds every cell. A fill of a whole column costs the time of a paste of as many cells. A series costs about 7 ms more for 50,000 cells: each value is counted from the step.
- The summary of a selection is counted when it is asked for, and not while a range grows. 250,000 cells cost about 28 ms the first time, and nothing after that until the selection or the rows change. `useSelectionSummary` asks after the selection rests for 100 ms, so a drag over many rows counts one time.
- **A format for 50,000 cells holds 3 objects, not 50,000.** `setFormats` gives every cell that had the same format before the same object after: the value is one record with 50,000 keys (the row ids), and all of them point to one row object, which points to one format object. The same holds in the state of the table (the line with 10,000 rows by 5 columns: 10,000 keys, 2 objects). A second property on cells that share one format is one new format object again. As JSON, such a value is one short entry for each row, so an app that saves formats of many rows should format the column, not the cells: a whole column is one entry (`formatCells(patch, { columns })`, or a selection that holds every row of the table).
- A format step in the history holds the value before and the value after, which share every object that did not change. Its undo is 0.19 ms for 50,000 cells, because the value before comes back whole when nothing else changed since.
- A change of the function of a total runs the aggregate stage again and no other stage: about 5 ms for 50,000 rows, and about 21 ms with the totals of 25 groups.
- A table without cell formats pays one test for each text. The export of 250,000 texts costs the same as before the formats (85 to 93 ms against 90 to 92 ms). With formats in the table, each text finds its format by row id and column id first: about 25 to 55 ms more for 250,000 texts, which is 0.1 to 0.2 microseconds for a cell. The format of a column and the format of a cell are merged one time for each pair of objects, not for each cell.

## Size of the build

`vp pack src/index.ts src/export/index.ts --platform neutral --minify` in `packages/core`, without `@ui-sdk/core`, which is a peer.

| Code | Minified | Compressed (gzip) |
| --- | --- | --- |
| `4d4e397`, before the sheet behaviors | 116.0 kB | 40.9 kB |
| `6bd796c`, with the writer, the history, the sheet keys, clear and cut | 128.3 kB | 45.2 kB |
| With row numbers, the fill, the summary, the totals at run time and the cell formats | 154.4 kB | 53.9 kB |

The sheet behaviors are options of the table primitive and not plugins, so a table without them carries them: 38.4 kB minified, 13.0 kB compressed. The plan of the sheet behaviors estimated under 6 kB; that estimate was wrong by a factor of six. `definePrimitive` has static `state`, `slots` and `selects`, so a behavior cannot add a slot or a state key from outside, and a split into plugins is no small change. The export writers stay in their own entry (13.4 kB), which a table without an export does not load.

## Rendering, 50,000 rows

The benchmark page of `apps/docs` (`vp run dev`, then the "50,000 rows" button) measures a full render in the browser.

| State of the table | 2026-11-20 | 2026-11-20 cloud |
| --- | --- | --- |
| Every row rendered, no row window, plain cells | 1,438 ms | not measured |
| Row window, 50,000 rows replace 10,000 rows, until the second frame | not measured | 55 to 74 ms |
| Row window, the frame scrolls by 900 pixels, until the second frame | not measured | 33 ms (median), 39 ms (slowest of 60) |

The row window page of `apps/docs` (`?page=window`) gives the two row window numbers. Each measurement ends at the second animation frame after the change, so 33 ms is the lowest value that it can give at 60 frames in one second. With a row window, the number of rows in the page does not depend on the number of rows in the data: 22 to 31 `tr` elements for 10,000 rows and for 50,000 rows.
