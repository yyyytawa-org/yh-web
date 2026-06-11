import { apiClient } from './client'

// 邮箱密码登录
export async function emailLogin(email: string, password: string, deviceId: string) {
  const { data } = await apiClient.post('/v1/user/email-login', {
    email,
    password,
    deviceId,
    platform: 'Web',
  })
  return data
}

// 获取人机验证图片
export async function getCaptcha() {
  const { data } = await apiClient.post('/v1/user/captcha')
  return data
}

// 获取短信验证码
export async function getSmsCode(mobile: string, code: string, id: string) {
  const { data } = await apiClient.post('/v1/verification/get-verification-code', {
    mobile,
    code,
    id,
    platform: 'Web',
  })
  return data
}

// 短信验证码登录
export async function smsLogin(mobile: string, captcha: string, deviceId: string) {
  const { data } = await apiClient.post('/v1/user/verification-login', {
    mobile,
    captcha,
    deviceId,
    platform: 'Web',
  })
  return data
}