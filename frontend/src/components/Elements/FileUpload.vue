<template>
  <input class="form-control" type="file" id="recordFormFile" accept="image/png, image/jpeg, .pdf" @change="changeFile" :required="required"/>
</template>

<script>
export default {
  name: 'FileUpload',
  data() {
    return {}
  },
  components: {},
  props: {modelValue: {type: [Object, String], default: function(){return {data: undefined, type: undefined}}}, required: {type: Boolean, default: false}},
  emits: ['update:modelValue'],
  methods: {
    changeFile(form) {
      const reader = new FileReader()
      if (form.target.files.length === 1 && form.target.files[0].size < 15000000) {
        console.log(form.target.files[0])
        if(form.target.files[0].type.indexOf('image') > -1){
          reader.readAsDataURL(form.target.files[0])
          reader.onload = async () => {
            console.log(await this.resizedataURL(reader.result, 450))
            this.$emit('update:modelValue', {data: await this.resizedataURL(reader.result, 450), type: form.target.files[0].type})
          }
        }
        this.$emit('update:modelValue', {data: form.target.files[0], type: form.target.files[0].type})
      } else {
        alert(this.$t('alerts.imageToBig'))
        this.$emit('update:modelValue', {data: undefined, type: undefined})
      }
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

<style>
</style>