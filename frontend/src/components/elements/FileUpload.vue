<template>
  <div>
    <div class="row g-2 mb-1">
      <template v-if="modelValue !== null">
        <template v-if="multiple">
          <FileUploadFileElement
            v-for="(file, index) of modelValue"
            :file="file"
            :disabled="disabled"
            :key="(file as DocumentFile).name"
            @show="showFile(file)"
            @deleted="deleteFile(file, index)" />
        </template>
        <FileUploadFileElement
          v-else
          :file="modelValue as DocumentFile"
          :disabled="disabled"
          @show="showFile(modelValue as Partial<DocumentFile>)"
          @deleted="deleteFile(modelValue as Partial<DocumentFile>)" />
      </template>

      <div v-if="!disabled" class="ms-auto col-auto d-none d-md-block">
        <button v-if="!token" type="button" class="btn btn-light text-center" @click="generateToken">
          <i class="bi bi-qr-code-scan"></i>
          <span class="ms-1">{{ $t('labels.uploadFromPhone') }}</span>
        </button>
        <div v-else-if="qr">
          <div class="row g-1 align-items-center">
            <div class="col">
              <div class="progress" role="progressbar">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  :style="'width: ' + Math.round((100 * secondsLeft) / expireAfterSeconds) + '%'"></div>
              </div>
            </div>
            <div class="col-auto">
              <i class="bi bi-x-lg" style="cursor: pointer" @click="clear()"></i>
            </div>
          </div>
          <img class="m-1" :src="qr" />
        </div>
      </div>
    </div>
    <input
      class="form-control"
      type="file"
      :id="id"
      :accept="accept"
      @change="changeFile"
      :required="required && Boolean(modelValue) && (modelValue as Partial<DocumentFile>[]).length === 0"
      :multiple="multiple"
      :disabled="disabled" />
  </div>
</template>

<script lang="ts">
import QRCode from 'qrcode'
import { defineComponent, PropType } from 'vue'
import { DocumentFile, Token } from '@/../../common/types.js'
import { fileEventToDocumentFiles } from '@/../../common/utils/file.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import FileUploadFileElement from '@/components/elements/FileUploadFileElement.vue'
import { showFile } from '@/helper.js'
import { logger } from '@/logger.js'

const APP_DATA = APP_LOADER.data

export default defineComponent({
  name: 'FileUpload',
  components: { FileUploadFileElement },
  props: {
    modelValue: { type: [Array, Object] as PropType<Partial<DocumentFile>[] | Partial<DocumentFile> | null>, default: () => null },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    id: { type: String },
    accept: { type: String, default: 'image/png, image/jpeg, .pdf' },
    endpointPrefix: { type: String, default: '' },
    multiple: { type: Boolean, default: true },
    ownerId: { type: String }
  },
  data() {
    return {
      token: undefined as Token | undefined,
      qr: undefined as string | undefined,
      fetchTokenInterval: undefined as NodeJS.Timeout | undefined,
      secondsLeft: 1,
      expireAfterSeconds: 1
    }
  },
  emits: ['update:modelValue'],
  methods: {
    async showFile(file: Partial<DocumentFile>): Promise<void> {
      if (file.data) {
        await showFile(file.data as File)
      } else if (file._id) {
        await showFile({ params: { _id: file._id }, endpoint: `${this.endpointPrefix}documentFile`, filename: file.name as string })
      }
    },
    async deleteFile(file: Partial<DocumentFile>, index?: number) {
      if (confirm(this.$t('alerts.areYouSureDelete'))) {
        if (file._id) {
          const result = await API.deleter(`${this.endpointPrefix}documentFile`, { _id: file._id }, false)
          if (!result) {
            return null
          }
        }
        if (Array.isArray(this.modelValue) && typeof index === 'number') {
          const files = this.modelValue
          files.splice(index, 1)
          this.$emit('update:modelValue', files)
        } else {
          this.$emit('update:modelValue', null)
        }
      }
    },
    async changeFile(event: Event) {
      const newFiles = await fileEventToDocumentFiles(event, Number.parseInt(import.meta.env.VITE_MAX_FILE_SIZE), this.$t)
      if (newFiles) {
        if (this.multiple) {
          const files = Array.isArray(this.modelValue) ? this.modelValue : []
          this.$emit('update:modelValue', files.concat(newFiles))
        } else if (newFiles.length > 0) {
          this.$emit('update:modelValue', newFiles[0])
        }
      }
    },
    async generateToken() {
      this.token = (await API.setter<Token>('user/token', {}, undefined, false)).ok
      if (this.token && APP_DATA.value) {
        const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/upload/new`)
        url.searchParams.append('userId', APP_DATA.value.user._id)
        url.searchParams.append('tokenId', this.token._id)
        if (this.ownerId) {
          url.searchParams.append('ownerId', this.ownerId)
        }
        logger.info(`${this.$t('labels.uploadLink')}:`)
        logger.info(url.href)
        this.qr = await QRCode.toDataURL(url.href, { margin: 0, scale: 3 })
        this.fetchTokenInterval = setInterval(this.getTokenFiles, 3000)
      }
    },
    async getTokenFiles() {
      if (this.token) {
        this.secondsLeft = Math.round((new Date(this.token.expireAt).valueOf() - Date.now()) / 1000)
      }
      const result = (await API.getter<Token>('user/token')).ok
      if (result?.data) {
        const token: Token = result.data
        if (token.files.length > 0) {
          if (this.multiple) {
            const files = Array.isArray(this.modelValue) ? this.modelValue : []
            this.$emit('update:modelValue', files.concat(token.files))
          } else {
            this.$emit('update:modelValue', token.files[0])
          }
          this.clear()
        }
      } else {
        this.clear()
      }
    },
    clear() {
      if (this.fetchTokenInterval) {
        clearInterval(this.fetchTokenInterval)
      }
      if (this.token) {
        API.deleter('user/token', { _id: '' }, false, { success: false, error: false })
      }
      this.token = undefined
      this.qr = undefined
      this.secondsLeft = this.expireAfterSeconds
    }
  },
  unmounted() {
    this.clear()
  },
  async created() {
    await APP_LOADER.loadData()
    if (APP_DATA.value) {
      this.secondsLeft = this.expireAfterSeconds = APP_DATA.value.settings.uploadTokenExpireAfterSeconds
    }
  }
})
</script>

<style></style>
