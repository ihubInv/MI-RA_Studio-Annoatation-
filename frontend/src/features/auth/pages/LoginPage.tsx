import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

export function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password })
      setTokens(data.access_token, data.refresh_token)
      const me = await api.get('/api/v1/auth/me')
      setUser(me.data)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-workspace flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-enter">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo variant="full" to={null} />
        </div>

        <div className="bg-white border border-border rounded-md p-6 shadow-sm">
          <h2 className="text-sm font-semibold mb-5">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-2.5 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@mira-lab.ai"
                className="mira-input"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mira-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full h-9 rounded-md font-medium text-sm transition-opacity duration-150',
                'bg-primary text-primary-foreground hover:opacity-90',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>

        <p className="text-center text-2xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} MI-RA Lab
        </p>
      </div>
    </div>
  )
}
