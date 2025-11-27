import AddRBTForm from '@/components/admin/AddRBTForm'

export default function NewRBTPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Add New RBT / Candidate</h1>
        <p className="text-gray-600 mt-1">Create a new candidate profile</p>
      </div>
      <AddRBTForm />
    </div>
  )
}

