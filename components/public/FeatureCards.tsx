'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import IconChip from './IconChip'

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'
  featured?: boolean
}

function FeatureCard({
  icon,
  title,
  description,
  index,
  color = 'orange',
  featured = false,
}: FeatureCardProps & { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4, rotate: featured ? 0 : 1 }}
      className={`h-full ${featured ? 'md:col-span-2 lg:col-span-1' : ''}`}
    >
      <Card
        className={`h-full bg-white rounded-card border border-gray-200 shadow-sm hover:shadow-cardHover transition-all duration-250 relative overflow-hidden ${
          featured ? 'bg-gradient-to-br from-orange-50 to-blue-50 border-primary/30' : ''
        }`}
        style={
          featured
            ? {
                background: 'linear-gradient(135deg, rgba(255, 245, 240, 0.5) 0%, rgba(227, 242, 253, 0.3) 100%)',
              }
            : {}
        }
      >
        {featured && (
          <div className="absolute top-4 right-4">
            <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
              Most Popular
            </span>
          </div>
        )}
        <CardHeader>
          <div className="mb-3">
            <IconChip icon={icon} size="md" color={color} />
          </div>
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
  features: Array<{
    icon: ReactNode
    title: string
    description: string
    color?: 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'
    featured?: boolean
  }>
  columns?: 3 | 4
}

export default function FeatureCards({ features, columns = 3 }: FeatureCardsProps) {
  const gridCols = columns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  
  return (
    <div className={`grid ${gridCols} gap-6`}>
      {features.map((feature, index) => (
        <FeatureCard key={index} {...feature} index={index} />
      ))}
    </div>
  )
}
