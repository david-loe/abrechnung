<template>
  <ElementLayout>
    <template #element>
      <JsonEditorVue v-model="model" :stringified="false" :mainMenuBar="false" :statusBar="false" mode="text" />
    </template>

    <!-- Default element slots -->
    <template v-for="(component, slot) in elementSlots" #[slot]
      ><slot :name="slot" :el$="el$"><component :is="component" :el$="el$" /></slot
    ></template>
  </ElementLayout>
</template>

<script>
import { defineElement } from '@vueform/vueform'
import JsonEditorVue from 'json-editor-vue'

export default defineElement({ name: 'MixedElement', components: { JsonEditorVue } })
</script>
