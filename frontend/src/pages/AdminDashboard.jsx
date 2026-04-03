import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../services/api.js';
import { assetUrl } from '../utils/assetUrl.js';

export default function AdminDashboard() {
  const [websites, setWebsites] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSites() {
      try {
        const { data } = await api.get('/admin/websites');
        if (!cancelled) setWebsites(data.items || []);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load websites');
      }
    }
    loadSites();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setBlogs([]);
      setDetail(null);
      return;
    }
    let cancelled = false;
    async function loadBlogs() {
      try {
        const { data } = await api.get(`/admin/blogs/${selectedId}`, { params: { status: 'PENDING' } });
        if (!cancelled) setBlogs(data.items || []);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load blogs');
      }
    }
    loadBlogs();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function openDetail(id) {
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/admin/blogs/detail/${id}`);
      setDetail(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load blog');
    } finally {
      setDetailLoading(false);
    }
  }

  async function moderate(id, action) {
    setBusyId(id);
    setError(null);
    try {
      const path = action === 'approve' ? `/admin/blogs/approve/${id}` : `/admin/blogs/reject/${id}`;
      await api.put(path);
      setBlogs((prev) => prev.filter((b) => b._id !== id));
      if (detail?._id === id) setDetail(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  const selectedSite = websites.find((w) => w._id === selectedId);
  const safeContent = detail?.content
    ? DOMPurify.sanitize(detail.content, { USE_PROFILES: { html: true } })
    : '';

  return (
    <div className="admin-layout">
      <h1 className="section-title" style={{ marginTop: 0 }}>Admin — moderation</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="admin-columns">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Websites</h3>
          <ul className="admin-site-list">
            {websites.map((w) => (
              <li key={w._id}>
                <button
                  type="button"
                  className={`btn ${selectedId === w._id ? 'btn-primary' : ''}`}
                  onClick={() => setSelectedId(w._id)}
                >
                  {w.name}
                </button>
                <span className="meta">
                  {' '}
                  <Link to={`/site/${w._id}`}>public</Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Pending {selectedSite ? `· ${selectedSite.name}` : ''}
          </h3>
          {!selectedId && <p className="meta">Select a website.</p>}
          {selectedId && blogs.length === 0 && <p className="meta">No pending blogs.</p>}
          <ul className="admin-pending-list">
            {blogs.map((b) => (
              <li key={b._id}>
                <button type="button" className="btn btn-ghost admin-open" onClick={() => openDetail(b._id)}>
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card admin-detail-card">
          <h3 style={{ marginTop: 0 }}>Preview</h3>
          {detailLoading && <p className="meta">Loading…</p>}
          {!detailLoading && !detail && <p className="meta">Select a post to review.</p>}
          {detail && (
            <div className="admin-preview">
              {detail.imageUrl && (
                <div className="public-hero admin-preview-hero">
                  <img src={assetUrl(detail.imageUrl)} alt="" />
                </div>
              )}
              <span className="pill">{detail.category?.name}</span>
              <h2>{detail.title}</h2>
              <p className="article-lead">{detail.description}</p>
              <p className="meta">
                Author: {detail.authorName}
                {detail.authorId?.email && ` (${detail.authorId.email})`}
                {detail.publishDate && ` · Publish: ${new Date(detail.publishDate).toLocaleString()}`}
              </p>
              <div className="content-html article-body" dangerouslySetInnerHTML={{ __html: safeContent }} />
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === detail._id}
                  onClick={() => moderate(detail._id, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busyId === detail._id}
                  onClick={() => moderate(detail._id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
