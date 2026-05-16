import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { CheckCircle, XCircle, Eye, MessageSquare, Users, TrendingUp, ClipboardList } from 'lucide-react'

const UOM_LABELS = {
  numeric_min: 'Numeric (Higher is better)',
  numeric_max: 'Numeric (Lower is better)',
  timeline: 'Timeline',
  zero: 'Zero-based',
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const THRUST_AREAS = [
  'Revenue Growth', 'Cost Reduction', 'Customer Satisfaction',
  'Process Improvement', 'People Development', 'Innovation',
  'Compliance & Safety', 'Digital Transformation',
]

const UOM_TYPES = [
  { value: 'numeric_min', label: 'Numeric (Higher is better)' },
  { value: 'numeric_max', label: 'Numeric (Lower is better)' },
  { value: 'timeline', label: 'Timeline (Date-based)' },
  { value: 'zero', label: 'Zero-based (0 = Success)' },
]

// ─── Shared Goals Sub-Component ───────────────────────────────────────────────
function SharedGoalsTab({ profile, teamGoals, onSuccess }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thrustArea, setThrustArea] = useState('')
  const [uomType, setUomType] = useState('')
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [existingShared, setExistingShared] = useState([])
  const [loading, setLoading] = useState(true)

  const employees = Object.values(teamGoals).map(({ employee }) => employee)

  useEffect(() => {
    fetchSharedGoals()
  }, [])

  const fetchSharedGoals = async () => {
    setLoading(true)
    const empIds = employees.map(e => e.id)
    if (empIds.length === 0) { setLoading(false); return }
    const { data } = await supabase
      .from('goals')
      .select('*')
      .in('employee_id', empIds)
      .eq('is_shared', true)
      .order('created_at', { ascending: false })
    setExistingShared(data || [])
    setLoading(false)
  }

  const toggleEmployee = (empId) => {
    setSelectedEmployees(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    )
  }

  const handlePush = async () => {
    setError('')
    if (!title) { setError('Enter a goal title.'); return }
    if (!thrustArea) { setError('Select a thrust area.'); return }
    if (!uomType) { setError('Select UoM type.'); return }
    if (selectedEmployees.length === 0) { setError('Select at least one employee.'); return }
    if (uomType === 'timeline' && !targetDate) { setError('Select a target date.'); return }
    if (uomType !== 'timeline' && uomType !== 'zero' && !target) { setError('Enter a target value.'); return }

    setSubmitting(true)

    const { data: parentGoal, error: parentError } = await supabase
      .from('goals')
      .insert({
        employee_id: profile.id,
        thrust_area: thrustArea,
        title,
        description,
        uom_type: uomType,
        target: uomType !== 'timeline' && uomType !== 'zero' ? parseFloat(target) : null,
        target_date: uomType === 'timeline' ? targetDate : null,
        weightage: 10,
        status: 'approved',
        is_shared: true,
        locked: true,
      })
      .select()
      .single()

    if (parentError) { setError(parentError.message); setSubmitting(false); return }

    for (const empId of selectedEmployees) {
      await supabase.from('goals').insert({
        employee_id: empId,
        thrust_area: thrustArea,
        title,
        description,
        uom_type: uomType,
        target: uomType !== 'timeline' && uomType !== 'zero' ? parseFloat(target) : null,
        target_date: uomType === 'timeline' ? targetDate : null,
        weightage: 10,
        status: 'approved',
        is_shared: true,
        parent_goal_id: parentGoal.id,
        locked: true,
      })
    }

    onSuccess(`Shared goal pushed to ${selectedEmployees.length} employee(s)!`)
    setTitle('')
    setDescription('')
    setThrustArea('')
    setUomType('')
    setTarget('')
    setTargetDate('')
    setSelectedEmployees([])
    fetchSharedGoals()
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1">Push Shared Goal</h3>
        <p className="text-sm text-gray-500 mb-4">
          Push a departmental KPI to your team. Employees can only adjust weightage.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Thrust Area *</label>
            <select
              value={thrustArea}
              onChange={e => setThrustArea(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select Thrust Area</option>
              {THRUST_AREAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit of Measurement *</label>
            <select
              value={uomType}
              onChange={e => setUomType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select UoM Type</option>
              {UOM_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Goal Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Achieve Zero Safety Incidents in Q1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Additional details..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {uomType && uomType !== 'zero' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {uomType === 'timeline' ? 'Target Date *' : 'Target Value *'}
              </label>
              {uomType === 'timeline' ? (
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              ) : (
                <input
                  type="number"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Push to Employees * (select one or more)
          </label>
          <div className="flex flex-wrap gap-2">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => toggleEmployee(emp.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${
                  selectedEmployees.includes(emp.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
                }`}
              >
                {selectedEmployees.includes(emp.id) ? '✓ ' : ''}{emp.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
        )}

        <button
          onClick={handlePush}
          disabled={submitting}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition text-sm"
        >
          {submitting ? 'Pushing...' : 'Push to Selected Employees'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Previously Shared Goals</h3>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : existingShared.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No shared goals yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {existingShared.map(goal => {
              const employee = Object.values(teamGoals)
                .map(t => t.employee)
                .find(e => e.id === goal.employee_id)
              return (
                <div key={goal.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                        Shared
                      </span>
                      <span className="text-xs text-gray-400">{goal.thrust_area}</span>
                    </div>
                    <p className="font-medium text-gray-800 text-sm">{goal.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      → {employee?.name || 'Manager (parent)'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-indigo-600">{goal.weightage}%</p>
                    <p className="text-xs text-gray-400">weightage</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Manager Dashboard ────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('approvals')
  const [teamGoals, setTeamGoals] = useState({})
  const [checkinData, setCheckinData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [editingGoals, setEditingGoals] = useState({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [activeQuarter, setActiveQuarter] = useState('Q1')
  const [checkinComments, setCheckinComments] = useState({})
  const [savingComment, setSavingComment] = useState(false)

  useEffect(() => {
    fetchTeamGoals()
  }, [])

  const fetchTeamGoals = async () => {
    setLoading(true)

    const { data: employees } = await supabase
      .from('users')
      .select('*')
      .eq('manager_id', profile.id)

    if (!employees || employees.length === 0) {
      setLoading(false)
      return
    }

    const employeeIds = employees.map(e => e.id)

    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .in('employee_id', employeeIds)
      .order('created_at', { ascending: false })

    const goalIds = goals?.map(g => g.id) || []
    let checkins = []
    if (goalIds.length > 0) {
      const { data: checkinRows } = await supabase
        .from('quarterly_checkins')
        .select('*')
        .in('goal_id', goalIds)
      checkins = checkinRows || []
    }

    const checkinMap = {}
    checkins.forEach(c => {
      checkinMap[`${c.goal_id}_${c.quarter}`] = c
    })
    setCheckinData(checkinMap)

    const grouped = {}
    employees.forEach(emp => {
      grouped[emp.id] = {
        employee: emp,
        goals: goals?.filter(g => g.employee_id === emp.id) || []
      }
    })

    setTeamGoals(grouped)
    setLoading(false)
  }

  const startEditing = (goals) => {
    const edits = {}
    goals.forEach(g => {
      edits[g.id] = {
        target: g.target,
        weightage: g.weightage,
        target_date: g.target_date,
      }
    })
    setEditingGoals(edits)
  }

  const updateEdit = (goalId, field, value) => {
    setEditingGoals(prev => ({
      ...prev,
      [goalId]: { ...prev[goalId], [field]: value }
    }))
  }

  const getTotalWeightage = () => {
    return Object.values(editingGoals).reduce((sum, g) => sum + (parseFloat(g.weightage) || 0), 0)
  }

  const handleApprove = async () => {
    setError('')
    const total = getTotalWeightage()
    if (Math.round(total) !== 100) {
      setError(`Total weightage must be 100%. Currently: ${total}%`)
      return
    }

    setSubmitting(true)
    const employeeGoals = teamGoals[selectedEmployee].goals.filter(g =>
      ['submitted', 'rework'].includes(g.status)
    )

    for (const goal of employeeGoals) {
      const edits = editingGoals[goal.id]
      await supabase
        .from('goals')
        .update({
          target: edits.target,
          weightage: parseFloat(edits.weightage),
          target_date: edits.target_date,
          status: 'approved',
          locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', goal.id)

      await supabase.from('goal_approvals').insert({
        goal_id: goal.id,
        manager_id: profile.id,
        action: 'approved',
        comment: comment,
      })

      await supabase.from('audit_logs').insert({
        table_name: 'goals',
        record_id: goal.id,
        changed_by: profile.id,
        change_type: 'update',
        before_data: goal,
        after_data: { ...goal, status: 'approved', locked: true },
      })
    }

    setSuccess('Goals approved and locked successfully!')
    setSelectedEmployee(null)
    setEditingGoals({})
    setComment('')
    fetchTeamGoals()
    setSubmitting(false)
  }

  const handleReturn = async () => {
    setSubmitting(true)
    const employeeGoals = teamGoals[selectedEmployee].goals.filter(g =>
      ['submitted', 'rework'].includes(g.status)
    )

    for (const goal of employeeGoals) {
      await supabase
        .from('goals')
        .update({ status: 'rework', updated_at: new Date().toISOString() })
        .eq('id', goal.id)

      await supabase.from('goal_approvals').insert({
        goal_id: goal.id,
        manager_id: profile.id,
        action: 'returned',
        comment: comment,
      })
    }

    setSuccess('Goals returned for rework.')
    setSelectedEmployee(null)
    setEditingGoals({})
    setComment('')
    fetchTeamGoals()
    setSubmitting(false)
  }

  const handleSaveCheckinComment = async (goalId, quarter) => {
    setSavingComment(true)
    const key = `${goalId}_${quarter}`
    const existing = checkinData[key]
    const newComment = checkinComments[key] || ''

    if (existing) {
      await supabase
        .from('quarterly_checkins')
        .update({ manager_comment: newComment, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase.from('quarterly_checkins').insert({
        goal_id: goalId,
        quarter: quarter,
        manager_comment: newComment,
        progress_status: 'not_started',
      })
    }

    setSuccess('Comment saved!')
    fetchTeamGoals()
    setSavingComment(false)
  }

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getStatusBadge = (status) => {
    const map = {
      submitted: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rework: 'bg-red-100 text-red-600',
      draft: 'bg-gray-100 text-gray-600',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const pendingCount = Object.values(teamGoals).filter(({ goals }) =>
    goals.some(g => g.status === 'submitted')
  ).length

  const tabs = [
    { id: 'approvals', label: 'Goal Approvals', icon: <ClipboardList size={16} /> },
    { id: 'checkins', label: 'Check-in Review', icon: <TrendingUp size={16} /> },
    { id: 'shared', label: 'Shared Goals', icon: <Users size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Manager Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your team's goals and check-ins</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSuccess(''); setError('') }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'approvals' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl text-sm">{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading team data...</div>
        ) : (
          <>
            {/* APPROVALS TAB */}
            {activeTab === 'approvals' && (
              <div className="space-y-4">
                {Object.keys(teamGoals).length === 0 ? (
                  <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No team members found.</p>
                  </div>
                ) : Object.values(teamGoals).map(({ employee, goals }) => {
                  const pendingGoals = goals.filter(g => ['submitted', 'rework'].includes(g.status))
                  const approvedGoals = goals.filter(g => g.status === 'approved')
                  return (
                    <div key={employee.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between p-5 border-b border-gray-100">
                        <div>
                          <h3 className="font-semibold text-gray-800">{employee.name}</h3>
                          <p className="text-sm text-gray-500">
                            {employee.department} · {goals.length} goal(s) ·
                            <span className="text-green-600 ml-1">{approvedGoals.length} approved</span>
                            {pendingGoals.length > 0 && (
                              <span className="text-yellow-600 ml-1">· {pendingGoals.length} pending</span>
                            )}
                          </p>
                        </div>
                        {pendingGoals.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee.id)
                              startEditing(goals)
                              setSuccess('')
                              setError('')
                            }}
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                          >
                            <Eye size={14} /> Review Goals
                          </button>
                        )}
                      </div>
                      <div className="p-5 space-y-2">
                        {goals.length === 0 ? (
                          <p className="text-sm text-gray-400">No goals submitted yet.</p>
                        ) : goals.map(goal => (
                          <div key={goal.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {goal.is_shared && (
                                <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">📌</span>
                              )}
                              <span className="text-gray-700">{goal.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">{goal.weightage}%</span>
                              {getStatusBadge(goal.status)}
                              {goal.locked && <span className="text-xs text-gray-400">🔒</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* CHECK-INS TAB */}
            {activeTab === 'checkins' && (
              <div>
                <div className="flex gap-2 mb-6">
                  {QUARTERS.map(q => (
                    <button
                      key={q}
                      onClick={() => setActiveQuarter(q)}
                      className={`px-5 py-2 rounded-xl font-medium text-sm transition ${
                        activeQuarter === q
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <div className="space-y-6">
                  {Object.values(teamGoals).map(({ employee, goals }) => {
                    const approvedGoals = goals.filter(g => g.status === 'approved')
                    if (approvedGoals.length === 0) return null

                    return (
                      <div key={employee.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="p-5 border-b border-gray-100">
                          <h3 className="font-semibold text-gray-800">{employee.name}</h3>
                          <p className="text-sm text-gray-500">{employee.department} · {activeQuarter} Check-in</p>
                        </div>

                        <div className="p-5 space-y-4">
                          {approvedGoals.map(goal => {
                            const key = `${goal.id}_${activeQuarter}`
                            const checkin = checkinData[key]
                            const commentKey = key
                            const currentComment = checkinComments[commentKey] !== undefined
                              ? checkinComments[commentKey]
                              : (checkin?.manager_comment || '')

                            return (
                              <div key={goal.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                        {goal.thrust_area}
                                      </span>
                                      {goal.is_shared && (
                                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                          📌 Shared
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="font-medium text-gray-800 mt-1">{goal.title}</h4>
                                  </div>
                                  {checkin?.progress_score !== null && checkin?.progress_score !== undefined && (
                                    <div className="text-right">
                                      <p className={`text-xl font-bold ${getScoreColor(checkin.progress_score)}`}>
                                        {checkin.progress_score}%
                                      </p>
                                      <p className="text-xs text-gray-400">score</p>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Planned Target</p>
                                    <p className="font-semibold text-gray-800">
                                      {goal.uom_type === 'timeline'
                                        ? goal.target_date
                                        : goal.uom_type === 'zero'
                                        ? '0'
                                        : goal.target || '—'}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Actual Achievement</p>
                                    <p className="font-semibold text-gray-800">
                                      {checkin?.actual_achievement ?? checkin?.actual_date ?? '—'}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Status</p>
                                    <p className="font-semibold text-gray-800 capitalize">
                                      {checkin?.progress_status?.replace('_', ' ') || '—'}
                                    </p>
                                  </div>
                                </div>

                                {checkin?.progress_score !== null && checkin?.progress_score !== undefined && (
                                  <div className="mb-3">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full transition-all ${
                                          checkin.progress_score >= 80 ? 'bg-green-500'
                                          : checkin.progress_score >= 50 ? 'bg-yellow-400'
                                          : 'bg-red-400'
                                        }`}
                                        style={{ width: `${Math.min(checkin.progress_score, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    <MessageSquare size={12} className="inline mr-1" />
                                    Check-in Comment
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={currentComment}
                                      onChange={e => setCheckinComments(prev => ({
                                        ...prev,
                                        [commentKey]: e.target.value
                                      }))}
                                      placeholder="Add feedback for this goal..."
                                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    />
                                    <button
                                      onClick={() => handleSaveCheckinComment(goal.id, activeQuarter)}
                                      disabled={savingComment}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SHARED GOALS TAB */}
            {activeTab === 'shared' && (
              <SharedGoalsTab
                profile={profile}
                teamGoals={teamGoals}
                onSuccess={setSuccess}
              />
            )}
          </>
        )}

        {/* Review Modal */}
        {selectedEmployee && teamGoals[selectedEmployee] && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">
                  Reviewing: {teamGoals[selectedEmployee].employee.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Edit targets and weightages before approving.</p>
                <div className={`mt-2 text-sm font-semibold ${Math.round(getTotalWeightage()) === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                  Total Weightage: {getTotalWeightage()}% {Math.round(getTotalWeightage()) === 100 ? '✓' : '(must be 100%)'}
                </div>
              </div>

              <div className="p-6 space-y-4">
                {teamGoals[selectedEmployee].goals.map(goal => (
                  <div key={goal.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{goal.thrust_area}</span>
                      {getStatusBadge(goal.status)}
                      {goal.is_shared && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">📌 Shared</span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-3">{goal.title}</h4>
                    {goal.description && <p className="text-sm text-gray-500 mb-3">{goal.description}</p>}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">UoM Type</label>
                        <p className="text-sm text-gray-700">{UOM_LABELS[goal.uom_type]}</p>
                      </div>

                      {goal.uom_type !== 'zero' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {goal.uom_type === 'timeline' ? 'Target Date' : 'Target Value'}
                          </label>
                          {goal.is_shared ? (
                            <p className="text-sm text-gray-500 italic">
                              {goal.uom_type === 'timeline' ? goal.target_date : goal.target} (locked)
                            </p>
                          ) : goal.uom_type === 'timeline' ? (
                            <input
                              type="date"
                              value={editingGoals[goal.id]?.target_date || ''}
                              onChange={e => updateEdit(goal.id, 'target_date', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          ) : (
                            <input
                              type="number"
                              value={editingGoals[goal.id]?.target || ''}
                              onChange={e => updateEdit(goal.id, 'target', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Weightage %</label>
                        <input
                          type="number"
                          value={editingGoals[goal.id]?.weightage || ''}
                          onChange={e => updateEdit(goal.id, 'weightage', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MessageSquare size={14} className="inline mr-1" />
                    Comment (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add feedback for the employee..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-medium transition"
                  >
                    <CheckCircle size={16} />
                    {submitting ? 'Processing...' : 'Approve & Lock'}
                  </button>
                  <button
                    onClick={handleReturn}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl font-medium transition"
                  >
                    <XCircle size={16} />
                    Return for Rework
                  </button>
                  <button
                    onClick={() => { setSelectedEmployee(null); setEditingGoals({}); setError('') }}
                    className="border border-gray-300 text-gray-600 px-5 py-2 rounded-xl font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}