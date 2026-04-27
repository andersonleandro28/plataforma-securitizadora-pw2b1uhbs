/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) to Brazilian format (DD/MM/YYYY)
 * avoiding timezone shifting issues.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const parts = datePart.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/**
 * Ensures a date string is in YYYY-MM-DD format for inputs
 */
export function toISODate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
}
