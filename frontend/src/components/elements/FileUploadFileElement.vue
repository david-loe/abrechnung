<template>
  <div class="col-auto" style="max-width: 110px" :title="props.file.name">
    <div class="border rounded p-2 clickable" role="button" tabindex="0" @click="onCardClick" @keydown.enter="onCardClick">
      <div class="row justify-content-between m-0">
        <div class="col-auto p-0 dropup-center dropup file-action" v-if="isImage">
          <button
            ref="rotateToggleRef"
            type="button"
            class="btn btn-sm btn-light dropdown-toggle"
            data-bs-toggle="dropdown"
            :title="t('labels.rotate')"
            :disabled="props.disabled || props.rotating">
            <span v-if="props.rotating" class="spinner-border spinner-border-sm"></span>
            <i v-else class="bi bi-arrow-clockwise"></i>
          </button>
          <ul class="dropdown-menu p-1">
            <li class="d-flex gap-1">
              <button
                v-for="angle in ([90, 180, 270] as const)"
                type="button"
                class="btn btn-sm btn-light dropdown-item p-0"
                :title="t('labels.rotate') + ' '+ angle + '°'"
                @click="rotateAndClose(angle)">
                <RotationDegreePreview :degree="angle" />
              </button>
            </li>
          </ul>
        </div>
        <div class="col-auto p-0 file-action ms-auto">
          <button
            type="button"
            class="btn btn-sm btn-light"
            @click="props.disabled || props.rotating ? null : emit('deleted')"
            :title="t('labels.delete')"
            :disabled="props.disabled || props.rotating">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div class="fs-2 text-center"><i class="bi bi-file-earmark-text"></i></div>
      <div class="text-truncate text-center">{{ props.file.name }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { DocumentFile } from 'abrechnung-common/types.js'
import { computed, PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RotationDegreePreview from './RotationDegreePreview.vue'
import { Dropdown } from 'bootstrap'

const { t } = useI18n()

const props = defineProps({
  file: { type: Object as PropType<DocumentFile<string, Blob>>, required: true },
  disabled: { type: Boolean, default: false },
  rotating: { type: Boolean, default: false }
})
const emit = defineEmits<{ show: []; rotate: [90 | 180 | 270]; deleted: [] }>()
const isImage = computed(() => props.file.type.startsWith('image/'))
const rotateToggleRef = ref<HTMLButtonElement | null>(null)

function onCardClick(event: Event) {
  if ((event.target as Element).closest('.file-action')) {
    return
  }
  emit('show')
}

function rotateAndClose(angle: 90 | 180 | 270) {
  if (rotateToggleRef.value) {
    Dropdown.getInstance(rotateToggleRef.value)?.hide()
  }
  emit('rotate', angle)
}
</script>

<style scoped>
.dropdown-toggle::after {
  display: none;
}
</style>
