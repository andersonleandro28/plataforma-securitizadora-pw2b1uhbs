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
 * Formats a date string (e.g. YYYY-MM-DD) into a localized DD/MM/YYYY string
 * ignoring the local timezone to prevent day shifting.
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return ''
  const str = typeof dateString === 'string' ? dateString : dateString.toISOString()
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`
  }
  return new Date(str).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/**
 * Extracts the YYYY-MM-DD portion of a date string or Date object
 * to prevent timezone shifting issues in inputs.
 */
export function toISODate(dateString: string | Date | null | undefined): string {
  if (!dateString) return ''
  const str = typeof dateString === 'string' ? dateString : dateString.toISOString()
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  return str.split('T')[0]
}
