'use client'

import { cn } from '@/lib/utils'

const AVATAR_GRADIENTS = [
  'from-[#FFA94D] to-[#F2652A]',
  'from-[#FFB066] to-[#E7692C]',
  'from-[#F5A623] to-[#D97706]',
  'from-[#E8A87C] to-[#CE551B]',
] as const

export function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  const one = parts[0] ?? '?'
  if (one.includes('@')) return one.charAt(0).toUpperCase()
  return one.slice(0, 2).toUpperCase()
}

export function CrmAvatar({
  name,
  email,
  size = 36,
  className,
  seed,
}: {
  name?: string | null
  email?: string | null
  size?: number
  className?: string
  /** Stable hue when name is missing */
  seed?: string
}) {
  const label = name?.trim() || email?.trim() || seed || '?'
  const initials = initialsFromLabel(label)
  const idx =
    (label.charCodeAt(0) + (label.charCodeAt(1) ?? 0)) % AVATAR_GRADIENTS.length
  const grad = AVATAR_GRADIENTS[idx]

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white/80',
        `bg-gradient-to-br ${grad}`,
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size < 32 ? 10 : size < 40 ? 11 : 13,
      }}
      aria-hidden
    >
      {initials}
    </div>
  )
}
