const TOKEN_KEY = 'yh_token'
const USER_ID_KEY = 'yh_user_id'

// Helper to unscramble legacy scrambled tokens from storage
function unscramble(str: string | null): string | null {
  if (!str) return null
  if (str.startsWith('scr_')) {
    try {
      const rawB64 = str.slice(4)
      const reversed = rawB64.split('').reverse().join('')
      return decodeURIComponent(atob(reversed))
    } catch {
      return str
    }
  }
  return str
}

export function getToken(): string | null {
  const val = localStorage.getItem(TOKEN_KEY)
  const plain = unscramble(val)
  if (plain && plain !== val) {
    localStorage.setItem(TOKEN_KEY, plain) // Auto-migrate to plaintext
  }
  return plain
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUserId(): string | null {
  const val = localStorage.getItem(USER_ID_KEY)
  const plain = unscramble(val)
  if (plain && plain !== val) {
    localStorage.setItem(USER_ID_KEY, plain) // Auto-migrate to plaintext
  }
  return plain
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id)
}

export function removeUserId(): void {
  localStorage.removeItem(USER_ID_KEY)
}