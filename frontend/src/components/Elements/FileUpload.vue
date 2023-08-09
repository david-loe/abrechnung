<template>
  <div>
    <div class="row g-2 mb-1">
      <div v-for="(file, index) of modelValue" class="col-auto" :key="file.name" style="max-width: 110px" :title="file.name">
        <div class="border rounded p-2">
          <div class="row justify-content-between m-0">
            <div class="col-auto p-0">
              <button type="button" class="btn btn-sm btn-light" @click="showFile(index)">
                <i class="bi bi-eye"></i>
              </button>
            </div>
            <div class="col-auto p-0">
              <button type="button" class="btn btn-sm btn-light" @click="disabled ? null : deleteFile(index)" :disabled="disabled">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          <div class="fs-2 text-center">
            <i class="bi bi-file-earmark-text"></i>
          </div>
          <div class="text-truncate text-center">
            {{ file.name }}
          </div>
        </div>
      </div>
      <div class="ms-auto col-auto d-none d-md-block">
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
      accept="image/png, image/jpeg, .pdf"
      @change="changeFile"
      :required="required && modelValue.length == 0"
      multiple
      :disabled="disabled" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { DocumentFile, Token } from '../../../../common/types'
import { fileEventToDocumentFiles } from '../../../../common/scriptsts'
import settings from '../../../../common/settings.json'
import QRCode from 'qrcode'

export default defineComponent({
  name: 'FileUpload',
  props: {
    modelValue: {
      type: Array as PropType<DocumentFile[]>,
      default: function () {
        return []
      }
    },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    id: { type: String },
    endpointPrefix: { type: String, default: '' }
  },
  data() {
    return {
      token: undefined as Token | undefined,
      qr: undefined as string | undefined,
      fetchTokenInterval: undefined as NodeJS.Timer | undefined,
      secondsLeft: settings.uploadTokenExpireAfterSeconds,
      expireAfterSeconds: settings.uploadTokenExpireAfterSeconds
    }
  },
  emits: ['update:modelValue'],
  methods: {
    async showFile(index: number): Promise<void> {
      const windowProxy = window.open('', '_blank') as Window
      if (this.modelValue[index]._id) {
        const result = await this.$root.getter(
          this.endpointPrefix + '/documentFile',
          { id: this.modelValue[index]._id },
          { responseType: 'blob' }
        )
        if (result) {
          const fileURL = URL.createObjectURL(result)
          windowProxy.location.assign(fileURL)
        } else {
          windowProxy.close()
        }
      } else if (this.modelValue[index].data) {
        const fileURL = URL.createObjectURL(this.modelValue[index].data!)
        windowProxy.location.assign(fileURL)
      }
    },
    async deleteFile(index: number) {
      if (confirm(this.$t('alerts.areYouSureDelete'))) {
        if (this.modelValue[index]._id) {
          const result = await this.$root.deleter(this.endpointPrefix + '/documentFile', { id: this.modelValue[index]._id }, false)
          if (!result) {
            return null
          }
        }
        const files = this.modelValue
        files.splice(index, 1)
        this.$emit('update:modelValue', files)
      }
    },
    async changeFile(event: Event) {
      const newFiles = await fileEventToDocumentFiles(event)
      if (newFiles) {
        this.$emit('update:modelValue', this.modelValue.concat(newFiles))
      }
    },
    async generateToken() {
      this.token = await this.$root.setter('user/token', {}, undefined, false)
      if (this.token) {
        const url = new URL(import.meta.env.VITE_BACKEND_URL + '/upload/new')
        url.searchParams.append('user', this.$root.user._id)
        url.searchParams.append('token', this.token._id)
        console.log(url.href)
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
      const result = await this.$root.getter('/user/token')
      if (result && result.data) {
        const token: Token = result.data
        if (token.files.length > 0) {
          const files = this.modelValue
          for (const file of token.files) {
            ;(file as any).viaTokenUpload = true
            file.data = new File((file.data as any).data, file.name, { type: file.type })
            files.push(file)
          }
          console.log(files)
          this.$emit('update:modelValue', files)
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
      this.$root.deleter('/user/token', {}, false, false)
    }
  },
  unmounted() {
    this.clear()
  }
})
</script>

<style></style>
