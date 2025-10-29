<template>
  <div class="d-inline-flex flex-column align-items-center">
    <input ref="fileInput" class="form-control" type="file" accept=".csv,.tsv,.tab" @change="readFile" style="display: none" />

    <button :class="`btn btn-${buttonStyle}`" @click="triggerFileDialog">{{ t('labels.csvImport') }}</button>

    <button class="btn btn-sm btn-link" @click="downloadTemplate">{{ t('labels.csvTemplate') }}</button>
  </div>
</template>

<script lang="ts" setup>
import { csvToObjects, detectSeparator, download } from 'abrechnung-common/utils/scripts.js'
import { PropType, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const { t } = useI18n()

const emit = defineEmits<{ submitted: [Record<string, unknown>[]] }>()

const props = defineProps({
  endpoint: { type: String },
  buttonStyle: { type: String, default: 'outline-secondary' },
  templateFileName: { type: String, default: 'CSV Template' },
  templateFields: { type: Array as PropType<Array<string>>, required: true },
  // biome-ignore-start lint/suspicious/noExplicitAny: generic function
  transformers: {
    type: Array as PropType<
      (
        | { path: string; array: Array<{ _id: string; [key: string]: any }>; key: string }
        | { path: string; fn: (val: string | undefined) => any }
      )[]
    >,
    default: () => []
  }
  // biome-ignore-end lint/suspicious/noExplicitAny: generic function
})

const fileInputRef = useTemplateRef('fileInput')

function readFile(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = (e: Event) => {
      submit(convert((e.target as FileReader).result as string))
    }
  }
}
function convert(csv: string) {
  let csvWithoutComment = csv
  //remove first row if it starts with #
  if (csvWithoutComment.startsWith('#') || csvWithoutComment.startsWith('"#')) {
    csvWithoutComment = csvWithoutComment.slice(csv.indexOf('\n') + 1)
  }
  // biome-ignore lint/suspicious/noExplicitAny: generic function
  const transformer: { [key: string]: (val: string | undefined) => any } = {}
  for (const entry of props.transformers) {
    if ('fn' in entry) {
      transformer[entry.path] = entry.fn
    } else {
      transformer[entry.path] = (val: string | undefined) => {
        if (val) {
          for (const item of entry.array) {
            if (item[entry.key] === val) {
              return item._id
            }
          }
          throw Error(`No item found with identifier: '${val}''`)
        }
        return val
      }
    }
  }
  const separator = detectSeparator(csvWithoutComment)
  return csvToObjects(csvWithoutComment, transformer, separator)
}
async function submit(data: Record<string, unknown>[]) {
  if (props.endpoint) {
    const result = await API.setter<unknown[]>(props.endpoint, data)
    if (result.ok) {
      emit('submitted', data)
    }
  } else {
    emit('submitted', data)
  }
}
function downloadTemplate() {
  //Uint8Array for UTF-8 BOM
  const file = new File([new Uint8Array([0xef, 0xbb, 0xbf]), genTemplate()], `${props.templateFileName}.csv`, { type: 'text/csv' })
  download(file)
}
function genTemplate(seperator = ';', pathSeperator = '.') {
  let csv = `#${t('labels.startInLine3')} ${props.templateFields
    .map((f) => `"${t(`labels.${f.slice(f.lastIndexOf(pathSeperator) + 1)}`)}"`)
    .join(seperator)}\n`
  csv += props.templateFields.map((f) => `"${f}"`).join(seperator)
  return csv
}
function triggerFileDialog() {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}
</script>

<style></style>
