/**
 * USCIS "Lists of Acceptable Documents" for Form I-9, in USCIS order.
 * The employee chooses which documents to present; never recommend or require a specific one.
 */
export const USCIS_I9_ACCEPTABLE_DOCUMENTS_URL =
  'https://www.uscis.gov/i-9-central/form-i-9-acceptable-documents'

export const I9_LIST_A: readonly string[] = [
  'U.S. Passport or U.S. Passport Card',
  'Permanent Resident Card or Alien Registration Receipt Card (Form I-551)',
  'Foreign passport that contains a temporary I-551 stamp or temporary I-551 printed notation on a machine-readable immigrant visa',
  'Employment Authorization Document that contains a photograph (Form I-766)',
  'For an individual temporarily authorized to work for a specific employer because of their status or parole: a foreign passport and Form I-94 or Form I-94A bearing the same name, with an endorsement of that status or parole that has not expired',
  'Passport from the Federated States of Micronesia (FSM) or the Republic of the Marshall Islands (RMI) with Form I-94 or Form I-94A indicating nonimmigrant admission under the Compact of Free Association',
]

export const I9_LIST_B: readonly string[] = [
  "Driver's license or ID card issued by a State or outlying possession of the United States, provided it contains a photograph or identifying information (name, date of birth, gender, height, eye color, and address)",
  'ID card issued by federal, state, or local government agencies or entities, provided it contains a photograph or identifying information (name, date of birth, gender, height, eye color, and address)',
  'School ID card with a photograph',
  "Voter's registration card",
  'U.S. Military card or draft record',
  "Military dependent's ID card",
  'U.S. Coast Guard Merchant Mariner Card',
  'Native American tribal document',
  "Driver's license issued by a Canadian government authority",
  'For persons under age 18 who are unable to present a document listed above: school record or report card; clinic, doctor, or hospital record; or day-care or nursery school record',
]

export const I9_LIST_C: readonly string[] = [
  'U.S. Social Security account number card, unless it is marked "NOT VALID FOR EMPLOYMENT", "VALID FOR WORK ONLY WITH INS AUTHORIZATION", or "VALID FOR WORK ONLY WITH DHS AUTHORIZATION"',
  'Certification of report of birth issued by the Department of State (Forms DS-1350, FS-545, FS-240)',
  'Original or certified copy of a birth certificate issued by a State, county, municipal authority, or territory of the United States bearing an official seal',
  'Native American tribal document',
  'U.S. Citizen ID Card (Form I-197)',
  'Identification Card for Use of Resident Citizen in the United States (Form I-179)',
  'Employment authorization document issued by the Department of Homeland Security',
]
