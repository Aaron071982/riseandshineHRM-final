'use client'

import { Check } from 'lucide-react'
import { motion } from 'framer-motion'

interface WizardStepIndicatorProps {
  currentStep: number
  totalSteps: number
  steps: string[]
}

export default function WizardStepIndicator({
  currentStep,
  totalSteps,
  steps,
}: WizardStepIndicatorProps) {
  return (
    <div className="w-full mb-8">
      {/* Progress Bar */}
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-1.5 bg-gray-200 rounded-full" />
        <motion.div
          className="absolute top-5 left-0 h-1.5 bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isCompleted = stepNumber < currentStep
            const isCurrent = stepNumber === currentStep

            return (
              <div key={stepNumber} className="flex flex-col items-center flex-1">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-primary border-primary text-white shadow-button'
                      : isCurrent
                        ? 'bg-white border-primary text-primary shadow-md'
                        : 'bg-white border-gray-300 text-gray-400'
                  }`}
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
                    <span className="text-sm font-semibold">{stepNumber}</span>
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
