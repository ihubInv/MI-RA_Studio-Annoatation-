import { BrandLogo } from '@/components/brand/BrandLogo'
import { BRAND } from '@/lib/brand'

interface AuthSplitLayoutProps {
  children: React.ReactNode
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen mira-app-bg flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="mira-auth-shell fade-enter">
          <aside className="mira-auth-brand flex flex-col justify-center">
            <BrandLogo variant="hero" to={null} />
            <p className="mt-6 text-base font-medium text-primary">{BRAND.product}</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md">
              Universal multimodal annotation — image, video, audio, and beyond.
            </p>
          </aside>

          <section className="mira-auth-form flex flex-col justify-center">
            {children}
          </section>
        </div>
      </div>

      <p className="text-center text-2xs text-muted-foreground pb-4">
        © {new Date().getFullYear()} MI-RA Lab
      </p>
    </div>
  )
}
