'use client'

import { FileQuestion } from 'lucide-react'

/** §10 — Authorizations tab deferred until secondary Artemis report is wired. */
export default function AuthorizationsTab() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center bg-white dark:bg-gray-900">
      <FileQuestion className="w-12 h-12 mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
        Authorizations coming soon
      </h3>
      <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
        Authorization utilization requires a secondary Artemis report (Phase 6). Upload Session
        Reconciliation for revenue-cycle metrics today.
      </p>
    </div>
  )
}
