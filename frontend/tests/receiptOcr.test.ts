import type { PDFPageProxy } from 'pdfjs-dist'
import { describe, expect, it, vi } from 'vitest'
import { textFromPdfPages } from '@/ocr/pdfText.js'

function pdfPage(text: string) {
  return {
    getTextContent: vi.fn().mockResolvedValue({ items: text ? [{ str: text }] : [] }),
    getViewport: vi.fn(({ scale }) => ({ width: 100 * scale, height: 200 * scale })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    cleanup: vi.fn()
  } as unknown as PDFPageProxy
}

function canvas() {
  return { width: 0, height: 0, getContext: vi.fn(() => ({})) } as unknown as HTMLCanvasElement
}

describe('receipt PDF text extraction', () => {
  it('uses embedded PDF text without rendering or OCR', async () => {
    const page = pdfPage('Embedded receipt text')
    const predict = vi.fn()

    await expect(textFromPdfPages([page], predict, canvas)).resolves.toBe('Embedded receipt text')

    expect(page.render).not.toHaveBeenCalled()
    expect(predict).not.toHaveBeenCalled()
    expect(page.cleanup).toHaveBeenCalledOnce()
  })

  it('runs OCR only for textless pages in a mixed PDF', async () => {
    const textPage = pdfPage('Digital first page')
    const scannedPage = pdfPage('')
    const predict = vi.fn().mockResolvedValue('Recognized second page')

    await expect(textFromPdfPages([textPage, scannedPage], predict, canvas)).resolves.toBe('Digital first page\n\nRecognized second page')

    expect(textPage.render).not.toHaveBeenCalled()
    expect(scannedPage.render).toHaveBeenCalledOnce()
    expect(predict).toHaveBeenCalledOnce()
    expect(textPage.cleanup).toHaveBeenCalledOnce()
    expect(scannedPage.cleanup).toHaveBeenCalledOnce()
  })
})
