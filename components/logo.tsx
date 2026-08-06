import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  inverted?: boolean
  className?: string
  href?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function Logo({
  inverted = false,
  className = '',
  href = '/',
  size = 'md',
  showText = true,
}: LogoProps) {
  const sizeClasses = {
    sm: {
      image: 'h-8 w-auto',
      text: 'text-xs font-semibold',
      gap: 'gap-2',
    },
    md: {
      image: 'h-10 w-auto',
      text: 'text-xs sm:text-sm font-bold',
      gap: 'gap-2.5',
    },
    lg: {
      image: 'h-12 w-auto',
      text: 'text-sm sm:text-base font-bold',
      gap: 'gap-3',
    },
  }

  const selectedSize = sizeClasses[size] || sizeClasses.md

  return (
    <Link
      href={href}
      className={`inline-flex items-center shrink-0 ${selectedSize.gap} group ${className}`}
    >
      <Image
        src="/logo.png"
        alt="EF A&E Logo"
        width={160}
        height={48}
        className={`${selectedSize.image} object-contain transition-transform group-hover:scale-[1.03] ${
          inverted ? 'brightness-0 invert' : ''
        }`}
        priority
      />
      {showText && (
        <span
          className={`${selectedSize.text} tracking-tight leading-tight transition-colors ${
            inverted ? 'text-white/90' : 'text-foreground group-hover:text-primary'
          }`}
        >
          EF Architects & Engineers
        </span>
      )}
    </Link>
  )
}

