export type OrgLinkedUser = {
  id: string
  name: string | null
  email: string | null
  role: string
  rbtProfile: { id: string } | null
} | null

export type OrgNodeDTO = {
  id: string
  parentId: string | null
  name: string
  title: string
  department: string | null
  subDepartment: string | null
  email: string | null
  phone: string | null
  linkedUserId: string | null
  avatarColor: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  linkedUser: OrgLinkedUser
}

export type OrgChartEdgeData = {
  editMode: boolean
}

export type OrgChartNodeData = {
  org: OrgNodeDTO
  isRoot: boolean
  editMode: boolean
  dimmed: boolean
  highlighted: boolean
  selected: boolean
  directReportsCount: number
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
}
