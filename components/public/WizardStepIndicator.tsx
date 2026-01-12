'use client'

import { Check } from 'lucide-react'

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
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200" />
        <div
          className="absolute top-5 left-0 h-1 bg-primary transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isCompleted = stepNumber < currentStep
            const isCurrent = stepNumber === currentStep

            return (
              <div key={stepNumber} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-primary border-primary text-white'
                      : isCurrent
                        ? 'bg-white border-primary text-primary'
                        : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{stepNumber}</span>
                  )}
                </div>
                <div
                  className={`mt-2 text-xs text-center max-w-[100px] ${
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
      <div className="text-center mt-4 text-sm text-gray-600">
        Step {currentStep} of {totalSteps}
      </div>
    </div>
  )
}
