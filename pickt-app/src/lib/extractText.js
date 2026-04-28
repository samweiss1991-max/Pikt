// Client-side text extraction for PDF, DOCX, and TXT files.
// Used by the marketplace upload-job-description flow before sending text to
// the parse-jd Edge Function.

export async function extractTextFromFile(file) {
  const name = (file.name || '').toLowerCase()

  if (name.endsWith('.txt')) {
    return await file.text()
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser.js')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value || ''
  }

  if (name.endsWith('.pdf')) {
    const pdfjsLib = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((item) => item.str).join(' ')
      fullText += pageText + '\n\n'
    }
    return fullText.trim()
  }

  throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
}
