import type { Modal } from 'bootstrap'

export function createModalLifecycle(element: HTMLElement, modal: Pick<Modal, 'hide' | 'dispose'>, afterClose: () => void) {
  let visible = false
  let disposing = false
  let pendingClose: Promise<void> | undefined
  let resolveClose: (() => void) | undefined

  const onShow = () => {
    visible = true
  }
  const onShown = () => {
    if (pendingClose) modal.hide()
  }
  const onHidden = () => {
    visible = false
    resolveClose?.()
    pendingClose = undefined
    resolveClose = undefined
    if (!disposing) afterClose()
  }
  element.addEventListener('show.bs.modal', onShow)
  element.addEventListener('shown.bs.modal', onShown)
  element.addEventListener('hidden.bs.modal', onHidden)

  function close() {
    if (!visible) return Promise.resolve()
    if (pendingClose) return pendingClose
    const result = new Promise<void>((resolve) => {
      resolveClose = resolve
    })
    pendingClose = result
    // Bootstrap ignores hide() while the opening animation is running. The
    // shown listener retries it, and all callers await the same hidden event.
    modal.hide()
    return result
  }

  function dispose() {
    if (disposing) return
    disposing = true
    // Disposing before hidden nulls Bootstrap's element while its transition
    // callback still needs it. Keep that element and its listeners alive.
    void close().then(() => {
      element.removeEventListener('show.bs.modal', onShow)
      element.removeEventListener('shown.bs.modal', onShown)
      element.removeEventListener('hidden.bs.modal', onHidden)
      modal.dispose()
      element.remove()
    })
  }

  return { close, dispose }
}
