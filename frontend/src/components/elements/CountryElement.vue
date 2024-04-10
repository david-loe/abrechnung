<template>
  <component :is="elementLayout" ref="container">
    <template #element>
      <ElementLabelFloating v-if="hasFloating && !empty" :visible="!empty" />

      <!-- @vueform/multiselect copmonent -->
      <Multiselect
        v-bind="fieldOptions"
        v-model="value"
        :classes="classes.select"
        :id="fieldId"
        :name="name"
        :options="resolvedOptions"
        :disabled="isDisabled"
        :placeholder="Placeholder"
        :attrs="attrs"
        :aria="aria"
        :locale="form$.locale$"
        @select="handleSelect"
        @deselect="handleDeselect"
        @search-change="handleSearchChange"
        @tag="handleTag"
        @open="handleOpen"
        @close="handleClose"
        @clear="handleClear"
        @paste="handlePaste"
        ref="input">
        <template
          v-for="(slotName, slotKey) in {
            option: 'option',
            noresults: 'no-results',
            nooptions: 'no-options',
            afterlist: 'after-list',
            beforelist: 'before-list',
            placeholder: 'placeholder',
            grouplabel: 'group-label',
            caret: 'caret',
            clear: 'clear',
            spinner: 'spinner',
            default: 'default'
          }"
          #[slotKey]="props">
          <slot :name="slotName" v-bind="props" :el$="el$">
            <component :is="fieldSlots[slotName]" v-bind="props" :el$="el$" />
          </slot>
        </template>

        <template v-if="fieldOptions.mode == 'single'" #singlelabel="{ value }">
          <slot name="single-label" :value="value" :el$="el$">
            <component :is="fieldSlots['single-label']" :value="value" :el$="el$" />
          </slot>
        </template>
      </Multiselect>
    </template>

    <!-- Default element slots -->
    <template v-for="(component, slot) in elementSlots" #[slot]
      ><slot :name="slot" :el$="el$"><component :is="component" :el$="el$" /></slot
    ></template>
  </component>
</template>

<script>
import Multiselect from '@vueform/multiselect/src/Multiselect.vue'
import { defineElement, SelectElement } from '@vueform/vueform'
import { SelectElement as SelectElementTemplate } from '@vueform/vueform/dist/vueform'
import { ref } from 'vue'

export default defineElement({
  ...SelectElement, // adding props, mixins, emits
  name: 'CountryElement',
  components: { Multiselect },
  props: Object.assign(SelectElement.props, { native: { type: Boolean, default: false } }),
  setup(props, context) {
    const element = SelectElement.setup(props, context)
    const defaultClasses = ref({
      ...SelectElementTemplate.data().defaultClasses
    })
    return {
      ...element,
      defaultClasses
    }
  }
})
</script>
