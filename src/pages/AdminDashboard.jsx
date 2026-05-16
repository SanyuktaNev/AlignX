import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { Settings, Users, ClipboardList, Lock, Unlock, Download, Activity } from 'lucide-react'
import * as XLSX from 'xlsx'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [users, setUsers] = useState([])
  const [goals, setGoals] = useState([])
  const [cycles, setCycles] = useState([])
  const [checkins, setCheckins] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [newCycle, setNewCycle] = useState({ name: '', phase: '', window_open: '', window_close: '' })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)

    const [
      { data: usersData },
      { data: goalsData },
      { data: cyclesData },
      { data: checkinsData },
      { data: auditData },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('goal_cycles').select('*').order('created_at', { ascending: false }),
      supabase.from('quarterly_checkins').select('*'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ])

    setUsers(usersData || [])
    setGoals(goalsData || [])
    setCycles(cyclesData || [])
    setCheckins(checkinsData || [])
    setAuditLogs(auditData || [])
    setLoading(false)
  }

  const handleUnlockGoal = async (goalId) => {
    await supabase
      .from('goals')
      .update({ locked: false, status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', goalId)

    await supabase.from('audit_logs').insert({
      table_name: 'goals',
      record_id: goalId,
      changed_by: profile.id,
      change_type: 'update',
      before_data: { locked: true },
      after_data: { locked: false },
    })

    setSuccess('Goal unlocked successfully.')
    fetchAll()
  }

  const handleToggleCycle = async (cycleId, currentState) => {
    // Deactivate all first
    await supabase.from('goal_cycles').update({ is_active: false }).neq('id', 'none')
    if (!currentState) {
      await supabase.from('goal_cycles').update({ is_active: true }).eq('id', cycleId)
    }
    setSuccess('Cycle updated.')
    fetchAll()
  }

  const handleCreateCycle = async () => {
    if (!newCycle.name || !newCycle.phase || !newCycle.window_open || !newCycle.window_close) {
      setError('Fill in all cycle fields.')
      return
    }
    await supabase.from('goal_cycles').insert({ ...newCycle, is_active: false })
    setSuccess('Cycle created!')
    setNewCycle({ name: '', phase: '', window_open: '', window_close: '' })
    fetchAll()
  }

  const handleExport = () => {
    const exportData = goals.map(goal => {
      const employee = users.find(u => u.id === goal.employee_id)
      const goalCheckins = checkins.filter(c => c.goal_id === goal.id)

      const row = {
        'Employee Name': employee?.name || '—',
        'Department': employee?.department || '—',
        'Thrust Area': goal.thrust_area,
        'Goal Title': goal.title,
        'UoM Type': goal.uom_type,
        'Target': goal.target || goal.target_date || 'Zero',
        'Weightage %': goal.weightage,
        'Status': goal.status,
        'Locked': goal.locked ? 'Yes' : 'No',
      }

      QUARTERS.forEach(q => {
        const checkin = goalCheckins.find(c => c.quarter === q)
        row[`${q} Actual`] = checkin?.actual_achievement ?? checkin?.actual_date ?? '—'
        row[`${q} Score %`] = checkin?.progress_score ?? '—'
        row[`${q} Status`] = checkin?.progress_status || '—'
      })

      return row
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Achievement Report')
    XLSX.writeFile(wb, 'achievement_report.xlsx')
  }

  // Stats
  const totalEmployees = users.filter(u => u.role === 'employee').length
  const totalGoals = goals.length
  const approvedGoals = goals.filter(g => g.status === 'approved').length
  const pendingGoals = goals.filter(g => g.status === 'submitted').length

  const checkinCompletion = QUARTERS.map(q => {
    const employeesWithApprovedGoals = [...new Set(goals.filter(g => g.status === 'approved').map(g => g.employee_id))]
    const completed = employeesWithApprovedGoals.filter(empId => {
      const empGoals = goals.filter(g => g.employee_id === empId && g.status === 'approved')
      return empGoals.some(g => checkins.find(c => c.goal_id === g.id && c.quarter === q))
    })
    return {
      quarter: q,
      completed: completed.length,
      total: employeesWithApprovedGoals.length,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage cycles, goals, users and reports</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={15} /> },
            { id: 'cycles', label: 'Goal Cycles', icon: <Settings size={15} /> },
            { id: 'goals', label: 'All Goals', icon: <ClipboardList size={15} /> },
            { id: 'audit', label: 'Audit Log', icon: <Lock size={15} /> },
            { id: 'report', label: 'Export Report', icon: <Download size={15} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSuccess(''); setError('') }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl text-sm">{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Total Employees', value: totalEmployees, color: 'text-indigo-600' },
                    { label: 'Total Goals', value: totalGoals, color: 'text-gray-800' },
                    { label: 'Approved Goals', value: approvedGoals, color: 'text-green-600' },
                    { label: 'Pending Approval', value: pendingGoals, color: 'text-yellow-600' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Check-in Completion */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Check-in Completion Rate</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {checkinCompletion.map(({ quarter, completed, total }) => {
                      const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                      return (
                        <div key={quarter} className="text-center">
                          <div className="relative w-20 h-20 mx-auto mb-2">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                              <circle
                                cx="18" cy="18" r="15.9" fill="none"
                                stroke={pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#6366f1'}
                                strokeWidth="3"
                                strokeDasharray={`${pct} 100`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">
                              {pct}%
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-700">{quarter}</p>
                          <p className="text-xs text-gray-400">{completed}/{total} done</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">All Users</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Name', 'Email', 'Role', 'Department', 'Goals'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.map(user => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-800">{user.name}</td>
                            <td className="px-5 py-3 text-gray-500">{user.email}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.role === 'admin' ? 'bg-purple-100 text-purple-700'
                                : user.role === 'manager' ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500">{user.department || '—'}</td>
                            <td className="px-5 py-3 text-gray-500">
                              {goals.filter(g => g.employee_id === user.id).length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* CYCLES TAB */}
            {activeTab === 'cycles' && (
              <div className="space-y-6">
                {/* Create Cycle */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-4">Create New Cycle</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cycle Name</label>
                      <input
                        type="text"
                        value={newCycle.name}
                        onChange={e => setNewCycle({ ...newCycle, name: e.target.value })}
                        placeholder="e.g. FY 2026-27"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phase</label>
                      <select
                        value={newCycle.phase}
                        onChange={e => setNewCycle({ ...newCycle, phase: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">Select Phase</option>
                        <option value="Goal Setting">Goal Setting</option>
                        <option value="Q1 Check-in">Q1 Check-in</option>
                        <option value="Q2 Check-in">Q2 Check-in</option>
                        <option value="Q3 Check-in">Q3 Check-in</option>
                        <option value="Q4 / Annual">Q4 / Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Window Opens</label>
                      <input
                        type="date"
                        value={newCycle.window_open}
                        onChange={e => setNewCycle({ ...newCycle, window_open: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Window Closes</label>
                      <input
                        type="date"
                        value={newCycle.window_close}
                        onChange={e => setNewCycle({ ...newCycle, window_close: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateCycle}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-medium text-sm transition"
                  >
                    Create Cycle
                  </button>
                </div>

                {/* Existing Cycles */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">Existing Cycles</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {cycles.map(cycle => (
                      <div key={cycle.id} className="flex items-center justify-between px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{cycle.name} — {cycle.phase}</p>
                          <p className="text-xs text-gray-400">{cycle.window_open} → {cycle.window_close}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            cycle.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {cycle.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleToggleCycle(cycle.id, cycle.is_active)}
                            className="text-xs border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-50 transition"
                          >
                            {cycle.is_active ? 'Deactivate' : 'Set Active'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ALL GOALS TAB */}
            {activeTab === 'goals' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">All Goals — Admin View</h3>
                  <p className="text-xs text-gray-400 mt-1">Unlock locked goals if edits are needed</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Employee', 'Goal Title', 'Thrust Area', 'Weightage', 'Status', 'Locked', 'Action'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {goals.map(goal => {
                        const employee = users.find(u => u.id === goal.employee_id)
                        return (
                          <tr key={goal.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{employee?.name || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{goal.title}</td>
                            <td className="px-4 py-3 text-gray-500">{goal.thrust_area}</td>
                            <td className="px-4 py-3 text-gray-500">{goal.weightage}%</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                goal.status === 'approved' ? 'bg-green-100 text-green-700'
                                : goal.status === 'submitted' ? 'bg-yellow-100 text-yellow-700'
                                : goal.status === 'rework' ? 'bg-red-100 text-red-600'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {goal.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {goal.locked
                                ? <Lock size={14} className="text-gray-400" />
                                : <Unlock size={14} className="text-green-500" />}
                            </td>
                            <td className="px-4 py-3">
                              {goal.locked && (
                                <button
                                  onClick={() => handleUnlockGoal(goal.id)}
                                  className="text-xs bg-orange-50 border border-orange-200 text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-100 transition"
                                >
                                  Unlock
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AUDIT LOG TAB */}
            {activeTab === 'audit' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Audit Trail</h3>
                  <p className="text-xs text-gray-400 mt-1">All changes made after goal lock</p>
                </div>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No audit logs yet.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {auditLogs.map(log => {
                      const changedBy = users.find(u => u.id === log.changed_by)
                      return (
                        <div key={log.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800">
                              {changedBy?.name || 'Unknown'} — {log.change_type} on {log.table_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg p-2 mt-1">
                            {log.after_data ? JSON.stringify(log.after_data).slice(0, 120) + '...' : '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* EXPORT REPORT TAB */}
            {activeTab === 'report' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
                <Download size={48} className="mx-auto text-indigo-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Achievement Report</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Export all employees' planned targets vs actual achievements across all quarters as an Excel file.
                </p>
                <button
                  onClick={handleExport}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition"
                >
                  Download Excel Report
                </button>
                <p className="text-xs text-gray-400 mt-3">
                  Includes: Employee, Goal, UoM, Target, Weightage, Q1–Q4 Actuals & Scores
                </p>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  )
}