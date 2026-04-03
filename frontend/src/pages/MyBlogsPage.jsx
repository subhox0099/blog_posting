import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, logout } from '../services/api.js';
import { assetUrl } from '../utils/assetUrl.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function MyBlogsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const { data } = await api.get('/blogs/my', {
          params: filter ? { status: filter } : {},
        });
        if (!cancelled) setItems(data.items || []);
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
            'Failed to load';
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
  }, [filter]);

  if (loading) return <p className="meta">Loading your blogs…</p>;

  return (
    <div>
      <p className="meta">
        <Link to="/dashboard/employee">← Categories</Link>
      </p>
      <h1 className="section-title" style={{ marginTop: 0 }}>My blogs</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            className={`btn ${filter === f.value ? 'btn-primary' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="card-grid my-blog-grid">
        {items.length === 0 && <p className="meta">No posts yet.</p>}
        {items.map((b) => (
          <article key={b._id} className="card my-blog-card">
            {b.imageUrl && (
              <div className="card-thumb">
                <img src={assetUrl(b.imageUrl)} alt="" loading="lazy" />
              </div>
            )}
            <span className="pill">{b.category?.name}</span>
            <h3>{b.title}</h3>
            <p className="meta">{b.description}</p>
            <div className="meta">
              <span className={`pill ${b.status?.toLowerCase()}`}>{b.status}</span>
              {' · '}
              {b.publishDate && new Date(b.publishDate).toLocaleString()}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
