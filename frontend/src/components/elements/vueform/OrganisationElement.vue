<template>
  <component :is="elementLayout" ref="container">
    <template #element>
      <ElementLabelFloating v-if="hasFloating && !empty" :visible="!empty" />

      <!-- @vueform/multiselect copmonent -->
      <Multiselect
        v-bind="fieldOptions"
        v-if="APP_DATA"
        :options="APP_DATA.organisations"
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
          <span class="text-truncate ms-2 me-auto">
            {{ value.name }}
          </span>
        </template>

        <template v-slot:multiplelabel="{ values }">
          <span class="ms-2 mt-1 me-auto">
            <span v-for="value of values" class="me-3">
              {{ value.name }}
            </span>
          </span>
        </template>

        <template v-slot:option="{ option }">
          <div>
            {{ option.name }}
          </div>
        </template>
      </Multiselect>
    </template>

    <!-- Default element slots -->
    <template v-for="(component, slot) in elementSlots" #[slot]>
      <slot :name="slot" :el$="el$"><component :is="component" :el$="el$" /></slot>
    </template>
  </component>
</template>

<script>
import Multiselect from '@vueform/multiselect/src/Multiselect.vue'
import { defineElement, SelectElement } from '@vueform/vueform'
import { SelectElement as SelectElementTemplate } from '@vueform/vueform/dist/vueform'
import { ref } from 'vue'
import APP_LOADER from '@/appData.js'

export default defineElement({
  ...SelectElement, // adding props, mixins, emits
  name: 'OrganisationElement',
  components: { Multiselect },
  props: Object.assign(SelectElement.props, { native: { type: Boolean, default: false } }),
  data() {
    return { APP_DATA: APP_LOADER.data }
  },
  methods: {
    customFilterFunction(option, search) {
      return option.name.toLowerCase().indexOf(search.toLowerCase()) > -1
    }
  },
  setup(props, context) {
    const element = SelectElement.setup(props, context)
    const defaultClasses = ref({ ...SelectElementTemplate.data().defaultClasses })
    return { ...element, defaultClasses }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>
