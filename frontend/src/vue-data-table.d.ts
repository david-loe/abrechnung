import type { DefineComponent } from 'vue'
import 'vue3-easy-data-table'

declare module 'vue3-easy-data-table' {
  const component: DefineComponent
  export default component
  export type {
    BodyItemClassNameFunction,
    BodyRowClassNameFunction,
    ClickRowArgument,
    FilterComparison,
    FilterOption,
    Header,
    HeaderItemClassNameFunction,
    Item,
    ServerOptions,
    SortType,
    TextDirection,
    UpdateSortArgument
  }
}
