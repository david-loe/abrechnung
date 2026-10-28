import { readFileSync } from 'node:fs'
import { compileTemplate, parse } from '@vue/compiler-sfc'
import { transpile } from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'

function source(path: string) {
  return readFileSync(new URL(`../src/components/${path}`, import.meta.url), 'utf8')
}

function renderTemplate(template: string, context: Record<string, unknown>) {
  const compiled = compileTemplate({
    source: template,
    filename: 'interaction.vue',
    id: 'interaction',
    compilerOptions: { mode: 'function', prefixIdentifiers: true, expressionPlugins: ['typescript'] }
  })
  expect(compiled.errors).toEqual([])
  const render = new Function('Vue', transpile(compiled.code))(Vue) as (context: Record<string, unknown>, cache: unknown[]) => Vue.VNode
  return render(context, [])
}

function nativeElement(path: string, pattern: RegExp) {
  const match = source(path).match(pattern)
  expect(match).not.toBeNull()
  return match?.[0] ?? ''
}

describe('Vue template interactions after enabling Biome', () => {
  it('keeps the API key close handlers callable and tolerates unmounted refs', () => {
    const template = parse(source('settings/elements/UserList.vue')).descriptor.template?.content ?? ''
    const afterClose = template.match(/@afterClose="([^"]+)"/)?.[1]
    const cancel = template.match(/@cancel="([^"]+)"/)?.[1]
    expect(afterClose).toBeDefined()
    expect(cancel).toBeDefined()
    const resetForm = vi.fn()
    const hideModal = vi.fn()
    for (const [expression, context, callback] of [
      [afterClose, { apiKeyForm: { resetForm } }, resetForm],
      [cancel, { apiKeyModal: { hideModal } }, hideModal]
    ] as const) {
      const button = renderTemplate(`<button @click="${expression}"></button>`, context)
      button.props?.onClick()
      expect(callback).toHaveBeenCalledOnce()
      expect(() =>
        renderTemplate(`<button @click="${expression}"></button>`, { apiKeyForm: null, apiKeyModal: null }).props?.onClick()
      ).not.toThrow()
    }
  })

  it('exposes the filter toggle as a non-submitting button and forwards its click', () => {
    const clickFilter = vi.fn()
    const template = nativeElement('settings/elements/CategoryList.vue', /<button\b[^>]*@click="[^"]*clickFilter[\s\S]*?<\/button>/)
    const context = { t: (key: string) => key, showFilter: { name: false }, clickFilter }
    const button = renderTemplate(template, context)
    expect(button.type).toBe('button')
    expect(button.props?.type).toBe('button')
    expect(button.props?.['aria-label']).toBe('labels.filter')
    expect(button.props?.['aria-expanded']).toBe(false)
    const event = new Event('click')
    button.props?.onClick(event)
    expect(clickFilter).toHaveBeenCalledWith('name', event)
    context.showFilter.name = true
    expect(renderTemplate(template, context).props?.['aria-expanded']).toBe(true)
  })

  it('keeps clicks inside filter controls from activating the enclosing row', () => {
    const div = renderTemplate('<div @click.stop><input></div>', {})
    const event = new Event('click', { bubbles: true })
    div.props?.onClick(event)
    expect(event.cancelBubble).toBe(true)
    expect(source('settings/elements/CategoryList.vue')).toContain('<div v-if="showFilter.name" @click.stop>')
  })

  it('opens the file card with Enter and Space without intercepting child buttons', () => {
    const onCardClick = vi.fn()
    const openingTag = source('elements/FileUploadFileElement.vue').match(/<div\b[^>]*role="button"[^>]*>/)?.[0]
    expect(openingTag).toBeDefined()
    const card = renderTemplate(`${openingTag}</div>`, { onCardClick })
    const handlers = card.props?.onKeydown
    expect(handlers).toHaveLength(2)
    for (const key of ['Enter', ' ']) {
      const event = { key, target: 'card', currentTarget: 'card', preventDefault: vi.fn() }
      for (const handler of handlers) handler(event)
      expect(onCardClick).toHaveBeenLastCalledWith(event)
      if (key === ' ') expect(event.preventDefault).toHaveBeenCalled()
    }
    expect(onCardClick).toHaveBeenCalledTimes(2)
    for (const key of ['Enter', ' ']) {
      const event = { key, target: 'child-button', currentTarget: 'card', preventDefault: vi.fn() }
      for (const handler of handlers) handler(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    }
    expect(onCardClick).toHaveBeenCalledTimes(2)
  })
})
