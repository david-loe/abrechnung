<template>
  <div>
    <div class="row g-2 mb-1">
      <template v-if="modelValue !== null">
        <template v-if="multiple">
          <FileUploadFileElement
            v-for="(file, index) of modelValue"
            :file="(file as DocumentFile<string, Blob>)"
            :disabled="disabled"
            :rotating="isRotating(file, index)"
            :key="(file as DocumentFile<string, Blob>).name"
            @show="_showFile(file)"
            @rotate="(degrees) => rotateFile(file, index, degrees)"
            @deleted="deleteFile(file, index)" />
        </template>
        <FileUploadFileElement
          v-else
          :file="(modelValue as DocumentFile<string, Blob>)"
          :disabled="disabled"
          :rotating="isRotating(modelValue as Partial<DocumentFile<string, Blob>>)"
          @show="_showFile(modelValue as Partial<DocumentFile<string, Blob>>)"
          @rotate="(degrees) => rotateFile(modelValue as Partial<DocumentFile<string, Blob>>, undefined, degrees)"
          @deleted="deleteFile(modelValue as Partial<DocumentFile<string, Blob>>)" />
      </template>

      <div v-if="props.showUploadFromPhone && !disabled" class="ms-auto col-auto d-none d-md-block">
        <button v-if="!token" type="button" class="btn btn-light text-center" @click="generateToken">
          <i class="bi bi-qr-code-scan"></i>
          <span class="ms-1">{{ t('labels.uploadFromPhone') }}</span>
        </button>
        <div v-else-if="qrSrc">
          <div class="row g-1 align-items-center">
            <div class="col">
              <div class="progress" role="progressbar">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  :style="'width: ' + Math.round((100 * secondsLeft) / expireAfterSeconds) + '%'"></div>
              </div>
            </div>
            <div class="col-auto">
              <button type="button" class="btn p-0" @click="clear()"><i class="bi bi-x-lg"></i></button>
            </div>
          </div>
          <img class="border border-5 rounded border-white" :src="qrSrc" >
        </div>
      </div>
    </div>
    <div v-if="showRotateSaveHint" class="form-text text-warning">
      <i class="bi bi-exclamation-circle me-1"></i>
      {{ t('alerts.saveAfterRotate') }}
    </div>
    <input
      class="form-control"
      type="file"
      :id="id"
      :accept="accept"
      @change="changeFile"
      :required="required && Boolean(modelValue) && (modelValue as Partial<DocumentFile<string, Blob>>[]).length === 0"
      :multiple="multiple"
      :disabled="disabled" >
    <div
      v-if="backgroundProcessingStatus"
      class="form-text"
      :class="backgroundProcessingFailed ? 'text-danger' : ''"
      role="status"
      aria-live="polite">
      <span v-if="!backgroundProcessingFailed" class="spinner-border spinner-border-sm me-1"></span>
      {{ t(`labels.${backgroundProcessingStatus}`) }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { DocumentFile, SuggestionSourceReportType, Token } from 'abrechnung-common/types.js'
import { fileEventToDocumentFiles, rotateImageClockwise } from 'abrechnung-common/utils/file.js'
import QRCode from 'qrcode'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import API from '../../api.js'
import ENV from '../../env.js'
import { showFile } from '../../helper.js'
import { logger } from '../../logger.js'
import { extractReceiptText } from '../../ocr/index.js'
import { receiptProcessingStatus, ReceiptProcessingStep } from '../../receiptSuggestions.js'
import FileUploadFileElement from './FileUploadFileElement.vue'

const { t } = useI18n()

const APP_DATA = APP_LOADER.data
type FileT = Partial<DocumentFile<string, Blob>>

type BaseProps = {
  required?: boolean
  disabled?: boolean
  id?: string
  accept?: string
  endpointPrefix?: string
  ownerId?: string
  reportId?: string
  receiptProcessing?: boolean
  sourceReportType?: SuggestionSourceReportType
  suggestionFailed?: boolean
  suggestionProcessing?: boolean
  showUploadFromPhone?: boolean
}

type SingleProps = BaseProps & { multiple?: false; modelValue: FileT | null }
type MultiProps = BaseProps & { multiple: true; modelValue: FileT[] }
type Props = SingleProps | MultiProps

const props = withDefaults(defineProps<Props>(), {
  required: false,
  disabled: false,
  accept: 'image/png, image/jpeg, .pdf',
  endpointPrefix: '',
  multiple: true,
  receiptProcessing: false,
  suggestionFailed: false,
  suggestionProcessing: false,
  showUploadFromPhone: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: FileT[]): void
  (e: 'update:modelValue', v: FileT | null): void
  (e: 'processing', v: boolean): void
  (e: 'receipts-ready'): void
}>()

defineExpose({ clear })

function clear() {
  if (fetchTokenInterval) {
    clearInterval(fetchTokenInterval)
  }
  if (token.value) {
    API.deleter('user/token', { _id: '' }, false, { success: false, error: false })
  }
  token.value = undefined
  qrSrc.value = ''
  secondsLeft.value = expireAfterSeconds
}
await APP_LOADER.loadData()

const token = ref(undefined as Token<string, Blob> | undefined)
const qrSrc = ref('')
const rotatingKey = ref('')
const rotatedUnsavedFiles = ref<FileT[]>([])
const processingFiles = ref<{ key: string; name: string; status: ReceiptProcessingStep }[]>([])
let fetchTokenInterval = undefined as NodeJS.Timeout | undefined
const expireAfterSeconds = APP_DATA.value?.settings.uploadTokenExpireAfterSeconds ?? 1
const secondsLeft = ref(expireAfterSeconds)

function keyForFile(file: Partial<DocumentFile<string, Blob>>, index?: number) {
  return `${index ?? ''}:${file._id || file.name || 'file'}`
}
function isRotating(file: Partial<DocumentFile<string, Blob>>, index?: number) {
  return rotatingKey.value === keyForFile(file, index)
}
function currentFiles(): FileT[] {
  if (!props.modelValue) {
    return []
  }
  return Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
}
const showRotateSaveHint = computed(() => {
  if (props.receiptProcessing) return false
  const files = currentFiles()
  return files.some((file) => !file._id && rotatedUnsavedFiles.value.includes(file))
})
const backgroundProcessingStatus = computed(() =>
  receiptProcessingStatus(
    processingFiles.value.map(({ status }) => status),
    props.suggestionProcessing,
    props.suggestionFailed
  )
)
const backgroundProcessingFailed = computed(
  () => backgroundProcessingStatus.value === 'receiptProcessingFailed' || backgroundProcessingStatus.value === 'receiptSuggestionFailed'
)
watch(
  () => processingFiles.value.some(({ status }) => status === 'uploading'),
  (processing) => emit('processing', processing),
  { immediate: true }
)
function trackRotatedUnsavedFile(file: FileT) {
  rotatedUnsavedFiles.value = rotatedUnsavedFiles.value.concat(file)
}
watch(
  () => props.modelValue,
  () => {
    const files = currentFiles()
    rotatedUnsavedFiles.value = rotatedUnsavedFiles.value.filter((file) => !file._id && files.includes(file))
  },
  { deep: true }
)

async function _showFile(file: Partial<DocumentFile<string, Blob>>): Promise<void> {
  if (file.data) {
    await showFile(file.data as File)
  } else if (file._id) {
    await showFile({
      params: { _id: file._id, ...examinedReportContext() },
      endpoint: `${props.endpointPrefix}documentFile`,
      filename: file.name as string
    })
  }
}
async function getImageBlob(file: Partial<DocumentFile<string, Blob>>): Promise<Blob | null> {
  if (file.data) {
    return file.data as Blob
  }
  if (!file._id) {
    return null
  }
  const result = (
    await API.getter<Blob>(`${props.endpointPrefix}documentFile`, { _id: file._id, ...examinedReportContext() }, { responseType: 'blob' })
  ).ok
  return result?.data || null
}
async function rotateFile(file: Partial<DocumentFile<string, Blob>>, index?: number, degrees: 90 | 180 | 270 = 90) {
  if (props.disabled || !file.type?.startsWith('image/')) {
    return
  }
  rotatingKey.value = keyForFile(file, index)
  try {
    const originalBlob = await getImageBlob(file)
    if (!originalBlob) {
      return
    }
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const rotatedBlob = await rotateImageClockwise(originalBlob, outputType, degrees)
    const rotatedFile: FileT = {
      name: file.name,
      type: (rotatedBlob.type || file.type) as DocumentFile<string, Blob>['type'],
      data: rotatedBlob
    }
    if (props.receiptProcessing) {
      const [uploadedFile] = await processReceiptFiles([rotatedFile], false, false)
      if (!uploadedFile) return
      if (Array.isArray(props.modelValue) && typeof index === 'number') {
        emit('update:modelValue', props.modelValue.map((current, currentIndex) => (currentIndex === index ? uploadedFile : current)))
      } else {
        emit('update:modelValue', uploadedFile)
      }
      await nextTick()
      emit('receipts-ready')
      await showFile(new File([rotatedBlob], file.name || 'image', { type: rotatedBlob.type || file.type }))
      return
    }
    trackRotatedUnsavedFile(rotatedFile)
    if (Array.isArray(props.modelValue) && typeof index === 'number') {
      props.modelValue.splice(index, 1, rotatedFile)
      emit('update:modelValue', props.modelValue)
    } else {
      emit('update:modelValue', rotatedFile)
    }
    await showFile(new File([rotatedBlob], file.name || 'image', { type: rotatedBlob.type || file.type }))
  } finally {
    rotatingKey.value = ''
  }
}
async function deleteFile(file: Partial<DocumentFile<string, Blob>>, index?: number) {
  if (confirm(t('alerts.areYouSureDelete'))) {
    if (!file.data && file._id) {
      const result = await API.deleter(`${props.endpointPrefix}documentFile`, { _id: file._id, ...examinedReportContext() }, false)
      if (!result) {
        return null
      }
    }
    if (Array.isArray(props.modelValue) && typeof index === 'number') {
      props.modelValue.splice(index, 1)
      emit('update:modelValue', props.modelValue)
    } else {
      emit('update:modelValue', null)
    }
  }
}
async function changeFile(event: Event) {
  const newFiles = await fileEventToDocumentFiles(event, ENV.VITE_MAX_FILE_SIZE, ENV.VITE_IMAGE_COMPRESSION_THRESHOLD_PX, t)
  if (newFiles && newFiles.length > 0) {
    if (props.receiptProcessing) {
      await processReceiptFiles(newFiles)
      return
    }
    if (props.multiple) {
      emit('update:modelValue', props.modelValue.concat(newFiles))
    } else {
      emit('update:modelValue', newFiles[0])
    }
  }
}

function processingItem(file: FileT, status: 'uploading' | 'ocr') {
  const item = { key: crypto.randomUUID(), name: file.name || t('labels.receipt'), status } as const
  processingFiles.value.push({ ...item })
  return processingFiles.value.at(-1) as (typeof processingFiles.value)[number]
}

function examinedReportContext() {
  if (!props.ownerId) return undefined
  if (!props.reportId || !props.sourceReportType) throw new Error('Examined receipt uploads require a report context')
  return { reportId: props.reportId, sourceReportType: props.sourceReportType }
}

function removeFinishedProcessingItems() {
  processingFiles.value = processingFiles.value.filter(({ status }) => status === 'error')
}

async function startReceiptPipeline(file: FileT) {
  if (!file.data || !file.name || !file.type) throw new Error('Receipt data is missing')
  const item = processingItem(file, 'uploading')
  const formData = new FormData()
  formData.append('file', new File([file.data], file.name, { type: file.type }))
  const uploadRequest = API.setter<FileT>(
    `${props.endpointPrefix}documentFile`,
    formData,
    { params: props.ownerId ? { ownerId: props.ownerId, ...examinedReportContext() } : undefined },
    false
  )
  const ocrResult = extractReceiptText(file.data).then(
    (ocr) => ({ ocr }),
    (error) => ({ error })
  )
  const upload = await uploadRequest
  if (!upload.ok) {
    item.status = 'error'
    throw new Error('Receipt upload failed')
  }
  item.status = 'ocr'
  const documentFile = upload.ok
  const completeOcr = async () => {
    const text = await ocrResult
    if ('error' in text) {
      item.status = 'error'
      logger.error(text.error)
      return
    }
    const result = await API.setter(
      `${props.endpointPrefix}documentFile/ocr`,
      { documentFileId: documentFile._id, ocr: text.ocr, ...examinedReportContext() },
      {},
      false
    )
    if (result.error) {
      item.status = 'error'
      return
    }
    const index = processingFiles.value.indexOf(item)
    if (index !== -1) processingFiles.value.splice(index, 1)
  }
  return { documentFile, completeOcr }
}

async function processReceiptFiles(files: FileT[], append = true, notify = true) {
  const results = await Promise.allSettled(files.map(startReceiptPipeline))
  const uploaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  const documentFiles = uploaded.map(({ documentFile }) => documentFile)
  if (append && documentFiles.length > 0) {
    if (props.multiple) {
      emit('update:modelValue', currentFiles().concat(documentFiles))
    } else {
      emit('update:modelValue', documentFiles[0])
    }
  }
  await Promise.all(uploaded.map(({ completeOcr }) => completeOcr()))
  removeFinishedProcessingItems()
  if (notify && documentFiles.length > 0) emit('receipts-ready')
  return documentFiles
}

async function processExistingReceiptFiles(files: FileT[]) {
  const tasks = files.map(async (file) => {
    if (!file._id) return
    const item = processingItem(file, 'ocr')
    const blob = await getImageBlob(file)
    if (!blob) {
      item.status = 'error'
      return
    }
    try {
      const ocr = await extractReceiptText(blob)
      const result = await API.setter(
        `${props.endpointPrefix}documentFile/ocr`,
        { documentFileId: file._id, ocr, ...examinedReportContext() },
        {},
        false
      )
      if (result.error) throw result.error
      const index = processingFiles.value.indexOf(item)
      if (index !== -1) processingFiles.value.splice(index, 1)
    } catch (error) {
      item.status = 'error'
      logger.error(error)
    }
  })
  await Promise.all(tasks)
  removeFinishedProcessingItems()
  emit('receipts-ready')
}
async function generateToken() {
  token.value = (await API.setter<Token<string, Blob>>('user/token', {}, undefined, false)).ok
  if (token.value && APP_DATA.value) {
    const url = new URL(`${ENV.VITE_BACKEND_URL}/upload/new`)
    url.searchParams.append('userId', APP_DATA.value.user._id)
    url.searchParams.append('tokenId', token.value._id)
    if (props.ownerId) {
      url.searchParams.append('ownerId', props.ownerId)
      const context = examinedReportContext()
      if (!context) throw new Error('Examined receipt uploads require a report context')
      url.searchParams.append('reportId', context.reportId)
      url.searchParams.append('sourceReportType', context.sourceReportType)
    }
    logger.info(`${t('labels.uploadLink')}:`)
    logger.info(url.href)
    qrSrc.value = await QRCode.toDataURL(url.href, { margin: 0, scale: 3 })
    fetchTokenInterval = setInterval(getTokenFiles, 3000)
  }
}
async function getTokenFiles() {
  if (token.value) {
    secondsLeft.value = Math.round((new Date(token.value.expireAt).valueOf() - Date.now()) / 1000)
  }
  const result = (await API.getter<Token<string, Blob>>('user/token')).ok
  if (result?.data) {
    const fetchedToken: Token<string, Blob> = result.data
    if (fetchedToken.files.length > 0) {
      if (props.multiple) {
        emit('update:modelValue', props.modelValue.concat(fetchedToken.files))
      } else {
        emit('update:modelValue', fetchedToken.files[0])
      }
      if (props.receiptProcessing) void processExistingReceiptFiles(fetchedToken.files)
      clear()
    }
  } else {
    clear()
  }
}

onUnmounted(clear)
</script>

<style></style>
