'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

export default function ArtemisBookingFlow() {
  return (
    <div className="space-y-4 rounded-lg border p-6 bg-orange-50/50 dark:bg-orange-950/20">
      <p className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
        Book and complete your Artemis training session. When you finish, your trainer or admin will mark this step
        complete in the system.
      </p>
      <Button asChild className="bg-[#e36f1e] hover:bg-[#c75f18]">
        <Link href="/rbt/training">
          Open Artemis Training
          <ExternalLink className="w-4 h-4 ml-2" />
        </Link>
      </Button>
      <p className="text-xs text-gray-500">
        This step completes automatically when your training booking is marked attended.
      </p>
    </div>
  )
}
