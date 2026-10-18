import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// Type definitions matching our Supabase schema
type Lead = {
  id: string;
  customer_name: string;
  contact_info: string;
  inquiry_source: string;
  product_of_interest: string;
  status: string;
  created_at: string;
  assigned_to: string | null;
  assigned_user: {
    id: string;
    email: string;
    role: string;
  } | null;
};

type AssigneeUser = {
  id: string;
  email: string;
};

export default function TeamLeadDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state & reassignment concurrency lock
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  // Fetch leads and eligible assignees (sales reps & team leads) on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Parallel fetch for team oversight leads and eligible staff assignees
        const leadsPromise = supabase
          .from('leads')
          .select(`
            *,
            assigned_user:users!leads_assigned_to_fkey (
              id,
              email,
              role
            )
          `)
          .order('created_at', { ascending: false });

        const assigneesPromise = supabase
          .from('users')
          .select('id, email')
          .in('role', ['sales_rep', 'team_lead'])
          .order('email', { ascending: true });

        const [leadsRes, assigneesRes] = await Promise.all([leadsPromise, assigneesPromise]);

        if (leadsRes.error) throw leadsRes.error;
        if (assigneesRes.error) throw assigneesRes.error;

        if (isMounted) {
          setLeads((leadsRes.data ?? []) as unknown as Lead[]);
          setAssignees(assigneesRes.data ?? []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load team lead oversight data.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handler for reassigning a lead to a new staff member
  async function handleReassignment(leadId: string, newAssigneeId: string) {
    if (updatingLeadId !== null) return;

    setUpdatingLeadId(leadId);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('leads')
        .update({ assigned_to: newAssigneeId })
        .eq('id', leadId)
        .select('id, assigned_to')
        .single();

      if (updateError) throw updateError;

      // Update local state after successful database mutation
      setLeads((currentLeads) =>
        currentLeads.map((lead) => {
          if (lead.id === data.id) {
            const matchedUser = assignees.find((user) => user.id === data.assigned_to);
            return {
              ...lead,
              assigned_to: data.assigned_to,
              assigned_user: matchedUser
                ? { id: matchedUser.id, email: matchedUser.email, role: 'sales_rep' }
                : null,
            };
          }
          return lead;
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reassign lead.'
      );
    } finally {
      setUpdatingLeadId(null);
    }
  }

  // Dynamically extract unique staff from fetched leads for the filter dropdown
  const availableReps = useMemo(() => {
    const repMap = new Map<string, string>();
    leads.forEach((lead) => {
      if (lead.assigned_to && lead.assigned_user) {
        repMap.set(lead.assigned_to, lead.assigned_user.email);
      }
    });
    return Array.from(repMap.entries()).map(([id, email]) => ({ id, email }));
  }, [leads]);

  // Filter leads based on the selected representative filter
  const filteredLeads = useMemo(() => {
    if (selectedRep === 'all') return leads;
    return leads.filter((lead) => lead.assigned_to === selectedRep);
  }, [leads, selectedRep]);

  if (loading) {
    return <p className="p-6">Loading team leads oversight queue...</p>;
  }

  return (
    <section className="p-6 max-w-7xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Lead Oversight Queue</h1>
          <p className="text-sm text-gray-600">
            Showing {filteredLeads.length} of {leads.length} total company leads
          </p>
        </div>

        {/* Sales Representative Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="rep-filter" className="text-sm font-medium text-gray-700">
            Filter by Rep:
          </label>
          <select
            id="rep-filter"
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Representatives</option>
            {availableReps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
          No leads found matching the selected filter.
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Representative
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => {
                  const isUpdating = updatingLeadId === lead.id;
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{lead.customer_name}</div>
                        <div className="text-xs text-gray-500">{lead.contact_info}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                          {lead.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {lead.product_of_interest}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <select
                            value={lead.assigned_to ?? ''}
                            disabled={isUpdating}
                            onChange={(e) => void handleReassignment(lead.id, e.target.value)}
                            className="border border-gray-300 rounded-md px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="" disabled>
                              Unassigned
                            </option>
                            {assignees.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.email}
                              </option>
                            ))}
                          </select>
                          {isUpdating && (
                            <span className="text-xs text-blue-600 animate-pulse">Saving...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}