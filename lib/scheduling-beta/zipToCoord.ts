/**
 * Minimal NYC-area zip to approximate lat/lng for scheduling beta.
 * Used for Haversine distance when RBT/client have no stored coordinates.
 * Source: approximate centers for common NY zip prefixes.
 */
const ZIP_TO_COORD: Record<string, { lat: number; lng: number }> = {
  '100': { lat: 40.7506, lng: -73.9971 },   // Manhattan
  '101': { lat: 40.7614, lng: -73.9776 },
  '102': { lat: 40.7134, lng: -74.0112 },
  '103': { lat: 40.6314, lng: -74.0914 },   // Staten Island
  '104': { lat: 40.8448, lng: -73.8648 },   // Bronx
  '105': { lat: 41.2670, lng: -73.5830 },   // Westchester
  '106': { lat: 40.9464, lng: -73.8642 },
  '107': { lat: 40.9629, lng: -73.8611 },
  '108': { lat: 40.8876, lng: -73.8351 },
  '109': { lat: 41.1115, lng: -74.0776 },
  '110': { lat: 40.7223, lng: -73.5871 },   // Long Island
  '111': { lat: 40.7704, lng: -73.9098 },   // Queens
  '112': { lat: 40.6501, lng: -73.9496 },   // Brooklyn
  '113': { lat: 40.7800, lng: -73.8443 },
  '114': { lat: 40.6734, lng: -73.7815 },
  '115': { lat: 40.6788, lng: -73.5941 },
  '116': { lat: 40.6054, lng: -73.7551 },
  '10458': { lat: 40.8626, lng: -73.8826 }, // Bronx
  '10467': { lat: 40.8674, lng: -73.8772 },
  '11201': { lat: 40.6942, lng: -73.9866 },
  '11238': { lat: 40.6782, lng: -73.9442 },
  '10001': { lat: 40.7506, lng: -73.9971 },
  '10002': { lat: 40.7158, lng: -73.9862 },
  '10003': { lat: 40.7310, lng: -73.9892 },
  '11101': { lat: 40.7423, lng: -73.9564 },
  '11354': { lat: 40.7681, lng: -73.8262 },
  '11355': { lat: 40.7684, lng: -73.8226 },
  '11356': { lat: 40.7849, lng: -73.8431 },
  '11357': { lat: 40.7754, lng: -73.8124 },
  '11358': { lat: 40.7606, lng: -73.7961 },
  '11359': { lat: 40.7906, lng: -73.7768 },
  '11360': { lat: 40.7826, lng: -73.7806 },
  '11361': { lat: 40.7681, lng: -73.7652 },
  '11362': { lat: 40.7629, lng: -73.7384 },
  '11363': { lat: 40.7764, lng: -73.7450 },
  '11364': { lat: 40.7643, lng: -73.7245 },
  '11365': { lat: 40.7474, lng: -73.7191 },
  '11366': { lat: 40.7285, lng: -73.7183 },
  '11367': { lat: 40.7262, lng: -73.8529 },
  '11368': { lat: 40.7677, lng: -73.8715 },
  '11369': { lat: 40.7674, lng: -73.8695 },
  '11370': { lat: 40.7640, lng: -73.8808 },
  '11372': { lat: 40.7516, lng: -73.8834 },
  '11373': { lat: 40.7390, lng: -73.8796 },
  '11374': { lat: 40.7303, lng: -73.8616 },
  '11375': { lat: 40.7212, lng: -73.8603 },
  '11377': { lat: 40.7446, lng: -73.9096 },
  '11378': { lat: 40.7792, lng: -73.8808 },
  '11379': { lat: 40.7769, lng: -73.8741 },
  '11411': { lat: 40.6913, lng: -73.7353 },
  '11412': { lat: 40.6957, lng: -73.7585 },
  '11413': { lat: 40.6763, lng: -73.7470 },
  '11414': { lat: 40.6598, lng: -73.8434 },
  '11415': { lat: 40.7012, lng: -73.8313 },
  '11416': { lat: 40.6808, lng: -73.8440 },
  '11417': { lat: 40.6698, lng: -73.8445 },
  '11418': { lat: 40.6765, lng: -73.8435 },
  '11419': { lat: 40.6892, lng: -73.8206 },
  '11420': { lat: 40.6783, lng: -73.8123 },
  '11421': { lat: 40.6923, lng: -73.8066 },
  '11422': { lat: 40.6512, lng: -73.7585 },
  '11423': { lat: 40.6568, lng: -73.7510 },
  '11424': { lat: 40.6070, lng: -73.7621 },
  '11425': { lat: 40.6012, lng: -73.7553 },
  '11426': { lat: 40.7401, lng: -73.7186 },
  '11427': { lat: 40.7342, lng: -73.7416 },
  '11428': { lat: 40.7284, lng: -73.7416 },
  '11429': { lat: 40.7131, lng: -73.7414 },
  '11430': { lat: 40.6510, lng: -73.7763 },
  '11432': { lat: 40.7062, lng: -73.7896 },
  '11433': { lat: 40.6983, lng: -73.7962 },
  '11434': { lat: 40.6761, lng: -73.7772 },
  '11435': { lat: 40.6615, lng: -73.7673 },
  '11436': { lat: 40.6601, lng: -73.7830 },
}

function normalizeZip(zip: string | null | undefined): string {
  if (!zip || typeof zip !== 'string') return ''
  const trimmed = zip.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 5) return digits.slice(0, 5)
  if (digits.length >= 3) return digits.slice(0, 3)
  return digits
}

export function zipToCoord(zip: string | null | undefined): { lat: number; lng: number } | null {
  const key = normalizeZip(zip)
  if (!key) return null
  return ZIP_TO_COORD[key] ?? ZIP_TO_COORD[key.slice(0, 3)] ?? null
}

/** Haversine distance in miles */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
