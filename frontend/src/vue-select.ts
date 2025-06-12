import { h } from 'vue'
import vSelect from 'vue-select'

// Set the components prop default to return our fresh components

;(vSelect as unknown as any).props.components.default = () => ({
  Deselect: {
    render: () =>
      h('div', {
        style:
          'height: 32px; width: 16px;background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27 fill=%27%23343a40%27%3e%3cpath d=%27M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z%27/%3e%3c/svg%3e");background-repeat: no-repeat; background-position: center;background-size: 16px 12px;'
      })
  },
  OpenIndicator: {
    render: () =>
      h('div', {
        style:
          'height: 32px; width: 16px;background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3e%3cpath fill=%27none%27 stroke=%27%23343a40%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m2 5 6 6 6-6%27/%3e%3c/svg%3e");background-repeat: no-repeat; background-position: center;background-size: 16px 12px;'
      })
  }
})

export default vSelect
