# ColumnDef

Every key of a column definition, and the shapes of the state that names columns.

See [Columns](./column-definitions.md) for how they work together.

## ColumnDef

<Members of="ColumnDef" />

## FormatOptions

`formatOptions` of a column takes the options of its `format`. Every format takes the options of `CommonFormatOptions`; the formats below take their own too.

### CommonFormatOptions

<Members of="CommonFormatOptions" />

### NumberFormatOptions

For `integer`, `decimal` and `number`, and with the options of `currency` and `percentage`.

<Members of="NumberFormatOptions" />

### CurrencyFormatOptions

For `currency`, with every option of `NumberFormatOptions`.

<Members of="CurrencyFormatOptions" />

### PercentageFormatOptions

For `percentage`, with every option of `NumberFormatOptions`.

<Members of="PercentageFormatOptions" />

### DateFormatOptions

For `date`, `time` and `datetime`.

<Members of="DateFormatOptions" />

### RelativeTimeFormatOptions

For `relativeTime`.

<Members of="RelativeTimeFormatOptions" />

### PeriodFormatOptions

For `period`.

<Members of="PeriodFormatOptions" />

### UrlFormatOptions

For `url`.

<Members of="UrlFormatOptions" />

### EmailFormatOptions

For `email`.

<Members of="EmailFormatOptions" />

### BooleanFormatOptions

For `boolean`.

<Members of="BooleanFormatOptions" />

### TruncateFormatOptions

For `truncate`.

<Members of="TruncateFormatOptions" />

## SortRule

<Members of="SortRule" />

## FilterState

<Members of="FilterState" />

## PageState

<Members of="PageState" />

## ColumnPinning

<Members of="ColumnPinning" />

## RowPinning

<Members of="RowPinning" />
