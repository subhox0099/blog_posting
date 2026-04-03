import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

function normalizeEmail(s) {
  return String(s || '').trim().toLowerCase();
}

export default function AdminEmployeesPage() {
  const [websites, setWebsites] = useState([]);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [websiteId, setWebsiteId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [assignWebsiteId, setAssignWebsiteId] = useState('');

  // edit row
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editWebsiteId, setEditWebsiteId] = useState('');

  const siteById = useMemo(() => {
    const m = new Map();
    for (const w of websites) m.set(w._id, w);
    return m;
  }, [websites]);

  async function loadWebsites() {
    const { data } = await api.get('/admin/websites');
    setWebsites(data.items || []);
    if (!assignWebsiteId && data.items?.length) setAssignWebsiteId(data.items[0]._id);
  }

  async function loadEmployees() {
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (websiteId) params.websiteId = websiteId;
    const { data } = await api.get('/admin/employees', { params });
    setItems(data.items || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        await loadWebsites();
        await loadEmployees();
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await loadEmployees();
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, websiteId]);

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/employees', {
        email: normalizeEmail(email),
        password,
        websiteId: assignWebsiteId,
      });
      setEmail('');
      setPassword('');
      await loadEmployees();
    } catch (e2) {
      setError(e2.response?.data?.message || 'Failed to create employee');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row) {
    setEditingId(row._id);
    setEditEmail(row.email);
    setEditWebsiteId(row.websiteId?._id || row.websiteId || '');
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/employees/${editingId}`, {
        email: normalizeEmail(editEmail),
        websiteId: editWebsiteId,
      });
      setEditingId(null);
      await loadEmployees();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update employee');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/employees/${row._id}/status`, { isActive: !row.isActive });
      await loadEmployees();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row) {
    if (!confirm(`Delete employee ${row.email}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/employees/${row._id}`);
      await loadEmployees();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete employee');
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(row) {
    const pw = prompt('Enter a NEW password (8+ chars incl. letter, number, symbol):');
    if (!pw) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/employees/${row._id}/reset-password`, { password: pw });
      alert('Password reset.');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="meta">
        <Link to="/dashboard/admin">← Back to moderation</Link>
      </p>
      <h1 className="section-title" style={{ marginTop: 0 }}>Admin — employee management</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="columns-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Create employee</h3>
          <form onSubmit={onCreate}>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />
            <label>Assign website</label>
            <select value={assignWebsiteId} onChange={(e) => setAssignWebsiteId(e.target.value)} required>
              {websites.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.domain})
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={busy} type="submit">
              Create
            </button>
          </form>
          <p className="meta" style={{ marginTop: '0.75rem' }}>
            Password policy: 8+ chars, includes letter, number, symbol.
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Employees</h3>
          <label>Search email</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="alice@" />
          <label>Filter by website</label>
          <select value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
            <option value="">All websites</option>
            {websites.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Website</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const isEditing = editingId === row._id;
                  const site = row.websiteId?.name ? row.websiteId : siteById.get(row.websiteId);
                  return (
                    <tr key={row._id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem' }}>
                        {isEditing ? (
                          <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                        ) : (
                          row.email
                        )}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {isEditing ? (
                          <select value={editWebsiteId} onChange={(e) => setEditWebsiteId(e.target.value)}>
                            {websites.map((w) => (
                              <option key={w._id} value={w._id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="meta">{site?.name || '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className={`pill ${row.isActive ? 'approved' : 'rejected'}`}>
                          {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <div className="row-actions" style={{ paddingTop: 0, marginTop: 0 }}>
                          {!isEditing ? (
                            <button className="btn" type="button" disabled={busy} onClick={() => startEdit(row)}>
                              Edit
                            </button>
                          ) : (
                            <>
                              <button className="btn btn-primary" type="button" disabled={busy} onClick={saveEdit}>
                                Save
                              </button>
                              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setEditingId(null)}>
                                Cancel
                              </button>
                            </>
                          )}
                          <button className="btn" type="button" disabled={busy} onClick={() => toggleStatus(row)}>
                            {row.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn" type="button" disabled={busy} onClick={() => onResetPassword(row)}>
                            Reset password
                          </button>
                          <button className="btn btn-danger" type="button" disabled={busy} onClick={() => onDelete(row)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td className="meta" style={{ padding: '0.75rem' }} colSpan={4}>
                      No employees.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

