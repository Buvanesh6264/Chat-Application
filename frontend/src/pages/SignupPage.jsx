import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signup(name, phoneNumber, password);
      navigate('/chats');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Signup failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign up</h1>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input
        type="tel"
        placeholder="+14155551234"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Sign up</button>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
