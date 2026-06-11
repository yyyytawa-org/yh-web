import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { emailLogin, getCaptcha, getSmsCode, smsLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'

function generateDeviceId() {
  return 'web_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

type LoginMode = 'sms' | 'email'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('email')

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full" style={{ maxWidth: '420px' }}>
        <h1 className="text-2xl font-bold text-center mb-8">登录云湖</h1>

        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-md text-sm transition-colors ${
              mode === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
            onClick={() => setMode('email')}
          >
            邮箱登录
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm transition-colors ${
              mode === 'sms' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
            onClick={() => setMode('sms')}
          >
            短信登录
          </button>
        </div>

        {mode === 'email' ? <EmailLoginForm /> : <SmsLoginForm />}
      </div>
    </div>
  )
}

function EmailLoginForm() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('请填写邮箱和密码')
      return
    }

    setLoading(true)
    try {
      const deviceId = generateDeviceId()
      const res = await emailLogin(email.trim(), password, deviceId)
      if (res.code === 1 && res.data?.token) {
        login(res.data.token, '')
        navigate('/chat', { replace: true })
      } else {
        setError(res.msg || '登录失败')
      }
    } catch (err: any) {
      setError(err?.response?.data?.msg || '网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-500 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}
      <input
        type="email"
        placeholder="邮箱地址"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-base"
      />
      <input
        type="password"
        placeholder="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-base"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-base font-medium"
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}

function SmsLoginForm() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [captchaImg, setCaptchaImg] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [showCaptcha, setShowCaptcha] = useState(false)

  const startCountdown = () => {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    setError('')
    if (!phone.trim()) {
      setError('请输入手机号')
      return
    }

    // 获取人机验证图片
    setSending(true)
    try {
      const captchaRes = await getCaptcha()
      if (captchaRes.code !== 1) {
        setError('获取验证码失败')
        setSending(false)
        return
      }
      setCaptchaImg(captchaRes.data.b64s)
      setCaptchaId(captchaRes.data.id)
      setCaptchaInput('')
      setShowCaptcha(true)
    } catch (err: any) {
      setError('网络错误，请重试')
    } finally {
      setSending(false)
    }
  }

  const handleCaptchaSubmit = async () => {
    setError('')
    if (!captchaInput.trim()) {
      setError('请输入验证码')
      return
    }

    setSending(true)
    try {
      const smsRes = await getSmsCode(phone.trim(), captchaInput.trim(), captchaId)
      if (smsRes.code === 1) {
        setShowCaptcha(false)
        startCountdown()
      } else {
        setError(smsRes.msg || '发送验证码失败')
      }
    } catch (err: any) {
      setError(err?.response?.data?.msg || '网络错误')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!phone.trim() || !smsCode.trim()) {
      setError('请填写手机号和验证码')
      return
    }

    setLoading(true)
    try {
      const deviceId = generateDeviceId()
      const res = await smsLogin(phone.trim(), smsCode.trim(), deviceId)
      if (res.code === 1 && res.data?.token) {
        login(res.data.token, '')
        navigate('/chat', { replace: true })
      } else {
        setError(res.msg || '登录失败')
      }
    } catch (err: any) {
      setError(err?.response?.data?.msg || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-500 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}

      <input
        type="tel"
        placeholder="手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-base"
      />

      {/* 人机验证弹窗 */}
      {showCaptcha && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-600">请输入图片中的验证码</p>
          {captchaImg ? (
            <img
              src={captchaImg}
              alt="验证码"
              className="w-full h-12 object-contain bg-gray-100 rounded cursor-pointer"
              onClick={async () => {
                try {
                  const res = await getCaptcha()
                  if (res.code === 1) {
                    setCaptchaImg(res.data.b64s)
                    setCaptchaId(res.data.id)
                  }
                } catch {}
              }}
              title="点击刷新"
            />
          ) : (
            <div className="w-full h-12 bg-gray-100 rounded animate-pulse" />
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="输入验证码"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              autoFocus
            />
            <button
              type="button"
              disabled={sending}
              onClick={handleCaptchaSubmit}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="验证码"
          value={smsCode}
          onChange={(e) => setSmsCode(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-base"
        />
        <button
          type="button"
          disabled={countdown > 0 || sending}
          onClick={handleSendCode}
          className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg whitespace-nowrap text-sm hover:bg-gray-200 disabled:opacity-50 min-w-[110px]"
        >
          {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-base font-medium"
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}