<template>
  <ElementLayout>
    <template #element>
      <FileUpload v-model="model" :disabled="isDisabled" :accept="accept" :multiple="multiple"></FileUpload>
    </template>

    <!-- Default element slots -->
    <template v-for="(component, slot) in elementSlots" #[slot]
      ><slot :name="slot" :el$="el$"><component :is="component" :el$="el$" /></slot
    ></template>
  </ElementLayout>
</template>

<script>
import { defineElement } from '@vueform/vueform'
import FileUpload from '@/components/elements/FileUpload.vue'

export default defineElement({
  name: 'DocumentfileElement',
  components: { FileUpload },
  props: { multiple: { type: Boolean, default: false }, accept: { type: String, default: null } },
  setup(props, { element }) {
    // ...
  }
})
</script>
