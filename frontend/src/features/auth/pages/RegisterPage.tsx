import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Mail, User } from 'lucide-react'
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

const FIELDS = [
  { key: 'full_name', label: 'Full name', type: 'text', icon: User, placeholder: 'Your name' },
  { key: 'username', label: 'Username', type: 'text', icon: User, placeholder: 'username' },
  { key: 'email', label: 'Email', type: 'email', icon: Mail, placeholder: 'you@mira-lab.ai' },
  { key: 'password', label: 'Password', type: 'password', icon: Lock, placeholder: '••••••••' },
] as const

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
    <AuthSplitLayout>
      <div className="text-center mb-5">
        <p className="mira-section-label mb-1.5">Get started</p>
        <h2 className="text-xl font-semibold tracking-tight mb-1">Create account</h2>
        <p className="text-sm text-muted-foreground">Join MI-RA Studio to start annotating.</p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {FIELDS.map(({ key, label, type, icon: Icon, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-medium block mb-1.5">{label}</label>
            <div className="mira-auth-field">
              <Icon className="mira-auth-field-icon" />
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required
                placeholder={placeholder}
                className="mira-input"
              />
            </div>
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'mira-auth-submit w-full font-medium text-sm text-white mt-1',
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
    </AuthSplitLayout>
  )
}
