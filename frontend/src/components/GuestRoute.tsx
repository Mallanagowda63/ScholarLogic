import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Sends already-logged-in users straight to their dashboard instead of the public/auth pages
export const GuestRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    switch (user.role) {
      case 'STUDENT':
        return <Navigate to="/student/dashboard" replace />;
      case 'TRAINER':
        return <Navigate to="/trainer/dashboard" replace />;
      case 'PLACEMENT_MANAGER':
        return <Navigate to="/placement/dashboard" replace />;
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return <Navigate to="/admin/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
