<template>
  <div class="d-inline-flex flex-column align-items-center">
    <input ref="fileInput" class="form-control" type="file" accept=".csv,.tsv,.tab" @change="readFile" style="display: none" />

    <button :class="`btn btn-${buttonStyle}`" @click="triggerFileDialog">{{ $t('labels.csvImport') }}</button>

    <button class="btn btn-sm btn-link" @click="downloadTemplate">{{ $t('labels.csvTemplate') }}</button>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { csvToObjects, detectSeparator, download } from '@/../../common/scripts.js'
import API from '@/api.js'

export default defineComponent({
  name: 'CSVImport',
  emits: ['submitted'],
  data() {
    return {}
  },
  components: {},
  props: {
    endpoint: { type: String },
    buttonStyle: { type: String, default: 'outline-secondary' },
    templateFileName: { type: String, default: 'CSV Template' },
    templateFields: { type: Array as PropType<Array<string>>, required: true },
    transformers: {
      type: Array as PropType<
        (
          | { path: string; array: Array<{ _id: string; [key: string]: any }>; key: string }
          | { path: string; fn: (val: string | undefined) => any }
        )[]
      >,
      default: () => []
    }
  },
  methods: {
    readFile(event: Event) {
      const target = event.target as HTMLInputElement
      if (target.files && target.files.length > 0) {
        const file = target.files[0]
        const reader = new FileReader()
        reader.readAsText(file)
        reader.onload = (e: Event) => {
          this.submit(this.convert((e.target as FileReader).result as string))
        }
      }
    },
    convert(csv: string) {
      let csvWithoutComment = csv
      //remove first row if it starts with #
      if (csvWithoutComment.startsWith('#') || csvWithoutComment.startsWith('"#')) {
        csvWithoutComment = csvWithoutComment.slice(csv.indexOf('\n') + 1)
      }
      const transformer = {} as any
      for (const entry of this.transformers) {
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
    },
    async submit(data: any[]) {
      if (this.endpoint) {
        const result = await API.setter<any[]>(this.endpoint, data)
        if (result.ok) {
          this.$emit('submitted', data)
        }
      } else {
        this.$emit('submitted', data)
      }
    },
    downloadTemplate() {
      //Uint8Array for UTF-8 BOM
      const file = new File([new Uint8Array([0xef, 0xbb, 0xbf]), this.genTemplate()], `${this.templateFileName}.csv`, { type: 'text/csv' })
      download(file)
    },
    genTemplate(seperator = ';', pathSeperator = '.') {
      let csv = `#${this.$t('labels.startInLine3')} ${this.templateFields
        .map((f) => `"${this.$t(`labels.${f.slice(f.lastIndexOf(pathSeperator) + 1)}`)}"`)
        .join(seperator)}\n`
      csv += this.templateFields.map((f) => `"${f}"`).join(seperator)
      return csv
    },
    triggerFileDialog() {
      const fileInput = this.$refs.fileInput as HTMLInputElement
      if (fileInput) {
        fileInput.click()
      }
    }
  },
  mounted() {},
  watch: {}
})
</script>

<style></style>
