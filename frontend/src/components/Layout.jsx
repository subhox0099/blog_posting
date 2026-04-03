import { Outlet, Link, useNavigate } from 'react-router-dom';
import { getStoredUser, logout } from '../services/api.js';

export default function Layout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <div className="shell">
        <header className="top-nav">
          <div className="brand">Blog moderation</div>
          <nav className="nav-links">
            {!user && <Link to="/login">Login</Link>}
            {user?.role === 'EMPLOYEE' && (
              <>
                <Link to="/dashboard/employee">Categories</Link>
                <Link to="/dashboard/employee/my-blogs">My blogs</Link>
              </>
            )}
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/dashboard/admin">Moderation</Link>
                <Link to="/dashboard/admin/employees">Employees</Link>
              </>
            )}
            {user && (
              <button type="button" className="btn btn-ghost" onClick={onLogout}>
                Log out
              </button>
            )}
          </nav>
        </header>
        <Outlet />
      </div>
    </>
  );
}
