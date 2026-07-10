export const COMPANY_NAME = 'Rise & Shine ABA LLC'
export const COMPANY_ADDRESS = 'New York, NY'
export const HR_CONTACT_NAME = 'HR Department'
export const HR_CONTACT_EMAIL_PHONE = 'info@riseandshine.nyc'
export const HR_SIGNATORY_NAME = 'Human Resources'
export const HR_SIGNATORY_TITLE = 'HR Manager'
export const DEFAULT_EHR_SYSTEM = 'Artemis / practice management system'

export const TERMINATION_REASON_LABELS: Record<string, string> = {
  PERFORMANCE: 'Performance',
  CONDUCT: 'Conduct',
  ATTENDANCE: 'Attendance',
  POLICY_VIOLATION: 'Policy Violation',
  RESTRUCTURING: 'Restructuring',
  END_OF_ASSIGNMENT: 'End of Assignment',
  VOLUNTARY: 'Voluntary',
  OTHER: 'Other',
}

export const OFFBOARDING_TASK_LABELS: Record<string, string> = {
  DISABLE_HRM_ACCESS: 'Disable HRM / portal login',
  REVOKE_PHI_EHR_ACCESS: 'Revoke EHR / PHI access',
  DISABLE_EMAIL_SSO: 'Disable email + SSO',
  COLLECT_PROPERTY: 'Collect company property',
  REASSIGN_CLIENTS: 'Reassign active clients / cancel sessions',
  NOTIFY_SUPERVISOR: 'Notify supervising BCBA of caseload change',
  REMOVE_FROM_ROSTER: 'Remove from active roster & scheduling matrix',
  CONFIRM_OPEN_NOTES: 'Confirm no open documentation / session notes',
  ISSUE_195_6_NOTICE: 'Issue §195(6) written termination notice',
  ISSUE_IA_12_3: 'Provide Form IA 12.3 (unemployment insurance)',
  TRIGGER_COBRA: 'Trigger COBRA / benefits continuation (within 30 days)',
  PROCESS_FINAL_PAY: 'Process final pay by scheduled date',
  FILE_DOCUMENTS: 'File all documents in confidential personnel file',
}

export const ALL_OFFBOARDING_TASK_TYPES = Object.keys(OFFBOARDING_TASK_LABELS)
