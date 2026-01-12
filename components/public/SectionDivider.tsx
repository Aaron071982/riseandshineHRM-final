'use client'

interface SectionDividerProps {
  variant?: 'gradient' | 'wave'
}

export default function SectionDivider({ variant = 'gradient' }: SectionDividerProps) {
  if (variant === 'wave') {
    return (
      <div className="w-full h-16 overflow-hidden relative">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ transform: 'scaleY(-1)' }}
        >
          <path
            d="M0,0 C150,80 350,80 600,40 C850,0 1050,80 1200,40 L1200,120 L0,120 Z"
            fill="rgba(228, 137, 61, 0.03)"
          />
        </svg>
      </div>
    )
  }

  return (
    <div
      className="w-full h-px"
      style={{
        background: 'linear-gradient(90deg, rgba(228, 137, 61, 0.05) 0%, rgba(255, 159, 90, 0.02) 50%, transparent 100%)',
      }}
    />
  )
}
