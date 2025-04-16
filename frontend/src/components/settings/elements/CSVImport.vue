<template>
  <div>
    <button class="btn btn-link" @click="downloadTemplate">{{ $t('labels.csvTemplate') }}</button>
    <input class="form-control" type="file" accept=".csv,.tsv,.tab" @change="readFile" required />
  </div>
</template>

<script lang="ts">
import { csvToObjects, download } from '@/../../common/scripts.js'
import API from '@/api.js'
import { PropType, defineComponent } from 'vue'

export default defineComponent({
  name: 'CSVImport',
  emits: ['imported'],
  data() {
    return {}
  },
  components: {},
  props: {
    endpoint: { type: String, required: true },
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
      return csvToObjects(csvWithoutComment, transformer, ';')
    },
    async submit(data: any[]) {
      const result = await API.setter<any[]>(this.endpoint, data)
      if (result.ok) {
        this.$emit('imported')
      }
    },
    downloadTemplate() {
      //Uint8Array for UTF-8 BOM
      const file = new File([new Uint8Array([0xef, 0xbb, 0xbf]), this.genTemplate()], 'CSV Import.csv', { type: 'text/csv' })
      download(file)
    },
    genTemplate(seperator = ';', pathSeperator = '.') {
      let csv = `#${this.$t('labels.startInLine3')} ${this.templateFields
        .map((f) => `"${this.$t(`labels.${f.slice(f.lastIndexOf(pathSeperator) + 1)}`)}"`)
        .join(seperator)}\n`
      csv += this.templateFields.map((f) => `"${f}"`).join(seperator)
      return csv
    }
  },
  mounted() {},
  watch: {}
})
</script>

<style></style>
