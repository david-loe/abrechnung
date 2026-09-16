import { describe, expect, it, vi } from 'vitest'
import { createModalLifecycle } from '@/components/elements/modalLifecycle.js'

function fixture() {
  const element = Object.assign(new EventTarget(), { remove: vi.fn() }) as unknown as HTMLElement
  const modal = { hide: vi.fn(), dispose: vi.fn() }
  const afterClose = vi.fn()
  const lifecycle = createModalLifecycle(element, modal, afterClose)
  return { element, modal, afterClose, lifecycle, event: (name: string) => element.dispatchEvent(new Event(`${name}.bs.modal`)) }
}

describe('modal transitions and disposal', () => {
  it('waits for hidden before navigation and shares concurrent close requests', async () => {
    const f = fixture()
    f.event('show')
    f.event('shown')
    const navigate = vi.fn()
    const closed = f.lifecycle.close()
    void closed.then(navigate)
    expect(f.lifecycle.close()).toBe(closed)
    await Promise.resolve()
    expect(navigate).not.toHaveBeenCalled()
    f.event('hidden')
    await closed
    expect(navigate).toHaveBeenCalledOnce()
    expect(f.afterClose).toHaveBeenCalledOnce()
  })

  it('finishes an opening transition before disposing the instance', async () => {
    const f = fixture()
    f.event('show')
    f.lifecycle.dispose()
    f.lifecycle.dispose()
    expect(f.modal.dispose).not.toHaveBeenCalled()
    f.event('shown')
    expect(f.modal.hide).toHaveBeenCalledTimes(2)
    f.event('hidden')
    await Promise.resolve()
    expect(f.modal.dispose).toHaveBeenCalledOnce()
    expect(f.element.remove).toHaveBeenCalledOnce()
    expect(f.afterClose).not.toHaveBeenCalled()
    f.event('shown')
    expect(f.modal.hide).toHaveBeenCalledTimes(2)
  })

  it('closes an already hidden modal immediately and supports reopening', async () => {
    const f = fixture()
    await f.lifecycle.close()
    expect(f.modal.hide).not.toHaveBeenCalled()
    for (let i = 0; i < 2; i++) {
      f.event('show')
      f.event('shown')
      const closed = f.lifecycle.close()
      f.event('hidden')
      await closed
    }
    expect(f.afterClose).toHaveBeenCalledTimes(2)
  })
})
