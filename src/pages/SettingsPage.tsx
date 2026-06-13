import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore, CDN_DOMAINS } from '../store/settingsStore'
import { useTheme } from '../contexts/ThemeContext'
import AdwButton from '../components/chat/AdwButton'
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  Sun, 
  Moon, 
  Globe, 
  LogOut, 
  Save, 
  Check 
} from 'lucide-react'

interface DomainState {
  value: string
  saved: boolean
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { theme, toggleTheme } = useTheme()
  const { proxyMap, setProxy, removeProxy } = useSettingsStore()
  const [proxyOpen, setProxyOpen] = useState(true) // Default to open for better usability in Adw theme

  const [domainStates, setDomainStates] = useState<Record<string, DomainState>>(() => {
    const init: Record<string, DomainState> = {}
    for (const domain of CDN_DOMAINS) {
      init[domain] = { value: proxyMap[domain] || '', saved: false }
    }
    return init
  })

  const updateDomainValue = (domain: string, value: string) => {
    setDomainStates((prev) => ({ ...prev, [domain]: { ...prev[domain], value } }))
  }

  const handleSave = (domain: string) => {
    const state = domainStates[domain]
    const trimmed = state.value.trim()
    if (trimmed) {
      setProxy(domain, trimmed)
    } else {
      removeProxy(domain)
    }
    setDomainStates((prev) => ({
      ...prev,
      [domain]: { ...prev[domain], saved: true },
    }))
    setTimeout(() => {
      setDomainStates((prev) => ({
        ...prev,
        [domain]: { ...prev[domain], saved: false },
      }))
    }, 1500)
  }

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--adw-window)] text-[var(--adw-fg)] overflow-hidden font-cantarell transition-colors duration-200">
      {/* Header Bar */}
      <div className="header-bar shrink-0">
        <AdwButton 
          ghost 
          iconOnly 
          onClick={() => navigate('/chat')} 
          title="返回聊天"
        >
          <ArrowLeft size={18} className="text-[var(--adw-fg-dim)]" />
        </AdwButton>
        <h2 className="font-bold text-sm text-[var(--adw-fg)]">设置</h2>
        <div className="w-9 h-9" /> {/* Spacer */}
      </div>

      {/* Main settings panel */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-6">
          
          {/* General settings group */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] opacity-60 ml-4">
              通用首选项
            </h3>
            <div className="card-adw bg-[var(--adw-card)] overflow-hidden divide-y divide-[var(--adw-border)]/[0.1]">
              <div 
                onClick={toggleTheme}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--adw-hover)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Sun size={16} className="text-amber-500" />
                  ) : (
                    <Moon size={16} className="text-indigo-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">深色模式</p>
                    <p className="text-[10px] text-[var(--adw-fg-dim)] opacity-70">
                      当前已开启：{theme === 'dark' ? '深色主题' : '浅色主题'}
                    </p>
                  </div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <div className={`w-9 h-5 bg-gray-300 dark:bg-zinc-700 rounded-full transition-colors ${theme === 'dark' ? 'bg-[var(--adw-blue)] dark:bg-[var(--adw-blue)]' : ''}`}>
                    <div className={`w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-4' : ''}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Media proxy settings group */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] opacity-60 ml-4">
              媒体反向代理
            </h3>
            <div className="card-adw bg-[var(--adw-card)] overflow-hidden">
              <button
                onClick={() => setProxyOpen(!proxyOpen)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--adw-hover)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <Globe size={16} className="text-[var(--adw-blue)]" />
                  <div>
                    <h4 className="text-sm font-semibold">媒体资源反代</h4>
                    <p className="text-[10px] text-[var(--adw-fg-dim)] opacity-70">
                      已设置 {Object.values(proxyMap).filter(Boolean).length}/{CDN_DOMAINS.length} 个域名
                    </p>
                  </div>
                </div>
                {proxyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {proxyOpen && (
                <div className="border-t border-[var(--adw-border)]/[0.2] px-4 py-3 space-y-4 bg-[var(--adw-view)]">
                  {CDN_DOMAINS.map((domain) => {
                    const state = domainStates[domain]
                    return (
                      <div key={domain} className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--adw-fg-dim)] block">
                          {domain}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="反代地址（可选）"
                            value={state.value}
                            onChange={(e) => updateDomainValue(domain, e.target.value)}
                            className="flex-1 input-adw py-1.5 px-3 text-xs placeholder-[var(--adw-fg-dim)]/50 bg-[var(--adw-window)]/[0.5] rounded-lg"
                          />
                          <button
                            onClick={() => handleSave(domain)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm shrink-0 ${
                              state.saved
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-[var(--adw-blue)] hover:bg-[var(--adw-blue)]/90 text-white'
                            }`}
                          >
                            {state.saved ? <Check size={12} /> : <Save size={12} />}
                            {state.saved ? '已保存' : '保存'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Account system settings group */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] opacity-60 ml-4">
              账号管理
            </h3>
            <div className="card-adw bg-[var(--adw-card)] overflow-hidden">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 hover:bg-red-500/10 text-red-500 text-sm font-bold transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span>退出登录</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}