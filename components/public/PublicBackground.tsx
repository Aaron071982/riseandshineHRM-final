'use client'

interface PublicBackgroundProps {
  variant?: 'hero' | 'page' | 'subtle'
}

export default function PublicBackground({ variant = 'page' }: PublicBackgroundProps) {
  const isHero = variant === 'hero'
  const isSubtle = variant === 'subtle'

  // Large blob shapes
  const blobs = [
    { top: '10%', left: '-5%', size: '500px', color: 'rgba(255, 159, 90, 0.06)', delay: 0 },
    { top: '60%', right: '-8%', size: '600px', color: 'rgba(99, 179, 237, 0.05)', delay: 0.2 },
    { top: '30%', right: '15%', size: '400px', color: 'rgba(163, 123, 235, 0.04)', delay: 0.4 },
  ]

  // Medium orbs
  const orbs = [
    { top: '15%', left: '20%', size: '200px', color: 'rgba(255, 159, 90, 0.08)', delay: 0 },
    { top: '45%', left: '10%', size: '150px', color: 'rgba(99, 179, 237, 0.07)', delay: 0.1 },
    { top: '70%', left: '25%', size: '180px', color: 'rgba(163, 123, 235, 0.06)', delay: 0.2 },
    { top: '25%', right: '25%', size: '160px', color: 'rgba(255, 159, 90, 0.06)', delay: 0.3 },
    { top: '55%', right: '15%', size: '140px', color: 'rgba(99, 179, 237, 0.08)', delay: 0.4 },
    { top: '80%', right: '30%', size: '170px', color: 'rgba(163, 123, 235, 0.05)', delay: 0.5 },
    { top: '10%', left: '50%', size: '120px', color: 'rgba(255, 159, 90, 0.07)', delay: 0.6 },
    { top: '35%', left: '45%', size: '130px', color: 'rgba(99, 179, 237, 0.06)', delay: 0.7 },
    { top: '65%', left: '50%', size: '110px', color: 'rgba(163, 123, 235, 0.07)', delay: 0.8 },
  ]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      {/* Base gradient mesh */}
      <div
        className="absolute inset-0"
        style={{
          background: isSubtle
            ? '#fafafa'
            : 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)',
        }}
      />

      {/* Gradient overlays */}
      {!isSubtle && (
        <>
          {/* Top-left warm orange */}
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at 0% 0%, rgba(255, 159, 90, ${isHero ? 0.14 : 0.08}) 0%, transparent 50%)`,
            }}
          />
          {/* Bottom-right soft blue */}
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at 100% 100%, rgba(99, 179, 237, ${isHero ? 0.12 : 0.07}) 0%, transparent 50%)`,
            }}
          />
          {/* Mid-right soft purple */}
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at 85% 40%, rgba(163, 123, 235, ${isHero ? 0.10 : 0.06}) 0%, transparent 45%)`,
            }}
          />
        </>
      )}

      {/* Large blob shapes */}
      {!isSubtle &&
        blobs.map((blob, index) => (
          <div
            key={`blob-${index}`}
            className="absolute rounded-full blur-[120px]"
            style={{
              width: blob.size,
              height: blob.size,
              top: blob.top,
              left: blob.left,
              right: blob.right,
              backgroundColor: blob.color,
              animation: `fadeIn ${0.8 + blob.delay}s ease-out`,
            }}
          />
        ))}

      {/* Medium orbs */}
      {!isSubtle &&
        orbs.map((orb, index) => (
          <div
            key={`orb-${index}`}
            className="absolute rounded-full blur-[80px]"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              right: orb.right,
              backgroundColor: orb.color,
              animation: `fadeIn ${0.6 + orb.delay}s ease-out`,
            }}
          />
        ))}

      {/* Subtle noise overlay */}
      {!isSubtle && (
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-soft-light"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
