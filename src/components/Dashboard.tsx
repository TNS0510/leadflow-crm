import { useAuth } from '../context/AuthContext';
import { SalesRepDashboard } from './SalesRepDashboard';
import TeamLeadDashboard from './TeamLeadDashboard';
import { DashboardLayout } from './DashboardLayout';

export function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading your profile...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      {profile?.role === 'team_lead' ? (
        <TeamLeadDashboard />
      ) : (
        <SalesRepDashboard />
      )}
    </DashboardLayout>
  );
}