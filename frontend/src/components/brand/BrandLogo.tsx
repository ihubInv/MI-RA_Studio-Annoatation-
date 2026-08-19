import { Link } from 'react-router-dom'
import { BRAND } from '@/lib/brand'
import { cn } from '@/utils/cn'

interface BrandLogoProps {
  variant?: 'full' | 'compact'
  to?: string | null
  className?: string
}

export function BrandLogo({ variant = 'compact', to = '/dashboard', className }: BrandLogoProps) {
  const img = (
    <img
      src={BRAND.logo}
      alt={`${BRAND.name} — ${BRAND.tagline}`}
      className={cn(
        'w-auto object-contain object-left',
        variant === 'full' ? 'h-16 sm:h-20' : 'h-8',
        className,
      )}
    />
  )

  if (!to) return img

  return (
    <Link to={to} className="flex items-center shrink-0" title={BRAND.product}>
      {img}
    </Link>
  )
}
