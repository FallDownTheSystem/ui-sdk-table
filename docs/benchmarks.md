# Benchmarks

Numbers are from one development computer (Windows 11, Node.js 26). Use them to compare one change against another on the same computer, not as absolute values.

## Row pipeline, 50,000 rows

Run it with:

```bash
BENCH=1 vp test run packages/core/src/rows/rows.perf --silent=false
```

Each value is the median of 9 runs, in milliseconds. Rows have 5 columns.

| Operation | 2026-11-20 |
| --- | --- |
| Build row nodes | 2.9 |
| Search, one keystroke | 8.3 |
| Search on sorted rows, one keystroke | 8.8 |
| Number range filter | 1.6 |
| Sort by text | 123.5 |
| Sort by number | 23.9 |
| Group by two columns, with totals | 4.8 |
| Page change on sorted rows | 0.0 |

What the numbers show:

- A page change costs nothing, because no earlier stage runs again.
- A keystroke in the search costs the same with and without a sort. The pipeline sorts before it filters, so a keystroke never sorts.
- A text sort is the most expensive operation. Its time goes to `Intl.Collator`, which gives the correct order for the locale and for numbers inside text.

## Rendering, 50,000 rows

The benchmark page of `apps/docs` (`vp run dev`, then the "50,000 rows" button) measures a full render in the browser.

| State of the table | 2026-11-20 |
| --- | --- |
| Every row rendered, no row window, plain cells | 1,438 ms |
