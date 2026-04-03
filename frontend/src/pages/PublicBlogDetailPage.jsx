import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../services/api.js';
import { assetUrl } from '../utils/assetUrl.js';

export default function PublicBlogDetailPage() {
  const { websiteId, blogId } = useParams();
  const [blog, setBlog] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const { data } = await api.get(`/blogs/${websiteId}/post/${blogId}`);
        if (!cancelled) setBlog(data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Not found');
      }
    }
    if (websiteId && blogId) load();
    return () => {
      cancelled = true;
    };
  }, [websiteId, blogId]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!blog) return <p className="meta">Loading…</p>;

  const safe = DOMPurify.sanitize(blog.content || '', { USE_PROFILES: { html: true } });

  return (
    <article className="public-article">
      <p className="meta">
        <Link to={`/site/${websiteId}`}>← Back to site</Link>
      </p>
      {blog.imageUrl && (
        <div className="public-hero">
          <img src={assetUrl(blog.imageUrl)} alt="" />
        </div>
      )}
      <span className="pill">{blog.category?.name}</span>
      <h1>{blog.title}</h1>
      <p className="article-lead">{blog.description}</p>
      <p className="meta">
        {blog.authorName}
        {blog.publishDate && ` · ${new Date(blog.publishDate).toLocaleString()}`}
      </p>
      <div className="content-html article-body" dangerouslySetInnerHTML={{ __html: safe }} />
    </article>
  );
}
