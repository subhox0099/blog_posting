import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getStoredUser, logout } from '../services/api.js';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const websiteId = user?.websiteId;

  const [categories, setCategories] = useState([]);
  const [siteName, setSiteName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!websiteId) {
        setError('No website assigned to this account');
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get(`/websites/${websiteId}/categories`);
        if (!cancelled) {
          setCategories(data.categories || []);
          setSiteName(data.name || '');
        }
      } catch (e) {
        if (!cancelled) {
          const status = e.response?.status;
          if (status === 401 || status === 403) {
            logout();
            navigate('/login', { replace: true });
            return;
          }
          const data = e.response?.data;
          const msg =
            (data && typeof data === 'string' && data) ||
            data?.message ||
            e.message ||
            'Failed to load categories';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  if (loading) return <p className="meta">Loading categories…</p>;

  return (
    <div>
      <div className="employee-toolbar">
        <h1 className="section-title" style={{ marginTop: 0 }}>
          {siteName || 'Your site'}
        </h1>
        <div className="toolbar-actions">
          <Link className="btn" to="/dashboard/employee/my-blogs">
            My blogs
          </Link>
          {websiteId && (
            <Link className="btn btn-ghost" to={`/site/${websiteId}`}>
              Public site
            </Link>
          )}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <p className="meta">Pick a category to open the blog editor.</p>
      <div className="category-grid">
        {categories.map((c) => (
          <Link key={c.slug} className="card category-card" to={`/dashboard/employee/create/${c.slug}`}>
            <h3>{c.name}</h3>
            <p className="meta">{c.slug}</p>
            <span className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
              Create post
            </span>
          </Link>
        ))}
      </div>
      <div className="card" style={{ marginTop: '2rem' }}>
        <p className="meta">
          Posts are moderated and expire <strong>7 days</strong> after creation (TTL). Cover images are resized to
          800×400 before upload.
        </p>
      </div>
    </div>
  );
}
