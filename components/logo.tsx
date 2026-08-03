import Link from 'next/link'
import Image from 'next/image'

export function Logo({ inverted = false, className }: { inverted?: boolean, className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className || ''}`}>
      <Image 
        src="/logo.png" 
        alt="EF A&E Logo" 
        width={150} 
        height={40} 
        className={`h-10 w-auto ${inverted ? 'brightness-0 invert' : ''}`} 
        priority 
      />
    </Link>
  )
}
