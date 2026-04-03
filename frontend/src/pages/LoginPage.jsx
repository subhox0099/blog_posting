import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setStoredUser } from '../services/api.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setStoredUser(data.user);
      if (data.user.role === 'ADMIN') navigate('/dashboard/admin', { replace: true });
      else navigate('/dashboard/employee', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const firstVal = Array.isArray(data?.errors) ? data.errors[0] : null;
      const msg =
        firstVal?.msg ||
        data?.message ||
        (err.code === 'ERR_NETWORK' ? 'Cannot reach API — is the backend running?' : null) ||
        'Login failed';
      setError(msg);
    }
  }

  return (
    <div className="form-panel">
      <h2>Sign in</h2>
      <p className="meta">
        Example: <code>admin@demo.com</code> / <code>Password123!</code> — create users with{' '}
        <code>npm run seed</code> in the <code>backend</code> folder (same <code>MONGODB_URI</code> as the API).
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </form>
    </div>
  );
}
