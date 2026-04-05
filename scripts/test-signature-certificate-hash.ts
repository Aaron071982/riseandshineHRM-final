/**
 * Verifies SHA-256 document hashing matches Node.js crypto (same logic as lib/signature-certificate).
 * Run: npx tsx scripts/test-signature-certificate-hash.ts
 */
import crypto from 'crypto'
import { sha256DocumentPdfSource } from '../lib/signature-certificate'

async function main() {
  // Tiny PDF-like bytes (content arbitrary; hash must be deterministic)
  const testBytes = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
  )
  const expectedHex = crypto.createHash('sha256').update(testBytes).digest('hex')
  const expectedPrefixed = `sha256:${expectedHex}`

  const base64 = testBytes.toString('base64')
  const result = await sha256DocumentPdfSource({ pdfData: base64, pdfUrl: null })

  console.log('Expected:', expectedPrefixed)
  console.log('Got:     ', result.documentHash)

  if (result.documentHash === expectedPrefixed) {
    console.log('\nPASS: sha256DocumentPdfSource matches crypto.createHash("sha256").update(buffer).digest("hex")')
  } else {
    console.error('\nFAIL: hash mismatch')
    process.exit(1)
  }

  // Empty / no source
  const empty = await sha256DocumentPdfSource({ pdfData: null, pdfUrl: null })
  if (empty.documentHash !== 'unavailable') {
    console.error('FAIL: empty source should be unavailable')
    process.exit(1)
  }
  console.log('PASS: no pdf source returns unavailable')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
