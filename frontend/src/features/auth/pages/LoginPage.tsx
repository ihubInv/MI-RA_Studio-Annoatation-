import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout'
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
    <AuthSplitLayout>
      <div className="text-center mb-6">
        <p className="mira-section-label mb-1.5">Welcome back</p>
        <h2 className="text-xl font-semibold tracking-tight mb-1">Sign in</h2>
        <p className="text-sm text-muted-foreground">Enter your email and password to continue.</p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1.5">Email</label>
          <div className="mira-auth-field">
            <Mail className="mira-auth-field-icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@mira-lab.ai"
              className="mira-input"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1.5">Password</label>
          <div className="mira-auth-field">
            <Lock className="mira-auth-field-icon" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mira-input"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            'mira-auth-submit w-full font-medium text-sm text-white mt-1',
            loading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary hover:underline font-medium">
          Register
        </Link>
      </p>
    </AuthSplitLayout>
  )
}
