import React, { useState, useEffect } from 'react'

interface AvatarProps {
  src?: string
  name: string
  isGroup?: boolean
  sizeClass?: string
  isOwn?: boolean
  className?: string
}

export default function Avatar({
  src,
  name,
  isGroup = false,
  sizeClass = 'w-10 h-10',
  isOwn = false,
  className = '',
}: AvatarProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  const initials = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?'

  const borderRadiusClass = isGroup ? 'rounded-xl' : 'rounded-full'

  if (src && !hasError) {
    return (
      <div className={`${sizeClass} ${borderRadiusClass} shrink-0 overflow-hidden bg-[var(--adw-card)] border border-[var(--adw-border)]/[0.2] ${className}`}>
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    )
  }

  // Fallback to initials
  return (
    <div
      className={`${sizeClass} ${borderRadiusClass} shrink-0 overflow-hidden flex items-center justify-center font-bold text-xs select-none shadow-xs border border-[var(--adw-border)]/[0.2] ${
        isGroup
          ? 'bg-[var(--adw-blue)]/15 text-[var(--adw-blue)]'
          : isOwn
          ? 'bg-[var(--adw-accent)] text-white'
          : 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white'
      } ${className}`}
    >
      {initials}
    </div>
  )
}
