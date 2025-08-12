export const imageTypes = ['image/jpeg', 'image/png'] as const
export type ImageType = (typeof imageTypes)[number]

export const documentFileTypes = ['application/pdf', ...imageTypes] as const
export type DocumentFileType = (typeof documentFileTypes)[number]

// From https://stackoverflow.com/a/52983833/13582326
export function resizeImage(file: Blob, longestSide: number): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = function (this: FileReader) {
      // We create an image to receive the Data URI
      const img = document.createElement('img')
      // When the img "onload" is triggered we can resize the image.
      img.onload = function (this: GlobalEventHandlers) {
        // We create a canvas and get its context.
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        // We set the dimensions to the wanted size.
        const max: 'width' | 'height' = img.height < img.width ? 'width' : 'height'
        const min: 'width' | 'height' = max === 'width' ? 'height' : 'width'
        if (img[max] > longestSide) {
          canvas[max] = longestSide
          canvas[min] = img[min] * (longestSide / img[max])
        } else {
          return resolve(file)
        }
        // We resize the image with the canvas method drawImage();
        ;(ctx as CanvasRenderingContext2D).drawImage(this as CanvasImageSource, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => (blob ? resolve(blob) : resolve(file)), 'image/jpeg', 0.85)
      }
      // We put the Data URI in the image's src attribute
      img.src = this.result as string
    }
  })
}

export async function fileEventToDocumentFiles(
  event: Event,
  maxFileSizeInBytes: number,
  longestImageSideInPixels: number,
  t: (key: string, interpolation: Record<string, string>) => string
) {
  const files: { data: Blob; type: DocumentFileType; name: string }[] = []
  const target = event.target as HTMLInputElement
  if (target.files) {
    for (const file of target.files) {
      if (!documentFileTypes.includes(file.type as DocumentFileType)) {
        alert(t('alerts.fileTypeOfXNotSupportedY', { X: file.name, Y: documentFileTypes.join(', ') }))
        continue
      }
      let newFile: { data: Blob; type: DocumentFileType } = { data: file, type: file.type as DocumentFileType }
      if (file.type.indexOf('image') > -1) {
        const resizedImage = await resizeImage(file, longestImageSideInPixels)
        newFile = { data: resizedImage, type: resizedImage.type as DocumentFileType }
      }
      if (newFile.data.size > maxFileSizeInBytes) {
        alert(t('alerts.fileXToLargeMaxIsY', { X: file.name, Y: formatBytes(maxFileSizeInBytes) }))
        continue
      }
      files.push({ data: newFile.data, type: newFile.type, name: file.name })
    }
    target.value = ''
    return files
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024
    return `${kb.toFixed(2)} KB`
  }
  return `${bytes} B`
}

export function detectImageType(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)

  const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (bytes.length >= pngSignature.length && pngSignature.every((b, i) => bytes[i] === b)) {
    return 'image/png'
  }

  const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff])
  if (bytes.length >= jpegSignature.length && jpegSignature.every((b, i) => bytes[i] === b)) {
    return 'image/jpeg'
  }
}
