/**
 * 类型转换工具
 * protobufjs 解码后的 Long 类型需手动转 number，字符串字段也可能为 undefined
 */

export function toNumber(val: any, fallback: number = 0): number {
  if (val == null) return fallback
  if (typeof val === 'number') return val
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber()
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

export function toString(val: any, fallback: string = ''): string {
  if (val == null) return fallback
  return String(val)
}