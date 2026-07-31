export const CLIENT_BOROUGH_OPTIONS = [
  'Brooklyn',
  'Bronx',
  'Queens',
  'Manhattan',
  'Staten Island',
  'Long Island',
  'Other',
  'Unset',
] as const

export type ClientBoroughOption = (typeof CLIENT_BOROUGH_OPTIONS)[number]
