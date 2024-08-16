<template>
  <h3>CSV Import</h3>
  <input class="form-control" type="file" accept=".csv,.tsv,.tab" @change="readFile" required />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { csvToObjects } from '../../../../../common/scripts'

export default defineComponent({
  name: 'CSVImport',
  data() {
    return {}
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
      return csvToObjects(csv)
    },
    async submit(data: any[]) {
      const result = await this.$root.setter<any[]>(this.endpoint, data)
      if (result.error) {
        console.log(result.error)
      }
    }
  },
  mounted() {},
  watch: {}
})
</script>

<style></style>
