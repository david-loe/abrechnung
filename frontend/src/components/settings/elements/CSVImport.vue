<template>
  <h3>{{ $t('labels.csvImport') }}</h3>
  <button class="btn btn-link" @click="downloadTemplate">{{ $t('labels.csvTemplate') }}</button>
  <input class="form-control" type="file" accept=".csv,.tsv,.tab" @change="readFile" required />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { csvToObjects, download } from '../../../../../common/scripts'

export default defineComponent({
  name: 'CSVImport',
  data() {
    return {
      templateFields: ['name.givenName', 'name.familyName']
    }
  },
  components: {},
  props: { endpoint: { type: String, required: true } },
  methods: {
    readFile(event: Event) {
      if (event.target && (event.target as HTMLInputElement).files && (event.target as HTMLInputElement).files!.length > 0) {
        const file = (event.target as HTMLInputElement).files![0]
        const reader = new FileReader()
        reader.readAsText(file)
        reader.onload = (e: Event) => {
          this.submit(this.convert((e.target as FileReader).result as string))
        }
      }
    },
    convert(csv: string) {
      //remove first row if it starts with #
      if (csv.startsWith('#')) {
        csv = csv.slice(csv.indexOf('\n') + 1)
      }
      return csvToObjects(csv, {
        'settings.projects': (val: string) => {
          for (const project of this.$root.projects) {
            if (project.identifier === val) {
              return project._id
            }
          }
          throw Error(`No project found with identifier: '${val}''`)
        },
        'settings.organisation': (val: string) => {
          for (const org of this.$root.organisations) {
            if (org.name === val) {
              return org._id
            }
          }
          throw Error(`No organisation found with name: '${val}''`)
        }
      })
    },
    async submit(data: any[]) {
      const result = await this.$root.setter<any[]>(this.endpoint, data)
      if (result.error) {
        console.log(result.error)
      }
    },
    downloadTemplate() {
      const file = new File([this.genTemplate()], 'template.csv', { type: 'text/csv' })
      download(file)
    },
    genTemplate(seperator = ',', pathSeperator = '.') {
      let csv =
        '#' +
        this.$t('labels.startInLine3') +
        ' ' +
        this.templateFields.map((f) => '"' + this.$t('labels.' + f.slice(f.lastIndexOf(pathSeperator) + 1)) + '"').join(seperator) +
        '\n'
      csv += this.templateFields.map((f) => '"' + f + '"').join(seperator)
      return csv
    }
  },
  mounted() {},
  watch: {}
})
</script>

<style></style>
