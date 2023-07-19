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
import { DocumentFile } from '../../../../common/types'

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
    id: { type: String }
  },
  emits: ['update:modelValue', 'deleteFile', 'showFile'],
  methods: {
    showFile(index: number): void {
      const windowProxy = window.open('', '_blank') as Window
      if (this.modelValue[index]._id) {
        this.$emit('showFile', this.modelValue[index]._id, windowProxy)
      } else if (this.modelValue[index].data) {
        const fileURL = URL.createObjectURL(this.modelValue[index].data!)
        windowProxy.location.assign(fileURL)
      }
    },
    deleteFile(index: number) {
      if (this.modelValue[index]._id) {
        this.$emit('deleteFile', this.modelValue[index]._id)
      } else {
        if (!confirm(this.$t('alerts.areYouSureDelete'))) {
          return null
        }
      }
      const files = this.modelValue
      files.splice(index, 1)
      this.$emit('update:modelValue', files)
    },
    changeFile(event: Event) {
      const files = this.modelValue
      if (event.target && (event.target as HTMLInputElement).files) {
        for (const file of (event.target as HTMLInputElement).files!) {
          if (file.size < 16000000) {
            if (file.type.indexOf('image') > -1) {
              const reader = new FileReader()
              reader.readAsDataURL(file)
              reader.onload = async () => {
                files.push({ data: await this.resizeImage(file, 1400), type: file.type as DocumentFile['type'], name: file.name })
              }
            } else {
              files.push({ data: file, type: file.type as DocumentFile['type'], name: file.name })
            }
          } else {
            alert(this.$t('alerts.imageToBig'))
          }
        }
        this.$emit('update:modelValue', files)
        ;(event.target as HTMLInputElement).value = ''
      }
    },
    // From https://stackoverflow.com/a/52983833/13582326
    resizeImage(file: Blob, longestSide: number): Promise<Blob> {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
          // We create an image to receive the Data URI
          var img = document.createElement('img')
          // When the img "onload" is triggered we can resize the image.
          img.onload = () => {
            // We create a canvas and get its context.
            var canvas = document.createElement('canvas')
            var ctx = canvas.getContext('2d')
            // We set the dimensions to the wanted size.
            var max: 'width' | 'height' = img.height < img.width ? 'width' : 'height'
            var min: 'width' | 'height' = max == 'width' ? 'height' : 'width'
            if (canvas[max] > longestSide) {
              canvas[max] = longestSide
              canvas[min] = img[min] * (longestSide / img[max])
            } else {
              return resolve(file)
            }
            // We resize the image with the canvas method drawImage();
            ;(ctx as CanvasRenderingContext2D).drawImage(this as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.85)
          }
          // We put the Data URI in the image's src attribute
          img.src = reader.result as string
        }
      })
    }
  }
})
</script>

<style></style>
