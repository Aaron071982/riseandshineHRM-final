'use client'

export default function SoftBackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Large orange blob - top left */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-orange-200/15 rounded-full blur-3xl bubble-animation" 
        style={{ transform: 'translate(-30%, -30%)' }}
      />
      
      {/* Medium blue blob - top right */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-200/15 rounded-full blur-3xl bubble-animation-delayed" 
        style={{ transform: 'translate(30%, -30%)' }}
      />
      
      {/* Medium purple blob - middle left */}
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-purple-200/12 rounded-full blur-3xl bubble-animation-delayed-2" 
        style={{ transform: 'translate(-40%, -50%)' }}
      />
      
      {/* Small pink blob - bottom right */}
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-pink-200/12 rounded-full blur-3xl bubble-animation-delayed-3" 
        style={{ transform: 'translate(30%, 30%)' }}
      />
      
      {/* Medium yellow blob - bottom left */}
      <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-yellow-200/12 rounded-full blur-3xl bubble-animation" 
        style={{ transform: 'translate(-50%, 40%)' }}
      />
      
      {/* Small green blob - middle right */}
      <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-green-200/10 rounded-full blur-2xl bubble-animation-delayed" 
        style={{ transform: 'translate(50%, 50%)' }}
      />
    </div>
  )
}
