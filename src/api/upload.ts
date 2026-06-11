import { apiClient } from './client'
import SparkMD5 from 'spark-md5'

/** 上传类型 → 获取 token 的接口路径 */
const TOKEN_API_MAP: Record<'image' | 'file' | 'video', string> = {
  image: '/v1/misc/qiniu-token',
  file: '/v1/misc/qiniu-token2',
  video: '/v1/misc/qiniu-token-video',
}

/** 默认上传 host，当 query 失败时使用 */
const DEFAULT_UPLOAD_HOST = 'upload-z2.qiniup.com'

interface CachedToken {
  token: string
  deadline: number
  bucket: string
  accessKey: string
}

interface CachedHost {
  host: string
  expireAt: number
}

const tokenCache: Record<string, CachedToken> = {}
const hostCache: Record<string, CachedHost> = {}

/**
 * Base64 解码
 * 七牛 Policy 是标准 Base64 编码的 JSON 字符串
 */
function base64Decode(str: string): string {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * 解析七牛上传 token
 * 格式：AccessKey:Sign:EncodedPolicy
 * Policy 在第三段，Base64 解码后是 JSON，包含 scope（bucket）和 deadline
 */
function parseToken(raw: string): { bucket: string; deadline: number; accessKey: string } {
  const parts = raw.split(':')
  if (parts.length < 3) throw new Error('无效的上传 token')

  const accessKey = parts[0]
  const policyStr = base64Decode(parts[2])

  let scope = ''
  let deadline = 0
  try {
    const policy = JSON.parse(policyStr)
    scope = policy.scope || ''
    deadline = policy.deadline || 0
  } catch { /* 忽略解析错误，使用默认值 */ }

  // scope 格式：bucket 或 bucket:key，取冒号前的 bucket 名
  const bucket = scope.split(':')[0]

  return { bucket, deadline, accessKey }
}

/** 获取上传 token，带缓存 */
async function getUploadToken(type: 'image' | 'file' | 'video'): Promise<CachedToken> {
  const now = Math.floor(Date.now() / 1000)
  const cached = tokenCache[type]
  if (cached && cached.deadline > now + 60) return cached

  const { data } = await apiClient.get(TOKEN_API_MAP[type])
  const raw = data.data.token
  const { bucket, deadline, accessKey } = parseToken(raw)

  const info: CachedToken = { token: raw, deadline, bucket, accessKey }
  tokenCache[type] = info
  return info
}

/** 获取 bucket 的上传 Host，缓存 1 小时，失败时返回默认值 */
async function getUploadHost(bucket: string, accessKey: string): Promise<string> {
  const now = Date.now()
  const cached = hostCache[bucket]
  if (cached && cached.expireAt > now) return cached.host

  let host = DEFAULT_UPLOAD_HOST
  try {
    const resp = await fetch(
      `https://api.qiniu.com/v4/query?ak=${encodeURIComponent(accessKey)}&bucket=${encodeURIComponent(bucket)}`,
    )
    if (resp.ok) {
      const json = await resp.json()
      const domain = json?.hosts?.[0]?.up?.domains?.[0]
      if (domain) {
        host = String(domain).replace(/^https?:\/\//i, '').split('/')[0] || DEFAULT_UPLOAD_HOST
      }
    }
  } catch { /* 使用默认 host */ }

  hostCache[bucket] = { host, expireAt: now + 3600_000 }
  return host
}

/** 计算文件的 MD5 */
function fileMD5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2 * 1024 * 1024
    const chunks = Math.ceil(file.size / chunkSize)
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    let currentChunk = 0

    reader.onload = (e) => {
      spark.append(e.target!.result as ArrayBuffer)
      currentChunk++
      if (currentChunk < chunks) {
        loadNext()
      } else {
        resolve(spark.end())
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))

    function loadNext() {
      const start = currentChunk * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    loadNext()
  })
}

/** HEAD 检查文件是否已存在 */
async function fileExists(host: string, key: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://${host}/${encodeURIComponent(key)}`, { method: 'HEAD' })
    return resp.ok
  } catch {
    return false
  }
}

/** 上传结果 */
interface UploadResult {
  key: string
  url: string
}

/** 上传类型 → 云湖数据床路由前缀 */
const CDN_PREFIX_MAP: Record<string, string> = {
  image: 'https://chat-img.jwznb.com',
  file: 'https://chat-file.jwznb.com',
  video: 'https://chat-video1.jwznb.com',
}

/** 上传文件到七牛 */
async function uploadToQiniu(
  file: File,
  type: 'image' | 'file' | 'video',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const tokenInfo = await getUploadToken(type)
  const host = await getUploadHost(tokenInfo.bucket, tokenInfo.accessKey)
  const hash = await fileMD5(file)
  const key = hash
  const cdnPrefix = CDN_PREFIX_MAP[type]

  // HEAD 检查云湖 CDN 上是否已有该文件
  const exists = await fileExists(cdnPrefix.replace(/^https?:\/\//, ''), key)
  if (exists) {
    onProgress?.(100)
    return { key, url: `${cdnPrefix}/${key}` }
  }

  const formData = new FormData()
  formData.append('token', tokenInfo.token)
  formData.append('key', key)
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://${host}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const resp = JSON.parse(xhr.responseText)
          resolve({ key: resp.key || key, url: `${cdnPrefix}/${resp.key || key}` })
        } catch {
          resolve({ key, url: `${cdnPrefix}/${key}` })
        }
      } else {
        reject(new Error(`上传失败: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.send(formData)
  })
}

/** 图片压缩为 webp */
async function compressImage(file: File, quality: number = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
          } else {
            resolve(file)
          }
        },
        'image/webp',
        quality,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export { uploadToQiniu, compressImage }
export type { UploadResult }