import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Lead = {
  id: string
  customer_name: string
  contact_info: string | null
  inquiry_source: string | null
  product_of_interest: string | null
  status: string
  created_at: string
}

export const SalesRepDashboard: React.FC = () => {
  const { user, profile } = useAuth()

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // --- Form & Interaction State ---
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('new')
  const [interactionType, setInteractionType] = useState<string>('call')
  const [notes, setNotes] = useState<string>('')
  const [lossReason, setLossReason] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Derived state: check if loss reason is required for 'lost' status
  const showLossReason = selectedStatus === 'lost'

  const fetchAssignedLeads = useCallback(async () => {
    if (!user) {
      setLeads([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('leads')
      .select(
        'id, customer_name, contact_info, inquiry_source, product_of_interest, status, created_at'
      )
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Failed to fetch assigned leads:', fetchError)
      setError('Unable to load your leads. Please try again.')
      setLeads([])
    } else {
      setLeads((data ?? []) as Lead[])
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    void fetchAssignedLeads()
  }, [fetchAssignedLeads, retryCount])

  const handleRetry = () => {
    setRetryCount((count) => count + 1)
  }

  // Open form for a specific lead and reset/initialize state safely
  const handleOpenEditForm = (lead: { id: string; status: string }) => {
    setEditingLeadId(lead.id)
    setSelectedStatus(lead.status)
    setInteractionType('call')
    setNotes('')
    setLossReason('')
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  // Close form
  const handleCloseForm = () => {
    setEditingLeadId(null)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  // Submit status update and interaction log via atomic RPC
  const handleSubmitInteraction = async (leadId: string) => {
    const trimmedNotes = notes.trim()
    if (!trimmedNotes) {
      setErrorMessage('A follow-up note is required before saving.')
      return
    }

    if (showLossReason && !lossReason.trim()) {
      setErrorMessage('Please provide a loss reason for Closed Lost leads.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    try {
      const { error: rpcError } = await supabase.rpc('update_lead_status_with_interaction', {
        p_lead_id: leadId,
        p_new_status: selectedStatus,
        p_interaction_type: interactionType,
        p_notes: trimmedNotes,
        p_loss_reason: showLossReason ? lossReason.trim() : null,
      })

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      setSuccessMessage('Lead updated successfully!')
      
      // Refresh leads list to reflect latest state from database
      await fetchAssignedLeads() 

      // Close form after a brief confirmation moment
      setTimeout(() => {
        handleCloseForm()
      }, 1000)
    } catch (err: any) {
      console.error('Failed to update lead status:', err)
      setErrorMessage(err.message || 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6 flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Sales Representative Workspace
          </h1>

          <p className="text-sm text-gray-600">
            Welcome back, {profile?.email || 'Representative'}
          </p>
        </div>
      </header>

      <main className="grid gap-6">
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                My Work Queue
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Leads assigned to you.
              </p>
            </div>

            {!loading && !error && (
              <p className="text-sm text-gray-600">
                {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
              </p>
            )}
          </div>

          {loading && (
            <p className="mt-4 text-sm text-gray-600" role="status">
              Loading your leads...
            </p>
          )}

          {!loading && error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm text-red-700">{error}</p>

              <button
                type="button"
                onClick={handleRetry}
                className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && leads.length === 0 && (
            <div className="mt-4 rounded-md border border-gray-200 p-6 text-center">
              <h3 className="font-medium text-gray-800">
                No assigned leads yet
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Leads assigned to you will appear here.
              </p>
            </div>
          )}

          {!loading && !error && leads.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-gray-600">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-medium">Customer</th>
                    <th scope="col" className="px-3 py-3 font-medium">Contact</th>
                    <th scope="col" className="px-3 py-3 font-medium">Source</th>
                    <th scope="col" className="px-3 py-3 font-medium">Product</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="px-3 py-3 font-medium">Date Added</th>
                    <th scope="col" className="px-3 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {leads.map((lead) => {
                    const isEditing = editingLeadId === lead.id

                    return (
                      <React.Fragment key={lead.id}>
                        <tr className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-3 font-medium text-gray-900">
                            {lead.customer_name}
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {lead.contact_info || '—'}
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {lead.inquiry_source || '—'}
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {lead.product_of_interest || '—'}
                          </td>

                          <td className="px-3 py-3 text-gray-600 font-medium">
                            <span className="inline-block rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 capitalize">
                              {lead.status.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>

                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(lead)}
                              className="rounded bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                            >
                              {isEditing ? 'Editing...' : 'Update / Note'}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Interaction & Status Update Form Row */}
                        {isEditing && (
                          <tr className="bg-indigo-50/50">
                            <td colSpan={7} className="p-4">
                              <div className="rounded-md border border-indigo-100 bg-white p-4 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                                  Update Lead & Record Interaction: {lead.customer_name}
                                </h3>

                                {errorMessage && (
                                  <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">
                                    {errorMessage}
                                  </div>
                                )}

                                {successMessage && (
                                  <div className="mb-3 rounded bg-green-50 p-2 text-xs text-green-700">
                                    {successMessage}
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      New Status
                                    </label>
                                    <select
                                      value={selectedStatus}
                                      onChange={(e) => setSelectedStatus(e.target.value)}
                                      className="w-full rounded border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                      <option value="new">New</option>
                                      <option value="contacted">Contacted</option>
                                      <option value="follow_up_scheduled">Follow-up Scheduled</option>
                                      <option value="won">Won</option>
                                      <option value="lost">Lost</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Interaction Type
                                    </label>
                                    <select
                                      value={interactionType}
                                      onChange={(e) => setInteractionType(e.target.value)}
                                      className="w-full rounded border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                      <option value="call">Call</option>
                                      <option value="email">Email</option>
                                      <option value="meeting">Meeting</option>
                                      <option value="note">General Note</option>
                                      <option value="status_change">Status Change</option>
                                    </select>
                                  </div>
                                </div>

                                {showLossReason && (
                                  <div className="mb-3">
                                    <label className="block text-xs font-medium text-red-700 mb-1">
                                      Loss Reason (Required for Lost leads)
                                    </label>
                                    <input
                                      type="text"
                                      value={lossReason}
                                      onChange={(e) => setLossReason(e.target.value)}
                                      placeholder="e.g., Pricing too high, chose competitor..."
                                      className="w-full rounded border border-red-300 p-2 text-sm focus:border-red-500 focus:outline-none"
                                    />
                                  </div>
                                )}

                                <div className="mb-3">
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Follow-up Notes (Required)
                                  </label>
                                  <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Enter call summary, customer feedback, or next steps..."
                                    className="w-full rounded border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:outline-none"
                                  />
                                </div>

                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    disabled={saving}
                                    className="rounded bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void handleSubmitInteraction(lead.id)}
                                    disabled={saving}
                                    className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {saving ? 'Saving...' : 'Save Update & Note'}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}