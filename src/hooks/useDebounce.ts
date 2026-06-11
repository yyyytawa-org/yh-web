import { useCallback, useRef, useEffect } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cbRef = useRef(callback)
  
  useEffect(() => {
    cbRef.current = callback
  }, [callback])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) {
      clearTimeout(timer.current)
    }
    timer.current = setTimeout(() => {
      cbRef.current(...args)
    }, delay)
  }, [delay])
}
