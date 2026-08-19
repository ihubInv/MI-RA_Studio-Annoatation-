import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

export function RegisterPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/auth/register', form)
      setTokens(data.access_token, data.refresh_token)
      const me = await api.get('/api/v1/auth/me')
      setUser(me.data)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-workspace flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-enter">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo variant="full" to={null} />
          <p className="text-muted-foreground text-xs mt-3">Create your account</p>
        </div>

        <div className="bg-white border border-border rounded-md p-6 shadow-sm">
          <h2 className="text-sm font-semibold mb-5">Create account</h2>
          {error && (
            <div className="mb-4 p-2.5 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            {(['full_name', 'username', 'email', 'password'] as const).map((field) => (
              <div key={field}>
                <label className="text-xs font-medium block mb-1 capitalize">{field.replace('_', ' ')}</label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  required
                  className="mira-input"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full h-9 rounded-md font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
