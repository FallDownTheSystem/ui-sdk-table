import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Joins class names, and lets a later Tailwind class win over an earlier one
 * for the same property. The consumer app has this function at `@/lib/utils`,
 * so the registry file does not ship this copy.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs))
}
