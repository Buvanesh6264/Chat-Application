import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageCircle, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import Button from '../components/common/Button.jsx';
import FloatingLabelInput from '../components/common/FloatingLabelInput.jsx';
import AuthBrandPanel from '../components/auth/AuthBrandPanel.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(phoneNumber, password);
      toast.success('Welcome back!');
      navigate('/chats');
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <AuthBrandPanel tagline="Message your people, beautifully." />
      <div className="flex w-full flex-col items-center justify-center p-4 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-8 flex flex-col items-center gap-1 lg:hidden">
            <MessageCircle className="h-8 w-8 text-primary-500" />
            <span className="font-display text-xl font-semibold text-ink">ChatApp</span>
          </div>
          <h1 className="mb-6 text-center font-display text-2xl font-semibold text-ink">Log in</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <FloatingLabelInput
              id="login-phone"
              type="tel"
              label="Phone number"
              icon={Phone}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              error={error}
            />
            <FloatingLabelInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="icon-btn absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-ink-muted"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Button type="submit" variant="gradient" loading={submitting} className="w-full">
              Log in
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-muted">
            No account?{' '}
            <Link to="/signup" className="text-primary-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
