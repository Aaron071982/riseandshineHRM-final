import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Mail, Database, Shield, Bell } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-600 via-gray-500 to-gray-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-100 text-lg">Manage system settings and configurations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Settings */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-full -mr-12 -mt-12 bubble-animation-delayed" />
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Email Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Email Provider</p>
              <p className="text-sm text-gray-600">Resend (Configured in .env)</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">From Address</p>
              <p className="text-sm text-gray-600">Set via EMAIL_FROM environment variable</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">Email templates are managed automatically by the system.</p>
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card className="border-2 border-green-200 bg-gradient-to-br from-white to-green-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-100/30 rounded-full -mr-12 -mt-12 bubble-animation-delayed-2" />
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Database Type</p>
              <p className="text-sm text-gray-600">PostgreSQL</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Connection</p>
              <p className="text-sm text-gray-600">Configured via DATABASE_URL</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">Database migrations are managed through Prisma.</p>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100/30 rounded-full -mr-12 -mt-12 bubble-animation-delayed" />
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Authentication</p>
              <p className="text-sm text-gray-600">Email-based OTP (One-Time Password)</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Session Duration</p>
              <p className="text-sm text-gray-600">7 days</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">Sessions are stored securely in the database.</p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100/30 rounded-full -mr-12 -mt-12 bubble-animation-delayed-2" />
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-600" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Email Notifications</p>
              <p className="text-sm text-gray-600">Enabled for all hiring pipeline events</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Notification Types</p>
              <p className="text-sm text-gray-600">Reach-out, Interview invites, Offers, Welcome emails</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">All emails are logged in the database for audit purposes.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-700 mb-2">Environment</p>
              <p className="text-gray-600">{process.env.NODE_ENV || 'development'}</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-2">Version</p>
              <p className="text-gray-600">Rise and Shine HRM v1.0.0</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              For detailed setup instructions, please refer to the SETUP.md and COMPLETE_SETUP_GUIDE.md files in the project root.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
