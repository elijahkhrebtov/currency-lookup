import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { writeStorage } from './currency'
import { request, clearPrivateData } from './lib/client'
import { Icon, Modal } from './ui'
import Budget from './budget/Budget'
import Sidebar from './components/Sidebar'

export default function App() {
  const client = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setInstallPrompt(event) }
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); setInstallHelp(false) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installPrompt) { setInstallHelp(true); return }
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
    } catch { setInstallHelp(true) }
    setInstallPrompt(null)
  }

  async function signOut() {
    try {
      await request('/api/auth/logout', { method: 'POST' })
      writeStorage('pocket.signed-in.v1', false)
      await clearPrivateData(client)
    } catch { window.alert('Could not sign out. Please try again.') }
  }

  return <div className={`app-shell ${installed ? '' : 'has-install'}`}>
    <header className="app-header">
      <button className="icon-button" aria-label="Open sidebar" aria-controls="app-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
      <span className="app-title">Budget</span>
      <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><Icon name="logout" size={18} /></button>
    </header>
    <main className="page-content budget-page"><Budget /></main>
    <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    {!installed && <button className="install-button" onClick={install} aria-label="Install app" title="Install app"><Icon name="download" size={20} /></button>}
    {installHelp && <Modal title="Install app" onClose={() => setInstallHelp(false)}>
      <div className="install-help"><ol><li>Open this site in <strong>Chrome on Android</strong>.</li><li>Tap the <strong>⋮ menu</strong>.</li><li>Choose <strong>Add to home screen</strong>, then <strong>Install</strong>.</li></ol></div>
    </Modal>}
  </div>
}
