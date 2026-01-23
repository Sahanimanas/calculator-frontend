// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// For Admin routes
export const AdminRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (userType !== 'admin') {
    return <Navigate to="/resource/dashboard" replace />;
  }

  return children;
};

// For Resource routes
export const ResourceRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');

  if (!token) {
    return <Navigate to="/resource-login" state={{ from: location }} replace />;
  }

  if (userType !== 'resource') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// For any authenticated user
export const AuthenticatedRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Redirect based on user type
export const HomeRedirect = () => {
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (userType === 'resource') {
    return <Navigate to="/resource/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export default AdminRoute;
