import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'sales_rep' | 'team_lead'
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // 1. Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated check
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 3. Missing profile check
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-lg bg-white p-6 shadow-md text-center">
          <h2 className="text-lg font-semibold text-red-600">Profile Loading Error</h2>
          <p className="mt-2 text-sm text-gray-600">
            We couldn't load your user profile. Please try logging out and back in, or contact your team administrator.
          </p>
        </div>
      </div>
    )
  }

  // 4. Optional Role-based check
  if (requiredRole && profile.role !== requiredRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-lg bg-white p-6 shadow-md text-center">
          <h2 className="text-lg font-semibold text-amber-600">Access Restricted</h2>
          <p className="mt-2 text-sm text-gray-600">
            You do not have permission to view this page. This area requires <span className="font-semibold">{requiredRole}</span> privileges.
          </p>
        </div>
      </div>
    )
  }

  // 5. Authorized
  return <>{children}</>
}