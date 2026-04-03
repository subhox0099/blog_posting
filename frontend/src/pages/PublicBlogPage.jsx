import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import BlogCard from '../components/BlogCard.jsx';

export default function PublicBlogPage() {
  const { websiteId } = useParams();
  const [latest, setLatest] = useState([]);
  const [byCategory, setByCategory] = useState({});
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [latestRes, allRes] = await Promise.all([
          api.get(`/blogs/${websiteId}/latest`, { params: { limit: 6 } }),
          api.get(`/blogs/${websiteId}`, { params: { limit: 200 } }),
        ]);
        if (cancelled) return;
        const items = allRes.data.items || [];
        setLatest(latestRes.data.items || []);

        const catMap = {};
        for (const blog of items) {
          const slug = blog.category?.slug;
          if (!slug) continue;
          if (!catMap[slug]) {
            catMap[slug] = { name: blog.category.name, slug, posts: [] };
          }
          catMap[slug].posts.push(blog);
        }
        setByCategory(catMap);
        setCategories(Object.values(catMap));
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Could not load blogs');
      }
    }
    if (websiteId) load();
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <h1 className="section-title" style={{ marginTop: 0 }}>Latest</h1>
      <div className="card-grid">
        {latest.map((b) => (
          <BlogCard key={b._id} blog={b} websiteId={websiteId} linkPublic />
        ))}
      </div>
      {sortedCats.map((cat) => (
        <section key={cat.slug}>
          <h2 className="section-title">{cat.name}</h2>
          <div className="card-grid">
            {cat.posts.map((b) => (
              <BlogCard key={b._id} blog={b} websiteId={websiteId} linkPublic />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
