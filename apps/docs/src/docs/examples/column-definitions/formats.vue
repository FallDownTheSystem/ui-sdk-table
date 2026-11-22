<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Book = {
	id: string
	title: string
	author: { first: string; last: string }
	price: number
	sold: number
	share: number
	published: string
}

const books: Book[] = [
	{
		id: 'b1',
		title: 'The River Road',
		author: { first: 'Ada', last: 'Lindqvist' },
		price: 18.5,
		sold: 12480,
		share: 0.312,
		published: '2024-03-14',
	},
	{
		id: 'b2',
		title: 'Small Hours',
		author: { first: 'Tomas', last: 'Reyes' },
		price: 24,
		sold: 8120,
		share: 0.203,
		published: '2023-09-02',
	},
	{
		id: 'b3',
		title: 'Salt and Iron',
		author: { first: 'Maya', last: 'Okafor' },
		price: 15.75,
		sold: 19400,
		share: 0.485,
		published: '2025-01-20',
	},
]

const columns: ColumnDef<Book>[] = [
	{ id: 'title', header: 'Title', sortable: true },
	// A value that is not one property of the row comes from a function.
	{
		id: 'author',
		header: 'Author',
		sortable: true,
		value: (book) => `${book.author.last}, ${book.author.first}`,
	},
	{
		id: 'published',
		header: 'Published',
		sortable: true,
		format: 'date',
		formatOptions: { dateStyle: 'medium', timeZone: 'UTC' },
	},
	// A header group: one header above the columns that it holds.
	{
		id: 'sales',
		header: 'Sales',
		columns: [
			{ id: 'sold', header: 'Copies', sortable: true, format: 'integer' },
			{
				id: 'price',
				header: 'Price',
				sortable: true,
				format: 'currency',
				formatOptions: { currency: 'USD', showUnit: true },
			},
			{
				id: 'share',
				header: 'Share',
				sortable: true,
				format: 'percentage',
				formatOptions: { showUnit: true, maximumFractionDigits: 1 },
			},
		],
	},
]
</script>

<template>
	<Table :rows="books" :columns="columns" locale="en-US" aria-label="Books and their sales" />
</template>
