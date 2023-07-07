declare module 'vue' {
  interface ComponentCustomProperties {
    $t: ((key: string) => string) | ((key: string, options: any) => string)
  }
}

export {}
