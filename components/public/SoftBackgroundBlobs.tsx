'use client'

export default function SoftBackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute top-20 left-10 w-32 h-32 bg-orange-200/20 rounded-full bubble-animation" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-200/20 rounded-full bubble-animation-delayed" />
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-purple-200/20 rounded-full bubble-animation-delayed-2" />
      <div className="absolute bottom-1/3 right-1/3 w-20 h-20 bg-pink-200/20 rounded-full bubble-animation-delayed-3" />
      <div className="absolute top-1/4 right-1/4 w-28 h-28 bg-yellow-200/20 rounded-full bubble-animation" />
      <div className="absolute bottom-1/4 left-1/3 w-36 h-36 bg-green-200/20 rounded-full bubble-animation-delayed" />
    </div>
  )
}
