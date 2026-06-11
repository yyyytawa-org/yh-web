import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore, CDN_DOMAINS } from '../store/settingsStore'

interface DomainState {
  value: string
  saved: boolean
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { proxyMap, setProxy, removeProxy } = useSettingsStore()
  const [proxyOpen, setProxyOpen] = useState(false)

  /** 每个域名的输入状态 */
  const [domainStates, setDomainStates] = useState<Record<string, DomainState>>(() => {
    const init: Record<string, DomainState> = {}
    for (const domain of CDN_DOMAINS) {
      init[domain] = { value: proxyMap[domain] || '', saved: false }
    }
    return init
  })

  /** 更新某个域名的输入值 */
  const updateDomainValue = (domain: string, value: string) => {
    setDomainStates((prev) => ({ ...prev, [domain]: { ...prev[domain], value } }))
  }

  /** 保存某个域名的反代设置 */
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
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* 顶部栏 */}
      <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => navigate('/chat')} className="text-gray-400 hover:text-gray-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="font-semibold text-gray-800">设置</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 反代设置 */}
        <div className="bg-white rounded-xl overflow-hidden">
          <button
            onClick={() => setProxyOpen(!proxyOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div>
              <h3 className="font-medium text-sm text-gray-800 text-left">媒体资源反代</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                已设置 {Object.values(proxyMap).filter(Boolean).length}/{CDN_DOMAINS.length} 个域名
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-gray-400 transition-transform ${proxyOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {proxyOpen && (
            <div className="border-t border-gray-100 px-4 py-3 space-y-3">
              {CDN_DOMAINS.map((domain) => {
                const state = domainStates[domain]
                return (
                  <div key={domain}>
                    <label className="text-xs text-gray-500 mb-1 block">{domain}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="反代地址（可选）"
                        value={state.value}
                        onChange={(e) => updateDomainValue(domain, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-300"
                      />
                      <button
                        onClick={() => handleSave(domain)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          state.saved
                            ? 'bg-green-100 text-green-600'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {state.saved ? '✓' : '保存'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 退出登录 */}
        <div className="bg-white rounded-xl overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full py-3 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}