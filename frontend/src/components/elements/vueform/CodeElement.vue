<template>
  <ElementLayout>
    <template #element>
      <CodeEditor v-model="model" :read-only="isDisabled" :line-nums="true" width="100%" :highlight="hljs" :theme="getClass()" />
    </template>

    <!-- Default element slots -->
    <template v-for="(component, slot) in elementSlots" #[slot]>
      <slot :name="slot" :el$="el$">
        <component :is="component" :el$="el$" />
      </slot>
    </template>
  </ElementLayout>
</template>

<script>
import { defineElement } from '@vueform/vueform'
import hljs from 'highlight.js' //https://github.com/justcaliturner/simple-code-editor/issues/54
import CodeEditor from 'simple-code-editor'

export default defineElement({
  name: 'CodeElement',
  components: { CodeEditor },
  methods: {
    getClass() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'github-dark' : 'github'
    }
  }
})
</script>

<style>
.code-editor {
  letter-spacing: 0;
  line-height: 0;
}
.hljs {
  border-style: solid;
  border-width: 1px;
  border-color: var(--bs-border-color);
}
</style>
