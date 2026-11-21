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

| Operation | 2026-11-20 | 2026-11-20 cloud, with the omit stage and detail rows | 2026-11-21 cloud, with manual stages |
| --- | --- | --- | --- |
| Build row nodes | 2.9 | 6.9 | 6.4 |
| Search, one keystroke | 8.3 | 18.0 | 14.0 |
| Search on sorted rows, one keystroke | 8.8 | 21.7 | 19.7 |
| Number range filter | 1.6 | 2.4 | 1.9 |
| Sort by text | 123.5 | 228.9 | 190.2 |
| Sort by number | 23.9 | 48.1 | 37.8 |
| Group by two columns, with totals | 4.8 | 10.4 | 8.7 |
| Page change on sorted rows | 0.0 | 0.0 | 0.0 |
| Pin one row, all rows listed | not measured | 2.5 | 2.4 |
| Open a detail row, all rows listed | not measured | 1.6 | 5.3 |

What the numbers show:

- A page change costs nothing, because no earlier stage runs again.
- A keystroke in the search costs the same with and without a sort. The pipeline sorts before it filters, so a keystroke never sorts.
- A pinned row and an open detail row cost one pass over the rows. No row is sorted or filtered again.
- The manual stages of the server-side mode add one check to the sort, filter and page stages. No number of the last column is higher for that reason.
- The value for an open detail row is 5.3 in the last column and 1.6 in the column before it. The code of that path is the same in both: the commit of the earlier column gives 5.5 on the same computer on 2026-11-21, so the 1.6 was a value from a faster moment of the cloud machine, not a faster program.
- A text sort is the most expensive operation. Its time goes to `Intl.Collator`, which gives the correct order for the locale and for numbers inside text.

## Rendering, 50,000 rows

The benchmark page of `apps/docs` (`vp run dev`, then the "50,000 rows" button) measures a full render in the browser.

| State of the table | 2026-11-20 | 2026-11-20 cloud |
| --- | --- | --- |
| Every row rendered, no row window, plain cells | 1,438 ms | not measured |
| Row window, 50,000 rows replace 10,000 rows, until the second frame | not measured | 55 to 74 ms |
| Row window, the frame scrolls by 900 pixels, until the second frame | not measured | 33 ms (median), 39 ms (slowest of 60) |

The row window page of `apps/docs` (`?page=window`) gives the two row window numbers. Each measurement ends at the second animation frame after the change, so 33 ms is the lowest value that it can give at 60 frames in one second. With a row window, the number of rows in the page does not depend on the number of rows in the data: 22 to 31 `tr` elements for 10,000 rows and for 50,000 rows.
