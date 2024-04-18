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
import { log } from '../../../../common/logger.js'
import { resizeImage } from '../../../../common/scripts.js'
import { DocumentFile, Token } from '../../../../common/types.js'
import FileUploadFileElement from './FileUploadFileElement.vue'

export default defineComponent({
  name: 'FileUpload',
  components: { FileUploadFileElement },
  props: {
    modelValue: {
      type: [Array, Object] as PropType<Partial<DocumentFile>[] | Partial<DocumentFile> | null>,
      default: function () {
        return null
      }
    },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    id: { type: String },
    accept: { type: String, default: 'image/png, image/jpeg, .pdf' },
    endpointPrefix: { type: String, default: '' },
    multiple: { type: Boolean, default: true }
  },
  data() {
    return {
      token: undefined as Token | undefined,
      qr: undefined as string | undefined,
      fetchTokenInterval: undefined as NodeJS.Timeout | undefined,
      secondsLeft: this.$root.settings.uploadTokenExpireAfterSeconds,
      expireAfterSeconds: this.$root.settings.uploadTokenExpireAfterSeconds
    }
  },
  emits: ['update:modelValue'],
  methods: {
    async showFile(file: Partial<DocumentFile>): Promise<void> {
      const windowProxy = window.open('', '_blank') as Window
      if (file._id) {
        const result = (await this.$root.getter<Blob>(this.endpointPrefix + 'documentFile', { _id: file._id }, { responseType: 'blob' })).ok
        if (result) {
          const fileURL = URL.createObjectURL(result.data)
          windowProxy.location.assign(fileURL)
        } else {
          windowProxy.close()
        }
      } else if (file.data) {
        const fileURL = URL.createObjectURL(file.data)
        windowProxy.location.assign(fileURL)
      }
    },
    async deleteFile(file: Partial<DocumentFile>, index?: number) {
      if (confirm(this.$t('alerts.areYouSureDelete'))) {
        if (file._id) {
          const result = await this.$root.deleter(this.endpointPrefix + 'documentFile', { _id: file._id }, false)
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
      const newFiles = await this.fileEventToDocumentFiles(event)
      if (newFiles) {
        if (this.multiple) {
          const files = Array.isArray(this.modelValue) ? this.modelValue : []
          this.$emit('update:modelValue', files.concat(newFiles))
        } else if (newFiles.length > 0) {
          this.$emit('update:modelValue', newFiles[0])
        }
      }
    },
    async fileEventToDocumentFiles(event: Event): Promise<Partial<DocumentFile>[] | null> {
      const files: Partial<DocumentFile>[] = []
      if (event.target && (event.target as HTMLInputElement).files) {
        for (const file of (event.target as HTMLInputElement).files!) {
          if (file.size < 16000000) {
            if (file.type.indexOf('image') > -1) {
              const resizedImage = await resizeImage(file, 1400)
              files.push({ data: resizedImage, type: resizedImage.type as DocumentFile['type'], name: file.name })
            } else {
              files.push({ data: file, type: file.type as DocumentFile['type'], name: file.name })
            }
          } else {
            alert('alerts.imageToBig ' + file.name)
          }
        }
        ;(event.target as HTMLInputElement).value = ''
        return files
      }
      return null
    },
    async generateToken() {
      this.token = (await this.$root.setter<Token>('user/token', {}, undefined, false)).ok
      if (this.token) {
        const url = new URL(import.meta.env.VITE_BACKEND_URL + '/upload/new')
        url.searchParams.append('userId', this.$root.user._id)
        url.searchParams.append('tokenId', this.token._id)
        log(this.$t('labels.uploadLink') + ':')
        log(url.href)
        this.qr = await QRCode.toDataURL(url.href, { margin: 0, scale: 3 })
        this.fetchTokenInterval = setInterval(this.getTokenFiles, 5000)
      }
    },
    async getTokenFiles() {
      if (this.token) {
        this.secondsLeft = Math.round(
          (new Date(this.token.createdAt).valueOf() + this.expireAfterSeconds * 1000 - new Date().valueOf()) / 1000
        )
      }
      const result = (await this.$root.getter<Token>('user/token')).ok
      if (result && result.data) {
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
      clearInterval(this.fetchTokenInterval)
      this.token = undefined
      this.qr = undefined
      this.secondsLeft = this.expireAfterSeconds
      this.$root.deleter('user/token', { _id: '' }, false, false)
    }
  },
  unmounted() {
    this.clear()
  }
})
</script>

<style></style>
