'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, Paperclip, X, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ApplicationData } from './types'

interface ApplicationStepFilesProps {
  data: ApplicationData
  setData: React.Dispatch<React.SetStateAction<ApplicationData>>
  onFileChange: (field: 'resume' | 'idDocument' | 'rbtCertificate' | 'cprCard', file: File | null) => void
}

export default function ApplicationStepFiles({ data, onFileChange }: ApplicationStepFilesProps) {
  const handleFileChange = (field: 'resume' | 'idDocument' | 'rbtCertificate' | 'cprCard', file: File | null) => {
    onFileChange(field, file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-gray-900">Resume & Documents</h2>
        <p className="text-gray-600">Please upload your resume and any relevant documents.</p>
      </div>
      <div className="space-y-6">
        <div>
          <Label htmlFor="resume">Resume * (PDF, DOC, or DOCX, max 10MB)</Label>
          <div className="mt-2">
            <label
              htmlFor="resume"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-card bg-gray-50 hover:bg-gray-100 hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-primary transition-colors" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, or DOCX (MAX. 10MB)</p>
              </div>
              <input
                id="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileChange('resume', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {data.resume && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 bg-white border border-gray-200 rounded-input flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{data.resume.name}</p>
                    <p className="text-xs text-gray-500">{(data.resume.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFileChange('resume', null)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              </motion.div>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="idDocument">Government-issued ID * (PDF, JPG, PNG, HEIC, or WEBP, max 10MB)</Label>
          <div className="mt-2">
            <label
              htmlFor="idDocument"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-card bg-gray-50 hover:bg-gray-100 hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-primary transition-colors" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF, JPG, PNG, HEIC, or WEBP (MAX. 10MB)</p>
              </div>
              <input
                id="idDocument"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                onChange={(e) => handleFileChange('idDocument', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {data.idDocument && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 bg-white border border-gray-200 rounded-input flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{data.idDocument.name}</p>
                    <p className="text-xs text-gray-500">{(data.idDocument.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFileChange('idDocument', null)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              </motion.div>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="rbtCertificate">RBT Certificate (Optional)</Label>
          <div className="mt-2">
            <Input
              id="rbtCertificate"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
              onChange={(e) => handleFileChange('rbtCertificate', e.target.files?.[0] || null)}
            />
            {data.rbtCertificate && (
              <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{data.rbtCertificate.name}</span>
              </div>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="cprCard">CPR/First Aid Card (Optional)</Label>
          <div className="mt-2">
            <Input
              id="cprCard"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
              onChange={(e) => handleFileChange('cprCard', e.target.files?.[0] || null)}
            />
            {data.cprCard && (
              <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{data.cprCard.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
