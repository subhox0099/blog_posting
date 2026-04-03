import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getStoredUser } from '../services/api.js';
import ImageCropper from '../components/ImageCropper.jsx';

export default function BlogCreatePage() {
  const { categorySlug } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const websiteId = user?.websiteId;

  const [categories, setCategories] = useState([]);
  const [siteName, setSiteName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const authorNameTouchedRef = useRef(false);
  const [publishDate, setPublishDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [imageBlob, setImageBlob] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const onBlobReady = useCallback((blob) => setImageBlob(blob), []);

  // Auto-fill authorName only once.
  // Important: `getStoredUser()` returns a new object each render, so we key off `user?.email`
  // and stop re-filling once the user starts editing (including deleting/backspacing to empty).
  useEffect(() => {
    const local = user?.email?.split('@')[0] || '';
    if (!authorNameTouchedRef.current && !authorName) {
      setAuthorName(local);
    }
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!websiteId) {
        setError('No website assigned');
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get(`/websites/${websiteId}/categories`);
        if (cancelled) return;
        setCategories(data.categories || []);
        setSiteName(data.name || '');
        const valid = (data.categories || []).some((c) => c.slug === categorySlug);
        if (!valid) {
          setError('Invalid category.');
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load categories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [websiteId, categorySlug]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!imageBlob) {
      setError('Please upload a cover image.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('content', content);
      fd.append('authorName', authorName);
      fd.append('publishDate', new Date(publishDate).toISOString());
      fd.append('categorySlug', categorySlug);
      fd.append('image', imageBlob, 'cover.jpg');

      await api.post('/blogs', fd);
      setMessage('Submitted for review.');
      setTimeout(() => navigate('/dashboard/employee/my-blogs'), 800);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not create blog');
    }
  }

  if (loading) return <p className="meta">Loading…</p>;

  const cat = categories.find((c) => c.slug === categorySlug);

  return (
    <div>
      <p className="meta">
        <Link to="/dashboard/employee">← Categories</Link>
        {siteName && ` · ${siteName}`}
        {cat && ` · ${cat.name}`}
      </p>
      <h1 className="section-title" style={{ marginTop: 0 }}>New blog post</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      <div className="form-panel wide">
        <form onSubmit={onSubmit}>
          <ImageCropper onBlobReady={onBlobReady} />
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={500} />
          <label htmlFor="description">Short description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={600}
            rows={3}
          />
          <label htmlFor="content">Content (HTML allowed; sanitized on server)</label>
          <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required rows={12} />
          <label htmlFor="authorName">Author name</label>
          <input
            id="authorName"
            value={authorName}
            onChange={(e) => {
              authorNameTouchedRef.current = true;
              setAuthorName(e.target.value);
            }}
            required
            maxLength={120}
          />
          <label htmlFor="publishDate">Publish date</label>
          <input
            id="publishDate"
            type="datetime-local"
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">
            Submit for review
          </button>
        </form>
      </div>
    </div>
  );
}
