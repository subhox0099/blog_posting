import { Navigate } from 'react-router-dom';
import { getStoredUser } from '../services/api.js';

export default function ProtectedRoute({ children, roles }) {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
