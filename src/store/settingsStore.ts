import { create } from 'zustand'
import { CDN_DOMAINS, CDN_PREFIXES } from '../config'

interface SettingsState {
  /** 域名 → 反代 URL 映射 */
  proxyMap: Record<string, string>
  setProxy: (domain: string, url: string) => void
  removeProxy: (domain: string) => void
}

function loadProxyMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem('yh_proxy_map')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveProxyMap(map: Record<string, string>) {
  localStorage.setItem('yh_proxy_map', JSON.stringify(map))
}

export const useSettingsStore = create<SettingsState>((set) => ({
  proxyMap: loadProxyMap(),

  setProxy: (domain, url) =>
    set((state) => {
      const newMap = { ...state.proxyMap, [domain]: url }
      saveProxyMap(newMap)
      return { proxyMap: newMap }
    }),

  removeProxy: (domain) =>
    set((state) => {
      const newMap = { ...state.proxyMap }
      delete newMap[domain]
      saveProxyMap(newMap)
      return { proxyMap: newMap }
    }),
}))

/**
 * 根据设置拼接最终 URL
 * 提取原始 URL 的域名，查 proxyMap 替换，未设置则保持原样
 */
export function resolveMediaUrl(originalUrl: string): string {
  if (!originalUrl) return ''

  // 相对路径：拼接默认图片 CDN
  if (!originalUrl.startsWith('http')) {
    return `${CDN_PREFIXES.image}/${originalUrl}`
  }

  // 提取域名
  let host = ''
  try {
    host = new URL(originalUrl).host
  } catch {
    return originalUrl
  }

  // 不是云湖域名，直接返回
  if (!host.includes('jwznb.com')) return originalUrl

  // 查反代映射
  const proxyMap = useSettingsStore.getState().proxyMap
  const proxy = proxyMap[host]
  if (proxy) {
    const path = originalUrl.replace(/^https?:\/\/[^/]+/, '')
    return `${proxy.replace(/\/$/, '')}${path}`
  }

  return originalUrl
}

export { CDN_DOMAINS }