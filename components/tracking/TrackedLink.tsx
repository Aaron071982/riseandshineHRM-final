'use client'

import Link, { LinkProps } from 'next/link'
import { trackLinkClick } from '@/lib/activity-tracker'
import { ReactNode } from 'react'

interface TrackedLinkProps extends Omit<LinkProps, 'target'> {
  children: ReactNode
  href: string
  className?: string
  onClick?: () => void
  target?: string
}

export default function TrackedLink({
  children,
  href,
  className,
  onClick,
  target,
  ...props
}: TrackedLinkProps) {
  const handleClick = () => {
    const linkText = typeof children === 'string' ? children : 'Link'
    trackLinkClick(href, linkText, {
      target: target || '_self',
    })
    onClick?.()
  }

  return (
    <Link href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
}
