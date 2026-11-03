'use client'

import { useEffect, useRef } from 'react'
import { Icon } from './components/Icon'

export { Icon }

export function Modal({ children, title, onClose, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector('[data-autofocus]')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby="modal-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => {
    if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }
  }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
    {children}
  </dialog>
}

