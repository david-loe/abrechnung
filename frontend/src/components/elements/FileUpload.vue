<template>
  <div>
    <div class="row g-2 mb-1">
      <template v-if="modelValue !== null">
        <template v-if="multiple">
          <FileUploadFileElement
            v-for="(file, index) of modelValue"
            :file="file"
            :disabled="disabled"
            :key="(file as DocumentFile<string, Blob>).name"
            @show="_showFile(file)"
            @deleted="deleteFile(file, index)" />
        </template>
        <FileUploadFileElement
          v-else
          :file="(modelValue as DocumentFile<string, Blob>)"
          :disabled="disabled"
          @show="_showFile(modelValue as Partial<DocumentFile<string, Blob>>)"
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
              <button type="button" class="btn p-0" @click="clear()">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
          <img class="border border-5 rounded border-white" :src="qrSrc" >
        </div>
      </div>
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
  </div>
</template>

<script lang="ts" setup>
import { DocumentFile, Token } from 'abrechnung-common/types.js'
import { fileEventToDocumentFiles } from 'abrechnung-common/utils/file.js'
import QRCode from 'qrcode'
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import API from '../../api.js'
import ENV from '../../env.js'
import { showFile } from '../../helper.js'
import { logger } from '../../logger.js'
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
  showUploadFromPhone: true
})

const emit = defineEmits<{ (e: 'update:modelValue', v: FileT[]): void; (e: 'update:modelValue', v: FileT | null): void }>()

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
let fetchTokenInterval = undefined as NodeJS.Timeout | undefined
const expireAfterSeconds = APP_DATA.value?.settings.uploadTokenExpireAfterSeconds ?? 1
const secondsLeft = ref(expireAfterSeconds)

async function _showFile(file: Partial<DocumentFile<string, Blob>>): Promise<void> {
  if (file.data) {
    await showFile(file.data as File)
  } else if (file._id) {
    await showFile({ params: { _id: file._id }, endpoint: `${props.endpointPrefix}documentFile`, filename: file.name as string })
  }
}
async function deleteFile(file: Partial<DocumentFile<string, Blob>>, index?: number) {
  if (confirm(t('alerts.areYouSureDelete'))) {
    if (!file.data && file._id) {
      const result = await API.deleter(`${props.endpointPrefix}documentFile`, { _id: file._id }, false)
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
    if (props.multiple) {
      emit('update:modelValue', props.modelValue.concat(newFiles))
    } else {
      emit('update:modelValue', newFiles[0])
    }
  }
}
async function generateToken() {
  token.value = (await API.setter<Token<string, Blob>>('user/token', {}, undefined, false)).ok
  if (token.value && APP_DATA.value) {
    const url = new URL(`${ENV.VITE_BACKEND_URL}/upload/new`)
    url.searchParams.append('userId', APP_DATA.value.user._id)
    url.searchParams.append('tokenId', token.value._id)
    if (props.ownerId) {
      url.searchParams.append('ownerId', props.ownerId)
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
      clear()
    }
  } else {
    clear()
  }
}

onUnmounted(clear)
</script>

<style></style>
