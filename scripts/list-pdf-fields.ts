import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'

async function main() {
  const file = process.argv[2] || 'onboarding-documents/LS54.pdf'
  const buf = await readFile(file)
  const doc = await PDFDocument.load(buf)
  for (const f of doc.getForm().getFields()) {
    console.log(f.getName())
  }
}
main()
