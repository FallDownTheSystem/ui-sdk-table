<script setup lang="ts">
import { Table, type ColumnDef } from 'ui-sdk-table-vue'

type Book = { id: string; title: string; author: string; year: number; price: number }

const books: Book[] = [
	{ id: 'b1', title: 'موسم الهجرة إلى الشمال', author: 'الطيب صالح', year: 1966, price: 45 },
	{ id: 'b2', title: 'رجال في الشمس', author: 'غسان كنفاني', year: 1963, price: 38.5 },
	{ id: 'b3', title: 'الأيام', author: 'طه حسين', year: 1929, price: 52 },
	{ id: 'b4', title: 'ثلاثية غرناطة', author: 'رضوى عاشور', year: 1994, price: 74 },
	{ id: 'b5', title: 'اللص والكلاب', author: 'نجيب محفوظ', year: 1961, price: 41 },
	{ id: 'b6', title: 'ذاكرة الجسد', author: 'أحلام مستغانمي', year: 1993, price: 60 },
]
const columns: ColumnDef<Book>[] = [
	{ id: 'title', header: 'العنوان', width: 170, sortable: true },
	{ id: 'author', header: 'المؤلف', width: 130 },
	{ id: 'year', header: 'السنة', width: 80, sortable: true },
	{ id: 'price', header: 'السعر', width: 100, format: 'decimal', sortable: true },
]
</script>

<template>
	<div class="demo" dir="rtl" lang="ar">
		<div class="sink-frame">
			<Table
				:rows="books"
				:columns="columns"
				:default-column-pinning="{ start: ['title'] }"
				locale="ar-EG"
				resizable
				sticky-header
				aria-label="كتب"
			/>
		</div>
	</div>
</template>
