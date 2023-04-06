<template>
  <div class="row">
    <div v-for="(file, index) of modelValue" class="col-auto border rounded" :key="index + Math.random()">
      <div class="mt-1">
        <button type="button" class="btn btn-sm btn-light me-1" @click="viewFile(index)">
          <i class="bi bi-eye"></i>
        </button>
        <button type="button" class="btn btn-sm btn-light" @click="deleteFile(index)">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <div class="fs-2 text-center">
        <i class="bi bi-file-earmark-text"></i>
      </div>
    </div>
  </div>
  <input class="form-control" type="file" id="recordFormFile" accept="image/png, image/jpeg, .pdf" @change="changeFile"
    :required="required" multiple />
</template>

<script>
export default {
  name: 'FileUpload',
  data() {
    return {}
  },
  components: {},
  props: { modelValue: { type: Array, default: function () { return [] } }, required: { type: Boolean, default: false } },
  emits: ['update:modelValue'],
  methods: {
    changeFile(form) {
      const reader = new FileReader()
      const files = this.modelValue
      for (const file of form.target.files) {
        if (file.size < 15000000) {
          if (file.type.indexOf('image') > -1) {
            reader.readAsDataURL(file)
            reader.onload = async () => {
              console.log(await this.resizedataURL(reader.result, 450))
              files.push({ data: await this.resizedataURL(reader.result, 450), type: file.type })
            }
          }
          files.push({ data: file, type: file.type })
        } else {
          alert(this.$t('alerts.imageToBig'))
        }
      }
      this.$emit('update:modelValue', files)
    },
    // From https://stackoverflow.com/a/52983833/13582326
    resizedataURL(datas, wantedWidth) {
      return new Promise((resolve) => {
        // We create an image to receive the Data URI
        var img = document.createElement('img')
        // When the img "onload" is triggered we can resize the image.
        img.onload = function () {
          // We create a canvas and get its context.
          var canvas = document.createElement('canvas')
          var ctx = canvas.getContext('2d')
          // We set the dimensions at the wanted size.
          canvas.width = wantedWidth
          canvas.height = img.height * (wantedWidth / img.width)
          // We resize the image with the canvas method drawImage();
          ctx.drawImage(this, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
        }
        // We put the Data URI in the image's src attribute
        img.src = datas
      })
    },
  },
}
</script>

<style></style>