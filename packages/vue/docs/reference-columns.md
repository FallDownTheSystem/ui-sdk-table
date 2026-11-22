# ColumnDef

Every key of a column definition, and the shapes of the state that names columns.

See [Columns](./column-definitions.md) for how they work together.

## ColumnDef

- `id` (`string`): The id of the column: a key of the state (sort, filter, widths) and of the slots `col-{id}`. Give each column an id of its own.
- `header?` (`string`): The text of the header. Defaults to the id.
- `key?` (`string`): The property that holds the cell value. Defaults to `id`.
- `value?` (`(row: Row) => unknown`): Computes the cell value. Wins over `key`.
- `columns?` (`readonly ColumnDef<Row>[]`): Child columns. A column with children is a header group and holds no cells.
- `sortable?` (`boolean`): Whether a press on the header sorts by the column: the header renders a button and gets `aria-sort`. Code can sort by any column with `sortBy`.
- `compare?` (`(a: unknown, b: unknown, rowA: Row, rowB: Row) => number`): Compares two values for the sort, ascending: a negative number puts `a` first. An empty value goes last in both directions and never reaches it. Without it, numbers, dates and texts of the locale.
- `filter?` (`FilterKind | FilterMatcher<Row>`): How a column filter matches. Without it, the shape of the filter value decides.
- `searchable?` (`boolean`): Whether the search reads this column. Defaults to true.
- `groupable?` (`boolean`): A mark for the controls of the app: whether a person may group by the column. The table groups by any column that `groupBy` names.
- `aggregate?` (`AggregateName | AggregateFn<Row>`): The total of the column in the footer and in the group rows: a built-in name, or a function of the values and the rows.
- `format?` (`FormatName`): How the cell value becomes text. Without it, the value is shown as it is.
- `formatOptions?` (`FormatOptions`): The options of the `format`, such as the decimals, the currency or the time zone.
- `width?` (`number`): The width in pixels that the column asks for. A resize by a person wins over it.
- `minWidth?` (`number`): The smallest width in pixels that a resize gives. Without it, the `columnMinWidth` option of the table.
- `maxWidth?` (`number`): The largest width in pixels that a resize gives. Without it, the `columnMaxWidth` option of the table.
- `resizable?` (`boolean`): Whether a person can resize the column. Without it, the `resizable` option of the table decides.
- `reorderable?` (`boolean`): Whether a person can move the column. Without it, the `reorderable` option of the table decides.
- `lead?` (`boolean`): The column leads the table: it stays before every other column, whatever the column order says, and it sticks to the start as soon as another column is pinned there. A column order and the pins do not hold it. For a top-level column that holds a control of its row, such as a checkbox.
- `rowHeader?` (`boolean`): The column holds the number of each row, and its cells are the row headers of the table: a screen reader says the number with each cell of the row. Such a column leads the table, as with `lead`, and it is outside every range of cells: a number is never copied, emptied or filled. A press on a number selects the cells of its row. See `rowNumberColumn`.
- `hideable?` (`boolean`): Whether the column can be hidden. Defaults to true.
- `editable?` (`boolean | ((row: Row) => boolean)`): Whether a person can edit the cells of the column, or which rows have a cell that can be edited. Without it, the `editable` option of the table decides.
- `numberKeyboard?` (`boolean`): Whether the editor of a cell asks a phone for its number keyboard (`inputmode="decimal"`): the cells of the column hold numbers. Off by default. The table holds it back where the field can hold a formula, and for a cell whose format is no number format.
- `allowFormula?` (`boolean`): With formulas: whether a cell of the column takes a text that starts with `=` as a formula. True by default for a cell that can be edited; a column that must keep such a text as its value sets false.
- `schema?` (`StandardSchemaV1`): Checks a new value before the table reports the edit. Any Standard Schema works: Zod, Valibot, ArkType. A value that the schema refuses keeps the editor open, with the message of the schema.
- `parse?` (`(text: string, row: Row) => unknown`): Makes the value of a cell from the text of the editor or of a paste. Without it, see `parseText`.
- `exportable?` (`boolean`): Whether an export holds the column. Defaults to true.
- `exportValue?` (`(row: Row) => unknown`): The value of a cell in an export, in place of the cell value and its format: for a column whose cell is a slot, or whose file value differs from the screen.
- `meta?` (`unknown`): Data of the app for the column. The table does not read it.

## FormatOptions

`formatOptions` of a column takes the options of its `format`. Every format takes the options of `CommonFormatOptions`; the formats below take their own too.

### CommonFormatOptions

- `nullValue?` (`string`): The text for `null`. Defaults to an empty text.
- `undefinedValue?` (`string`): The text for `undefined`. Defaults to an empty text.
- `emptyValue?` (`string`): The text for an empty text. Defaults to an empty text.
- `invalidValue?` (`string`): The text for a value that the format cannot read. Defaults to an empty text.
- `prefix?` (`string`): Text before the formatted value.
- `suffix?` (`string`): Text after the formatted value.
- `locale?` (`string`): Overrides `FormatContext.locale` for this column.

### NumberFormatOptions

For `integer`, `decimal` and `number`, and with the options of `currency` and `percentage`.

- `roundingMode?` (`RoundingMode`): How a number rounds: `round` (half away from zero), `ceil`, `floor` or `trunc`.
- `multiplier?` (`number`): A factor that the value is multiplied by before it is shown. 0 changes nothing.
- `style?` (`'decimal' | 'percent' | 'currency' | 'unit'`): The `style` of `Intl.NumberFormat` for `integer`, `decimal` and `number`. Defaults to `decimal`.
- `notation?` (`'standard' | 'scientific' | 'engineering' | 'compact'`): The `notation` of `Intl.NumberFormat`, such as `compact` for 1.2K.
- `compactDisplay?` (`'short' | 'long'`): With `notation: 'compact'`: `short` (1.2K) or `long` (1.2 thousand).
- `useGrouping?` (`boolean`): Whether thousands are grouped, as in 1,000. Defaults to true.
- `minimumIntegerDigits?` (`number`): The fewest digits before the decimal sign, filled with zeros.
- `minimumFractionDigits?` (`number`): The fewest decimals. Defaults to 2 for `decimal`, `number` and `currency`, and 0 for `percentage`. `integer` shows none.
- `maximumFractionDigits?` (`number`): The most decimals. Defaults to 2 for `decimal`, `number` and `currency`, and 0 for `percentage`, or the minimum when it is larger.
- `minimumSignificantDigits?` (`number`): The fewest significant digits, as in `Intl.NumberFormat`.
- `maximumSignificantDigits?` (`number`): The most significant digits, as in `Intl.NumberFormat`.

### CurrencyFormatOptions

For `currency`, with every option of `NumberFormatOptions`.

- `currency?` (`string`): The currency as an ISO 4217 code, such as `USD`. Defaults to `EUR` with `showUnit`.
- `currencyDisplay?` (`'symbol' | 'code' | 'name' | 'narrowSymbol'`): How the currency shows with `showUnit`: `symbol` (the default), `code`, `name` or `narrowSymbol`.
- `currencySign?` (`'standard' | 'accounting'`): `accounting` writes a negative amount in parentheses where the locale does so.
- `showUnit?` (`boolean`): Without it the value is formatted as a plain decimal.

### PercentageFormatOptions

For `percentage`, with every option of `NumberFormatOptions`.

- `scale?` (`'fraction' | 'percent'`): `'fraction'` (default) reads 0.25 as 25 %; `'percent'` reads 25 as 25 %.
- `showUnit?` (`boolean`): Without it the value is formatted without the % sign.

### DateFormatOptions

For `date`, `time` and `datetime`.

- `dateStyle?` (`'full' | 'long' | 'medium' | 'short'`): The length of the date, as in `Intl.DateTimeFormat`. Defaults to `medium` when no field of the date is set.
- `timeStyle?` (`'full' | 'long' | 'medium' | 'short'`): The length of the time, as in `Intl.DateTimeFormat`. Defaults to `short` when no field of the time is set.
- `weekday?` (`'long' | 'short' | 'narrow'`): The weekday, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`.
- `year?` (`'numeric' | '2-digit'`): The year, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`.
- `month?` (`'numeric' | '2-digit' | 'long' | 'short' | 'narrow'`): The month, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`.
- `day?` (`'numeric' | '2-digit'`): The day, as in `Intl.DateTimeFormat`. A field wins over `dateStyle`.
- `hour?` (`'numeric' | '2-digit'`): The hour, as in `Intl.DateTimeFormat`. A field wins over `timeStyle`.
- `minute?` (`'numeric' | '2-digit'`): The minute, as in `Intl.DateTimeFormat`. A field wins over `timeStyle`.
- `second?` (`'numeric' | '2-digit'`): The second, as in `Intl.DateTimeFormat`. A field wins over `timeStyle`.
- `hour12?` (`boolean`): Whether the clock has 12 hours. Without it, the locale decides.
- `timeZone?` (`string`): The zone of the clock that a moment shows in, such as `Europe/Paris`. A `YYYY-MM-DD` value is a day and shows that day in every zone. Without it, local time.
- `timeZoneName?` (`'long' | 'short'`): Writes the name of the zone after the time.

### RelativeTimeFormatOptions

For `relativeTime`.

- `localeMatcher?` (`'best fit' | 'lookup'`): As in `Intl.RelativeTimeFormat`. Defaults to `best fit`.
- `numeric?` (`'always' | 'auto'`): `auto` writes "yesterday" for -1 day; `always` (the default) writes "1 day ago".
- `style?` (`'long' | 'short' | 'narrow'`): The length of the words: `long` (the default), `short` or `narrow`.
- `unit?` (`RelativeTimeUnit`): The unit of the difference. Defaults to `day`.
- `calculateDifference?` (`boolean`): When false the value is already a difference in `unit`, not a point in time.
- `capitalize?` (`boolean`): Writes the first letter as a capital.
- `now?` (`number | Date`): The moment differences are measured from. Defaults to the current time.

### PeriodFormatOptions

For `period`.

- `unit?` (`PeriodUnit`): Which period the value is: the first day of a day, week, month, quarter or year, the moment of an hour, or a number of a day of the week. Defaults to `day`.
- `weekdays?` (`number`): With `unit: 'weekday'`: the type of `WEEKDAY` that gave the number, 1 (Sunday is 1, the default), 2 (Monday is 1), 3 (Monday is 0) or 11 to 17.
- `timeZone?` (`string`): With `unit: 'hour'`: the zone of the clock that the hour is shown in.

### UrlFormatOptions

For `url`.

- `url?` (`string`): One address for every cell, in place of the value.
- `text?` (`string`): One text for every cell, in place of the value.
- `openInNewTab?` (`boolean`): Whether the link opens in a new tab. Defaults to false.
- `download?` (`boolean | string`): `true` adds a bare `download` attribute; a string names the file.
- `urlSelector?` (`(row: unknown) => string`): The address of the cell, from its row.
- `textSelector?` (`(row: unknown) => string`): The text of the cell, from its row.
- `attributes?` (`Record<string, string>`): More attributes of the link. A name that is no valid attribute name is left out.

### EmailFormatOptions

For `email`.

- `asLink?` (`boolean`): Whether `linkOf` gives a `mailto:` link for the cell.
- `maskDomain?` (`boolean`): Shows the address without its domain, as `ada@...`.
- `textSelector?` (`(row: unknown) => string`): The text of the cell, from its row.

### BooleanFormatOptions

For `boolean`.

- `trueValue?` (`string`): The text for a true value. Defaults to `Yes`.
- `falseValue?` (`string`): The text for a false value. Defaults to `No`.

### TruncateFormatOptions

For `truncate`.

- `truncate?` (`number`): Maximum number of characters kept; unset or 0 keeps the whole text.
- `truncateSuffix?` (`string`): The text after a cut text. Defaults to `...`.

## SortRule

- `id` (`string`): The id of the column.
- `desc?` (`boolean`): Whether the column sorts descending. Without it, ascending.

## FilterState

- `search?` (`string`): The search text, which every column with `searchable` reads.
- `columns?` (`Readonly<Record<string, unknown>>`): The filter of each column, by column id. The shape of a value, or `filter` of the column, decides how it matches.

## PageState

- `page` (`number`): The page in view, from 1.
- `pageSize` (`number`): How many rows a page holds.

## ColumnPinning

- `start?` (`readonly string[]`): The ids of the columns that stay at the start edge, in order.
- `end?` (`readonly string[]`): The ids of the columns that stay at the end edge, in order.

## RowPinning

- `top?` (`readonly string[]`): The ids of the rows that stay above the others, in order.
- `bottom?` (`readonly string[]`): The ids of the rows that stay below the others, in order.
