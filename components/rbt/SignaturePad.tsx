'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface SignaturePadProps {
  onSignatureComplete: (signatureDataUrl: string) => void
  disabled?: boolean
}

export default function SignaturePad({ onSignatureComplete, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = 400

    // Set drawing styles
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return
    
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const dataUrl = canvas.toDataURL('image/png')
    onSignatureComplete(dataUrl)
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-gray-300 rounded-lg bg-white p-4">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: '400px', border: '1px dashed #ccc' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={saveSignature}
          disabled={disabled || !hasSignature}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          Save Signature
        </Button>
      </div>
      <p className="text-sm text-gray-500">
        Please sign your name in the box above using your mouse or touch screen.
      </p>
    </div>
  )
}

