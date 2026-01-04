'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
  pdfData: string | null
}

interface Completion {
  id: string
  documentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

interface AcknowledgmentFlowProps {
  document: OnboardingDocument
  completion: Completion | undefined
  onComplete: () => void
}

export default function AcknowledgmentFlow({
  document,
  completion,
  onComplete,
}: AcknowledgmentFlowProps) {
  const { showToast } = useToast()
  const [readConfirmed, setReadConfirmed] = useState(false)
  const [agreeConfirmed, setAgreeConfirmed] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(completion?.status === 'COMPLETED')

  useEffect(() => {
    // Check if document is already completed
    if (completion?.status === 'COMPLETED') {
      setIsCompleted(true)
    }
  }, [completion])

  useEffect(() => {
    // Detect scroll to bottom
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setHasScrolledToBottom(true)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCompleted) return
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isCompleted) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const handleCanvasMouseUp = () => {
    if (isCompleted) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return

    // Save signature as base64
    const dataUrl = canvas.toDataURL()
    setSignatureData(dataUrl)
  }

  const clearSignature = () => {
    if (isCompleted) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  const handleSubmit = async () => {
    if (!readConfirmed || !agreeConfirmed || !typedName || !signatureData) {
      showToast('Please complete all required fields', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/onboarding/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          typedName,
          signatureData,
          readConfirmed,
          agreeConfirmed,
        }),
      })

      if (response.ok) {
        showToast('Acknowledgment completed successfully', 'success')
        setIsCompleted(true)
        onComplete()
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to save acknowledgment', 'error')
      }
    } catch (error) {
      console.error('Error submitting acknowledgment:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (isCompleted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-green-600 font-semibold text-lg">
              ✓ Completed on {completion?.completedAt ? new Date(completion.completedAt).toLocaleDateString() : ''}
            </div>
            <p className="text-gray-600">This document has been completed and signed.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* PDF Viewer */}
      <Card>
        <CardContent className="pt-6">
          <div
            ref={containerRef}
            className="border rounded-lg overflow-auto max-h-[600px]"
            style={{ height: '600px' }}
          >
            {document.pdfData ? (
              <iframe
                src={`data:application/pdf;base64,${document.pdfData}`}
                className="w-full h-full"
                title={document.title}
              />
            ) : document.pdfUrl ? (
              <iframe
                src={document.pdfUrl}
                className="w-full h-full"
                title={document.title}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                PDF not available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acknowledgment Form */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="read-confirmed"
                checked={readConfirmed}
                onCheckedChange={(checked) => setReadConfirmed(checked === true)}
                disabled={isCompleted}
              />
              <Label htmlFor="read-confirmed" className="cursor-pointer">
                I have read and reviewed the entire document {hasScrolledToBottom && '(✓ Scrolled to bottom)'}
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agree-confirmed"
                checked={agreeConfirmed}
                onCheckedChange={(checked) => setAgreeConfirmed(checked === true)}
                disabled={isCompleted}
              />
              <Label htmlFor="agree-confirmed" className="cursor-pointer">
                I agree to the terms and conditions stated in this document
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="typed-name">Full Name (Signature) *</Label>
            <Input
              id="typed-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Enter your full name"
              disabled={isCompleted}
            />
          </div>

          <div className="space-y-2">
            <Label>Signature *</Label>
            <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="border rounded cursor-crosshair w-full"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                style={{ touchAction: 'none' }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSignature}
                className="mt-2"
                disabled={isCompleted || !signatureData}
              >
                Clear Signature
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!readConfirmed || !agreeConfirmed || !typedName || !signatureData || loading}
            className="w-full"
          >
            {loading ? 'Processing...' : 'Sign & Complete'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

