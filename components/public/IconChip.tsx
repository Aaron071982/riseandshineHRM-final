'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface IconChipProps {
  icon: ReactNode
  size?: 'sm' | 'md' | 'lg'
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'
  className?: string
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

const colorClasses = {
  orange: 'bg-orange-100 text-primary',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  pink: 'bg-pink-100 text-pink-600',
  yellow: 'bg-yellow-100 text-yellow-600',
}

export default function IconChip({
  icon,
  size = 'md',
  color = 'orange',
  className = '',
}: IconChipProps) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    >
      <div className={iconSizeClasses[size]}>{icon}</div>
    </div>
  )
}
