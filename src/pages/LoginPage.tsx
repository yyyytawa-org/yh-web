import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { emailLogin, getCaptcha, getSmsCode, smsLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useTheme } from '../contexts/ThemeContext'
import { Sun, Moon, Mail, ShieldAlert, Check, RefreshCw } from 'lucide-react'

function generateDeviceId() {
  return 'web_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

type LoginMode = 'sms' | 'email'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('email')
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="h-full flex flex-col items-center justify-center bg-[var(--adw-window)] px-4 relative transition-colors duration-200">
      {/* Theme Toggle Button in Top Right */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-full hover:bg-[var(--adw-hover)] text-[var(--adw-fg)] transition-all cursor-pointer border border-[var(--adw-border)]/[0.2] bg-[var(--adw-view)]"
        title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-[400px] flex flex-col items-center">
        {/* GNOME style user selector / App header */}
        <div className="flex flex-col items-center gap-2 mb-8 select-none">
          <div className="w-16 h-16 rounded-2xl bg-[var(--adw-blue)] flex items-center justify-center text-white shadow-md font-bold text-2xl">
            云
          </div>
          <h1 className="text-xl font-bold text-[var(--adw-fg)] tracking-wide">登录云湖</h1>
          <p className="text-xs text-[var(--adw-fg-dim)]">Mimicking RCW Interface</p>
        </div>

        {/* Card containing login form */}
        <div className="w-full card-adw p-6 flex flex-col bg-[var(--adw-card)]">
          {/* Mode Switcher */}
          <div className="flex mb-6 bg-[var(--adw-window)] rounded-full p-1 border border-[var(--adw-border)]/[0.2]">
            <button
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                mode === 'email'
                  ? 'bg-[var(--adw-view)] text-[var(--adw-fg)] shadow-sm'
                  : 'text-[var(--adw-fg-dim)] hover:text-[var(--adw-fg)]'
              }`}
              onClick={() => setMode('email')}
            >
              邮箱登录
            </button>
            <button
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                mode === 'sms'
                  ? 'bg-[var(--adw-view)] text-[var(--adw-fg)] shadow-sm'
                  : 'text-[var(--adw-fg-dim)] hover:text-[var(--adw-fg)]'
              }`}
              onClick={() => setMode('sms')}
            >
              短信登录
            </button>
          </div>

          {mode === 'email' ? <EmailLoginForm /> : <SmsLoginForm />}
        </div>

        {/* Footer logo */}
        <div className="mt-8 text-[var(--adw-fg-dim)] opacity-40 flex items-center gap-1.5 text-xs pointer-events-none font-medium uppercase tracking-wider">
          <span>YUNHU CHAT</span>
        </div>
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
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-3">
        <input
          type="email"
          placeholder="邮箱地址"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-adw text-center"
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-adw text-center"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-[var(--adw-blue)] hover:bg-[var(--adw-blue)]/90 text-white rounded-full text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm mt-2"
      >
        {loading ? '正在登录...' : '确定'}
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
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        <input
          type="tel"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input-adw text-center"
          required
        />

        {showCaptcha && (
          <div className="bg-[var(--adw-window)] border border-[var(--adw-border)]/[0.2] rounded-xl p-4 space-y-3">
            <p className="text-xs text-[var(--adw-fg-dim)] text-center">请输入图片中的验证码</p>
            {captchaImg ? (
              <div className="relative group w-full h-12 bg-white rounded-lg border border-[var(--adw-border)]/[0.2] overflow-hidden cursor-pointer">
                <img
                  src={captchaImg}
                  alt="验证码"
                  className="w-full h-full object-contain"
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
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white">
                  <RefreshCw size={14} className="animate-spin-slow" />
                </div>
              </div>
            ) : (
              <div className="w-full h-12 bg-[var(--adw-view)] rounded-lg animate-pulse" />
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入验证码"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-[var(--adw-border)]/[0.2] bg-[var(--adw-view)] text-[var(--adw-fg)] rounded-lg text-center focus:outline-none focus:border-[var(--adw-accent)] text-xs"
                autoFocus
              />
              <button
                type="button"
                disabled={sending}
                onClick={handleCaptchaSubmit}
                className="px-4 py-1.5 bg-[var(--adw-blue)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--adw-blue)]/90 disabled:opacity-50 cursor-pointer"
              >
                确认
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="验证码"
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value)}
            className="flex-1 input-adw text-center"
            required
          />
          <button
            type="button"
            disabled={countdown > 0 || sending}
            onClick={handleSendCode}
            className="px-4 bg-[var(--adw-view)] hover:bg-[var(--adw-hover)] text-[var(--adw-fg)] border border-[var(--adw-border)]/[0.2] rounded-full text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap min-w-[100px] transition-colors"
          >
            {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-[var(--adw-blue)] hover:bg-[var(--adw-blue)]/90 text-white rounded-full text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm mt-2"
      >
        {loading ? '正在登录...' : '确定'}
      </button>
    </form>
  )
}