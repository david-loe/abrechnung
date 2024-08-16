<template>
  <component :is="elementLayout" ref="container">
    <template #element>
      <ElementLabelFloating v-if="hasFloating && !empty" :visible="!empty" />

      <!-- @vueform/multiselect copmonent -->
      <Multiselect
        v-bind="fieldOptions"
        v-if="$root.projects.length > 0"
        :options="$root.projects"
        valueProp="_id"
        searchable
        :searchFilter="customFilterFunction"
        v-model="value"
        :classes="classes.select"
        :id="fieldId"
        :name="name"
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

        <template v-slot:singlelabel="{ value }">
          <div class="position-absolute start-0 ms-3">
            <span>{{ value.identifier + (value.name ? ' ' + value.name : '') }}</span>
          </div>
        </template>

        <template v-slot:multiplelabel="{ values }">
          <div class="position-absolute start-0 ms-3">
            <span v-for="value of values" class="me-3">
              <span>{{ value.identifier + (value.name ? ' ' + value.name : '') }}</span>
            </span>
          </div>
        </template>

        <template v-slot:option="{ option }">
          <div>{{ option.identifier + (option.name ? ' ' + option.name : '') }}</div>
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
  name: 'ProjectElement',
  components: { Multiselect },
  props: Object.assign(SelectElement.props, {
    native: { type: Boolean, default: false }
  }),
  methods: {
    customFilterFunction(option, search) {
      const identifier = option.identifier.toLowerCase().indexOf(search.toLowerCase()) > -1
      if (identifier) {
        return identifier
      }

      const name = option.name && option.name.toLowerCase().indexOf(search.toLowerCase()) > -1
      return name
    }
  },
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
