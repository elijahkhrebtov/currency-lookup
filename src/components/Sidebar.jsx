import { useEffect, useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Icon } from './Icon'
import Converter from './Converter'
import Calculator from './Calculator'

const tools = [{ id: 'converter', label: 'Converter', icon: 'arrows' }, { id: 'calculator', label: 'Calculator', icon: 'calculator' }]

export default function Sidebar({ open, onOpenChange }) {
  const dialogRef = useRef(null)
  const panelRef = useRef(null)
  const shadeRef = useRef(null)
  const animations = useRef([])
  const backdropPress = useRef(false)
  const gestureOrigin = useRef(null)
  const [activeTool, setActiveTool] = useState('converter')
  const [visited, setVisited] = useState(false)
  if (open && !visited) setVisited(true)

  function stopAnimation() {
    animations.current.forEach(animation => animation.cancel())
    animations.current = []
  }

  function show() {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }

  function animateTo(expanded) {
    const panel = panelRef.current
    const shade = shadeRef.current
    const from = getComputedStyle(panel).transform
    const opacity = getComputedStyle(shade).opacity
    stopAnimation()
    const transform = expanded ? 'translateX(0px)' : 'translateX(-100%)'
    panel.style.transform = transform
    shade.style.opacity = expanded ? '1' : '0'
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260
    const options = { duration, easing: 'cubic-bezier(.22, 1, .36, 1)' }
    const slide = panel.animate([{ transform: from }, { transform }], options)
    const fade = shade.animate([{ opacity }, { opacity: expanded ? '1' : '0' }], options)
    animations.current = [slide, fade]
    slide.finished.then(() => {
      if (!expanded) dialogRef.current.close()
    }).catch(() => {})
  }

  useEffect(() => {
    if (open) show()
    if (dialogRef.current.open) animateTo(open)
    // Animations also settle a drag back to its previous state.
  }, [open])

  useEffect(() => () => {
    stopAnimation()
    dialogRef.current?.close()
  }, [])

  const bind = useDrag(({ first, active, last, canceled, movement: [x], swipe: [swipeX], memo }) => {
    if (first) {
      // Inputs keep text selection and numeric editing; nested dialogs keep their own gestures.
      const blocked = gestureOrigin.current?.closest('input, select, textarea, [contenteditable="true"], .modal')
      if (blocked) return { allowed: false }
      show()
      const start = new DOMMatrixReadOnly(getComputedStyle(panelRef.current).transform).m41
      stopAnimation()
      setVisited(true)
      memo = { allowed: true, start, open }
    }
    if (!memo?.allowed) return memo
    const panel = panelRef.current
    const width = panel.offsetWidth
    const position = Math.max(-width, Math.min(0, memo.start + x))
    if (active) {
      panel.style.transform = `translateX(${position}px)`
      shadeRef.current.style.opacity = String(1 + position / width)
    } else if (last) {
      const expanded = canceled ? memo.open : Math.abs(x) >= 30 && swipeX ? swipeX > 0 : position > -width / 2
      if (expanded === open) animateTo(expanded)
      else onOpenChange(expanded)
    }
    return memo
  }, { axis: 'x', filterTaps: true, pointer: { keys: false, capture: false }, swipe: { distance: 30, velocity: 0.5, duration: 300 } })

  function pointerStarted(event) {
    gestureOrigin.current = event.target
    backdropPress.current = event.target === shadeRef.current
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || event.target.closest('dialog') !== dialogRef.current) return
    const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(control => control.tabIndex >= 0 && !control.closest('[hidden]'))
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus() }
  }

  function navigateTabs(event) {
    const index = tools.findIndex(tool => tool.id === activeTool)
    const next = event.key === 'ArrowRight' ? (index + 1) % tools.length
      : event.key === 'ArrowLeft' ? (index + tools.length - 1) % tools.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tools.length - 1 : null
    if (next === null) return
    event.preventDefault()
    setActiveTool(tools[next].id)
    document.getElementById(`${tools[next].id}-tab`)?.focus()
  }

  return <>
    <div className="sidebar-edge" aria-hidden="true" onPointerDownCapture={pointerStarted} {...bind()} />
    <dialog ref={dialogRef} id="app-sidebar" className="sidebar-dialog" aria-labelledby="sidebar-title" onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); onOpenChange(false) } }} onPointerDownCapture={pointerStarted} onKeyDown={trapFocus} {...bind()}>
      <div ref={shadeRef} className="sidebar-shade" aria-hidden="true" onClick={() => { if (backdropPress.current) onOpenChange(false) }} />
      <div ref={panelRef} className="sidebar-panel">
        <div className="sidebar-heading"><h2 id="sidebar-title">Tools</h2><button className="icon-button" aria-label="Close sidebar" onClick={() => onOpenChange(false)}><Icon name="close" /></button></div>
        <div id="converter-panel" role="tabpanel" aria-labelledby="converter-tab" className="sidebar-content" hidden={activeTool !== 'converter'}>{visited && <Converter />}</div>
        <div id="calculator-panel" role="tabpanel" aria-labelledby="calculator-tab" className="sidebar-content calculator-panel" hidden={activeTool !== 'calculator'}>{visited && <Calculator />}</div>
        <div className="sidebar-tabs" role="tablist" aria-label="Sidebar tools" onKeyDown={navigateTabs}>{tools.map(tool => <button key={tool.id} id={`${tool.id}-tab`} role="tab" aria-selected={activeTool === tool.id} aria-controls={`${tool.id}-panel`} tabIndex={activeTool === tool.id ? 0 : -1} onClick={() => setActiveTool(tool.id)}><Icon name={tool.icon} size={18} /><span>{tool.label}</span></button>)}</div>
      </div>
    </dialog>
  </>
}
