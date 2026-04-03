import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { assetUrl } from '../utils/assetUrl.js';

export default function BlogCard({ blog, websiteId, showStatus = false, linkPublic = true }) {
  const safe = DOMPurify.sanitize(blog.content || '', { USE_PROFILES: { html: true } });
  const excerpt =
    blog.description ||
    (blog.content
      ? safe.replace(/<[^>]+>/g, '').slice(0, 160) + (String(blog.content).length > 160 ? '…' : '')
      : null);

  const canLink = linkPublic && websiteId && blog._id && blog.status === 'APPROVED';

  const inner = (
    <>
      {blog.imageUrl && (
        <div className="card-thumb">
          <img src={assetUrl(blog.imageUrl)} alt="" loading="lazy" />
        </div>
      )}
      <span className="pill">{blog.category?.name || blog.category?.slug}</span>
      <h3>{blog.title}</h3>
      <div className="meta">
        {blog.authorName && <span>{blog.authorName} · </span>}
        {(blog.publishDate || blog.createdAt) &&
          new Date(blog.publishDate || blog.createdAt).toLocaleString()}
        {showStatus && blog.status && (
          <>
            {' · '}
            <span className={`pill ${blog.status.toLowerCase()}`}>{blog.status}</span>
          </>
        )}
      </div>
      {excerpt && <p className="meta card-desc">{excerpt}</p>}
    </>
  );

  if (canLink) {
    return (
      <Link className="card card-link" to={`/site/${websiteId}/post/${blog._id}`}>
        {inner}
      </Link>
    );
  }

  return <article className="card">{inner}</article>;
}
