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
    if (
      !newCycle.name ||
      !newCycle.phase ||
      !newCycle.window_open ||
      !newCycle.window_close
    ) {
      setError('Fill in all cycle fields.')
      return
    }

    await supabase
      .from('goal_cycles')
      .insert({ ...newCycle, is_active: false })

    setSuccess('Cycle created!')
    setNewCycle({
      name: '',
      phase: '',
      window_open: '',
      window_close: ''
    })

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

        row[`${q} Actual`] =
          checkin?.actual_achievement ??
          checkin?.actual_date ??
          '—'

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
      ...new Set(
        goals
          .filter(g => g.status === 'approved')
          .map(g => g.employee_id)
      )
    ]

    const completed = employeesWithApprovedGoals.filter(empId => {
      const empGoals = goals.filter(
        g => g.employee_id === empId && g.status === 'approved'
      )

      return empGoals.some(g =>
        checkins.find(c => c.goal_id === g.id && c.quarter === q)
      )
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
          <h1 className="text-2xl font-bold text-gray-800">
            Admin Dashboard
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Manage cycles, goals, users and reports
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={15} /> },
            { id: 'users', label: 'Manage Users', icon: <Users size={15} /> },
            { id: 'cycles', label: 'Goal Cycles', icon: <Settings size={15} /> },
            { id: 'goals', label: 'All Goals', icon: <ClipboardList size={15} /> },
            { id: 'audit', label: 'Audit Log', icon: <Lock size={15} /> },
            { id: 'report', label: 'Export Report', icon: <Download size={15} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSuccess('')
                setError('')
              }}
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
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl text-sm">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function AddUserForm({ onSuccess, users }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: '',
    manager_id: ''
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const managers = users.filter(
    u => u.role === 'manager' || u.role === 'admin'
  )

  const handleAdd = async () => {
    setError('')

    if (!form.name || !form.email || !form.password || !form.role) {
      setError('Name, email, password and role are required.')
      return
    }

    const emailExists = users.find(
      u => u.email === form.email.trim().toLowerCase()
    )

    if (emailExists) {
      setError('Email already exists.')
      return
    }

    setSaving(true)

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        department: form.department || null,
        manager_id: form.manager_id || null,
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setForm({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      department: '',
      manager_id: ''
    })

    onSuccess()
    setSaving(false)
  }

  return (
    <div>
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
          {error}
        </div>
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

    await supabase
      .from('users')
      .delete()
      .eq('id', user.id)

    onSuccess()
    setDeleting(false)
  }

  if (hasGoals) {
    return (
      <span className="text-xs text-gray-300">
        Has goals
      </span>
    )
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