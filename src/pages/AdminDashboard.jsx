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
  const [newCycle, setNewCycle] = useState({
    name: '',
    phase: '',
    window_open: '',
    window_close: ''
  })

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
      .update({
        locked: false,
        status: 'approved',
        updated_at: new Date().toISOString()
      })
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
    await supabase
      .from('goal_cycles')
      .update({ is_active: false })
      .neq('id', 'none')

    if (!currentState) {
      await supabase
        .from('goal_cycles')
        .update({ is_active: true })
        .eq('id', cycleId)
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

  const totalEmployees = users.filter(u => u.role === 'employee').length
  const totalGoals = goals.length
  const approvedGoals = goals.filter(g => g.status === 'approved').length
  const pendingGoals = goals.filter(g => g.status === 'submitted').length

  const checkinCompletion = QUARTERS.map(q => {
    const employeesWithApprovedGoals = [
      ...new Set(goals.filter(g => g.status === 'approved').map(g => g.employee_id))
    ]
    const completed = employeesWithApprovedGoals.filter(empId => {
      const empGoals = goals.filter(g => g.employee_id === empId && g.status === 'approved')
      return empGoals.some(g => checkins.find(c => c.goal_id === g.id && c.quarter === q))
    })
    return { quarter: q, completed: completed.length, total: employeesWithApprovedGoals.length }
  })

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity size={15} /> },
    { id: 'users', label: 'Manage Users', icon: <Users size={15} /> },
    { id: 'cycles', label: 'Goal Cycles', icon: <Settings size={15} /> },
    { id: 'goals', label: 'All Goals', icon: <ClipboardList size={15} /> },
    { id: 'audit', label: 'Audit Log', icon: <Lock size={15} /> },
    { id: 'report', label: 'Export Report', icon: <Download size={15} /> },
  ]

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
          {tabs.map(tab => (
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

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl text-sm">{success}</div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Employees', value: totalEmployees },
                { label: 'Total Goals', value: totalGoals },
                { label: 'Approved Goals', value: approvedGoals },
                { label: 'Pending Approval', value: pendingGoals },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Check-in Completion by Quarter</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {checkinCompletion.map(({ quarter, completed, total }) => (
                  <div key={quarter} className="text-center">
                    <p className="text-xs text-gray-500 mb-1">{quarter}</p>
                    <p className="text-lg font-bold text-indigo-600">{completed} / {total}</p>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Add New User</h3>
              <AddUserForm onSuccess={() => { setSuccess('User added!'); fetchAll() }} users={users} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Organisation Hierarchy</h3>
                <span className="text-xs text-gray-400">{users.length} users total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Name', 'Email', 'Role', 'Department', 'Reports To', 'Password', 'Action'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(user => {
                      const manager = users.find(u => u.id === user.manager_id)
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-700'
                              : user.role === 'manager' ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{user.department || '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{manager?.name || '—'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{user.password || '—'}</td>
                          <td className="px-4 py-3">
                            <DeleteUserButton
                              user={user}
                              goals={goals}
                              onSuccess={() => { setSuccess('User removed.'); fetchAll() }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CYCLES TAB */}
        {activeTab === 'cycles' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Create New Cycle</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cycle Name *</label>
                  <input
                    type="text"
                    value={newCycle.name}
                    onChange={e => setNewCycle({ ...newCycle, name: e.target.value })}
                    placeholder="e.g. FY 2025-26"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phase *</label>
                  <select
                    value={newCycle.phase}
                    onChange={e => setNewCycle({ ...newCycle, phase: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— Select Phase —</option>
                    <option value="goal_setting">Goal Setting</option>
                    <option value="Q1">Q1 Check-in</option>
                    <option value="Q2">Q2 Check-in</option>
                    <option value="Q3">Q3 Check-in</option>
                    <option value="Q4">Q4 / Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Window Opens *</label>
                  <input
                    type="date"
                    value={newCycle.window_open}
                    onChange={e => setNewCycle({ ...newCycle, window_open: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Window Closes *</label>
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-medium text-sm transition"
              >
                Create Cycle
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">All Cycles</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Name', 'Phase', 'Window Open', 'Window Close', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cycles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">No cycles created yet.</td>
                      </tr>
                    )}
                    {cycles.map(cycle => (
                      <tr key={cycle.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{cycle.name}</td>
                        <td className="px-4 py-3 text-gray-500">{cycle.phase}</td>
                        <td className="px-4 py-3 text-gray-500">{cycle.window_open}</td>
                        <td className="px-4 py-3 text-gray-500">{cycle.window_close}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            cycle.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {cycle.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleCycle(cycle.id, cycle.is_active)}
                            className={`text-xs px-3 py-1 rounded-lg border transition ${
                              cycle.is_active
                                ? 'border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500'
                                : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                            }`}
                          >
                            {cycle.is_active ? 'Deactivate' : 'Set Active'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ALL GOALS TAB */}
        {activeTab === 'goals' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">All Goals</h3>
              <span className="text-xs text-gray-400">{goals.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Employee', 'Dept', 'Thrust Area', 'Goal Title', 'Weightage', 'Status', 'Locked', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {goals.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">No goals found.</td>
                    </tr>
                  )}
                  {goals.map(goal => {
                    const employee = users.find(u => u.id === goal.employee_id)
                    return (
                      <tr key={goal.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{employee?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{employee?.department || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{goal.thrust_area}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={goal.title}>{goal.title}</td>
                        <td className="px-4 py-3 text-gray-500">{goal.weightage}%</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            goal.status === 'approved' ? 'bg-green-100 text-green-700'
                            : goal.status === 'submitted' ? 'bg-yellow-100 text-yellow-700'
                            : goal.status === 'rejected' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                            {goal.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {goal.locked
                            ? <span className="flex items-center gap-1 text-xs text-orange-500"><Lock size={12} /> Locked</span>
                            : <span className="flex items-center gap-1 text-xs text-gray-400"><Unlock size={12} /> Open</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {goal.locked && (
                            <button
                              onClick={() => handleUnlockGoal(goal.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg transition"
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
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Audit Log</h3>
              <span className="text-xs text-gray-400">Last 50 changes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Time', 'Table', 'Record ID', 'Change Type', 'Changed By', 'Before', 'After'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No audit logs found.</td>
                    </tr>
                  )}
                  {auditLogs.map(log => {
                    const changedBy = users.find(u => u.id === log.changed_by)
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{log.table_name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.record_id?.slice(0, 8)}…</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.change_type === 'update' ? 'bg-blue-100 text-blue-700'
                            : log.change_type === 'insert' ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {log.change_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{changedBy?.name || log.changed_by?.slice(0, 8) || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono max-w-[120px] truncate" title={JSON.stringify(log.before_data)}>
                          {JSON.stringify(log.before_data)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono max-w-[120px] truncate" title={JSON.stringify(log.after_data)}>
                          {JSON.stringify(log.after_data)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXPORT REPORT TAB */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-1">Achievement Report</h3>
              <p className="text-sm text-gray-500 mb-6">
                Export all goals with quarterly actuals, scores and statuses for every employee.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Employees', value: totalEmployees },
                  { label: 'Total Goals', value: totalGoals },
                  { label: 'Approved', value: approvedGoals },
                  { label: 'Check-in Records', value: checkins.length },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-600">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition"
              >
                <Download size={15} />
                Download Excel Report
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function AddUserForm({ onSuccess, users }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'employee', department: '', manager_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin')

  const handleAdd = async () => {
    setError('')
    if (!form.name || !form.email || !form.password || !form.role) {
      setError('Name, email, password and role are required.')
      return
    }
    const emailExists = users.find(u => u.email === form.email.trim().toLowerCase())
    if (emailExists) { setError('Email already exists.'); return }

    setSaving(true)
    const { error: insertError } = await supabase.from('users').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      department: form.department || null,
      manager_id: form.manager_id || null,
    })

    if (insertError) { setError(insertError.message); setSaving(false); return }
    setForm({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' })
    onSuccess()
    setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Amit Shah"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="amit@company.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
          <input
            type="text"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="e.g. amit123"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}
            placeholder="e.g. Marketing"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reports To (Manager)</label>
          <select
            value={form.manager_id}
            onChange={e => setForm({ ...form, manager_id: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">— None —</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
      )}

      <button
        onClick={handleAdd}
        disabled={saving}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-medium text-sm transition"
      >
        {saving ? 'Adding...' : 'Add User'}
      </button>
    </div>
  )
}

function DeleteUserButton({ user, goals, onSuccess }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const hasGoals = goals.some(g => g.employee_id === user.id)

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('users').delete().eq('id', user.id)
    onSuccess()
    setDeleting(false)
  }

  if (hasGoals) {
    return <span className="text-xs text-gray-300">Has goals</span>
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg"
        >
          {deleting ? '...' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs border border-gray-300 px-2 py-1 rounded-lg text-gray-500"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-2 py-1 rounded-lg transition"
    >
      Remove
    </button>
  )
}