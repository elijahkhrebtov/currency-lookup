import { useEffect, useId, useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Icon } from '../ui'

export default function BottomSheet({ children, title, open, busy, onClose, onClosed }) {
  const ref = useRef(null)
  const animationRef = useRef(null)
  const onClosedRef = useRef(onClosed)
  const titleId = useId()
  const [phase, setPhase] = useState('opening')

  useEffect(() => { onClosedRef.current = onClosed }, [onClosed])

  function animateTo(transform, duration, easing = 'cubic-bezier(.22, 1, .36, 1)') {
    const dialog = ref.current
    const from = getComputedStyle(dialog).transform
    animationRef.current?.cancel()
    dialog.style.transform = transform
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = dialog.animate([{ transform: from }, { transform }], { duration: reduceMotion ? 0 : duration, easing })
    animationRef.current = animation
    return animation
  }

  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.style.transform = 'translateY(100%)'
    const animation = animateTo('translateY(0px)', 260)
    animation.finished.then(() => {
      setPhase('open')
      dialog.querySelector('[data-autofocus]')?.focus({ preventScroll: true })
    }).catch(() => {})
    return () => {
      animationRef.current?.cancel()
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (open) return
    const animation = animateTo('translateY(100%)', 200, 'cubic-bezier(.4, 0, 1, 1)')
    animation.finished.then(() => onClosedRef.current()).catch(() => {})
    return () => animation.cancel()
  }, [open])

  const bind = useDrag(({ active, last, canceled, movement: [, y], swipe: [, swipeY], event }) => {
    if (event.target.closest('button')) return
    const dialog = ref.current
    if (active) {
      animationRef.current?.cancel()
      dialog.style.transform = `translateY(${Math.max(0, y)}px)`
      dialog.dataset.dragging = 'true'
    } else if (last) {
      dialog.dataset.dragging = 'false'
      const threshold = Math.min(120, dialog.offsetHeight * 0.25)
      if (!canceled && (y >= threshold || (y >= 30 && swipeY === 1))) onClose()
      else animateTo('translateY(0px)', 200).finished.catch(() => {})
    }
  }, { axis: 'y', filterTaps: true, enabled: open && !busy && phase === 'open', pointer: { keys: false }, swipe: { distance: 30, velocity: 0.5, duration: 300 } })

  function dismiss() { if (open && !busy) onClose() }

  return <dialog ref={ref} className="modal entry-sheet" aria-labelledby={titleId} aria-busy={busy || undefined} data-state={open ? phase : 'closing'} onCancel={(event) => { event.preventDefault(); dismiss() }} onClick={(event) => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss()
  }}>
    <div className="sheet-drag-region" {...bind()}>
      <div className="sheet-handle" aria-hidden="true" />
      <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" disabled={busy || !open} onClick={dismiss} aria-label="Close dialog"><Icon name="close" /></button></div>
    </div>
    <div className="sheet-content" inert={!open}>{children}</div>
  </dialog>
}
