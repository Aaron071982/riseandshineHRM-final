/**
 * Safety guard for any script that mutates the database.
 * Delegates to the shared write-script helper (prints host, refuses prod).
 */
export { assertDevTarget, assertWriteTarget } from '../lib/scripts/guard'
