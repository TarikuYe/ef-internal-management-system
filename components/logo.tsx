import Link from 'next/link'
import Image from 'next/image'

export function Logo({ inverted = false, className }: { inverted?: boolean, className?: string }) {
  return (
    <Link href="/" className={`flex items-end gap-1.5 group ${className || ''}`}>
      <Image 
        src="/logo.png" 
        alt="EF A&E Logo" 
        width={150} 
        height={40} 
        className={`h-10 w-auto transition-transform group-hover:scale-105 ${inverted ? 'brightness-0 invert' : ''}`} 
        priority 
      />
      <span className={`text-[11px] font-semibold tracking-tight pb-1.5 ${inverted ? 'text-white/80' : 'text-muted-foreground'}`}>
        EF Architects &amp; Engineers
      </span>
    </Link>
  )
}
