'use client'

import { Check, User, ClipboardCheck, Calendar, Shield, FileText, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import IconChip from './IconChip'

interface WizardStepIndicatorProps {
  currentStep: number
  totalSteps: number
  steps: string[]
}

const stepIcons = [
  <User key="user" className="h-4 w-4" />,
  <ClipboardCheck key="clipboard" className="h-4 w-4" />,
  <Calendar key="calendar" className="h-4 w-4" />,
  <Shield key="shield" className="h-4 w-4" />,
  <FileText key="file" className="h-4 w-4" />,
  <CheckCircle2 key="check" className="h-4 w-4" />,
]

const stepColors: Array<'orange' | 'blue' | 'green' | 'purple'> = ['orange', 'blue', 'purple', 'green', 'orange', 'green']

export default function WizardStepIndicator({
  currentStep,
  totalSteps,
  steps,
}: WizardStepIndicatorProps) {
  return (
    <div className="w-full mb-8">
      {/* Progress Bar */}
      <div className="relative">
        <div className="absolute top-6 left-0 right-0 h-1.5 bg-gray-200 rounded-full" />
        <motion.div
          className="absolute top-6 left-0 h-1.5 bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isCompleted = stepNumber < currentStep
            const isCurrent = stepNumber === currentStep
            const icon = stepIcons[index] || <User className="h-4 w-4" />
            const color = stepColors[index] || 'orange'

            return (
              <div key={stepNumber} className="flex flex-col items-center flex-1">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white shadow-button'
                      : isCurrent
                        ? 'bg-white border-primary text-primary shadow-cardGlow'
                        : 'bg-white border-gray-300 text-gray-400'
                  }`}
                  style={
                    isCurrent
                      ? {
                          boxShadow: '0 0 20px rgba(228, 137, 61, 0.3), 0 4px 12px rgba(228, 137, 61, 0.2)',
                        }
                      : {}
                  }
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <Check className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <IconChip icon={icon} size="sm" color={isCurrent ? color : 'orange'} />
                  )}
                </motion.div>
                <div
                  className={`mt-2 text-xs text-center max-w-[100px] font-medium ${
                    isCurrent ? 'font-semibold text-primary' : 'text-gray-500'
                  }`}
                >
                  {step}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {/* Step Counter */}
      <div className="text-center mt-4 text-sm text-gray-600 font-medium">
        Step {currentStep} of {totalSteps}
      </div>
    </div>
  )
}
