'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description, index }: FeatureCardProps & { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card className="h-full bg-white rounded-card border border-gray-200 shadow-sm hover:shadow-cardHover transition-all duration-250">
        <CardHeader>
          <div className="text-primary mb-3">{icon}</div>
          <CardTitle className="text-xl font-semibold text-gray-900">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base text-gray-600 leading-relaxed">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface FeatureCardsProps {
  features: FeatureCardProps[]
}

export default function FeatureCards({ features }: FeatureCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature, index) => (
        <FeatureCard key={index} {...feature} index={index} />
      ))}
    </div>
  )
}
