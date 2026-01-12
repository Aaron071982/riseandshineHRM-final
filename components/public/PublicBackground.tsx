'use client'

interface PublicBackgroundProps {
  variant?: 'hero' | 'page' | 'subtle'
}

export default function PublicBackground({ variant = 'page' }: PublicBackgroundProps) {
  const isHero = variant === 'hero'
  const isSubtle = variant === 'subtle'

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Base gradient wash */}
      {isHero && (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 245, 240, 0.6) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0) 100%)',
          }}
        />
      )}

      {/* Orbs - Hero variant: more prominent */}
      {isHero && (
        <>
          {/* Large orange blob - top left */}
          <div
            className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-3xl bubble-animation"
            style={{ transform: 'translate(-30%, -30%)' }}
          />
          {/* Medium blue blob - top right */}
          <div
            className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-200/18 rounded-full blur-3xl bubble-animation-delayed"
            style={{ transform: 'translate(30%, -30%)' }}
          />
          {/* Medium purple blob - middle left */}
          <div
            className="absolute top-1/2 left-0 w-[320px] h-[320px] bg-purple-200/15 rounded-full blur-3xl bubble-animation-delayed-2"
            style={{ transform: 'translate(-40%, -50%)' }}
          />
          {/* Small pink blob - bottom right */}
          <div
            className="absolute bottom-0 right-0 w-[360px] h-[360px] bg-pink-200/12 rounded-full blur-3xl bubble-animation-delayed-3"
            style={{ transform: 'translate(30%, 30%)' }}
          />
          {/* Medium yellow blob - bottom left */}
          <div
            className="absolute bottom-0 left-1/4 w-[280px] h-[280px] bg-yellow-200/12 rounded-full blur-3xl bubble-animation"
            style={{ transform: 'translate(-50%, 40%)' }}
          />
        </>
      )}

      {/* Orbs - Page/Subtle variant: less prominent */}
      {!isHero && (
        <>
          {/* Large orange blob - top left */}
          <div
            className="absolute top-0 left-0 w-96 h-96 bg-orange-200/12 rounded-full blur-3xl bubble-animation"
            style={{ transform: 'translate(-30%, -30%)' }}
          />
          {/* Medium blue blob - top right */}
          <div
            className="absolute top-0 right-0 w-80 h-80 bg-blue-200/10 rounded-full blur-3xl bubble-animation-delayed"
            style={{ transform: 'translate(30%, -30%)' }}
          />
          {/* Medium purple blob - middle left */}
          <div
            className="absolute top-1/2 left-0 w-64 h-64 bg-purple-200/8 rounded-full blur-3xl bubble-animation-delayed-2"
            style={{ transform: 'translate(-40%, -50%)' }}
          />
          {/* Small pink blob - bottom right */}
          <div
            className="absolute bottom-0 right-0 w-72 h-72 bg-pink-200/8 rounded-full blur-3xl bubble-animation-delayed-3"
            style={{ transform: 'translate(30%, 30%)' }}
          />
          {/* Medium yellow blob - bottom left */}
          <div
            className="absolute bottom-0 left-1/4 w-56 h-56 bg-yellow-200/8 rounded-full blur-3xl bubble-animation"
            style={{ transform: 'translate(-50%, 40%)' }}
          />
          {/* Small green blob - middle right */}
          <div
            className="absolute top-1/3 right-1/4 w-48 h-48 bg-green-200/8 rounded-full blur-2xl bubble-animation-delayed"
            style={{ transform: 'translate(50%, 50%)' }}
          />
        </>
      )}

      {/* Subtle noise overlay (very light) */}
      {isHero && (
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      )}
    </div>
  )
}
