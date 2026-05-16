import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { useNavigate } from 'react-router-dom'
import { Plus, Target, CheckCircle, Clock, AlertCircle, Trash2, TrendingUp, Edit } from 'lucide-react'

const THRUST_AREAS = [
  'Revenue Growth',
  'Cost Reduction',
  'Customer Satisfaction',
  'Process Improvement',
  'People Development',
  'Innovation',
  'Compliance & Safety',
  'Digital Transformation',
]

const UOM_TYPES = [
  { value: 'numeric_min', label: 'Numeric (Higher is better) e.g. Sales' },
  { value: 'numeric_max', label: 'Numeric (Lower is better) e.g. TAT, Cost' },
  { value: 'timeline', label: 'Timeline (Date-based)' },
  { value: 'zero', label: 'Zero-based (0 = Success) e.g. Safety incidents' },
]

const emptyGoal = {
  thrust_area: '',
  title: '',
  description: '',
  uom_type: '',
  target: '',
  target_date: '',
  weightage: '',
}

export default function EmployeeDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [goals, setGoals] = useState([])
  const [cycle, setCycle] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [goalRows, setGoalRows] = useState([{ ...emptyGoal }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [reworkMode, setReworkMode] = useState(false)
  const [reworkGoals, setReworkGoals] = useState([])
  const [managerComment, setManagerComment] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const { data: cycleData } = await supabase
      .from('goal_cycles')
      .select('*')
      .eq('is_active', true)
      .single()
    setCycle(cycleData)

    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
    setGoals(goalsData || [])

    const rework = goalsData?.filter(g => g.status === 'rework') || []
    if (rework.length > 0) {
      setReworkGoals(rework.map(g => ({
        id: g.id,
        thrust_area: g.thrust_area,
        title: g.title,
        description: g.description || '',
        uom_type: g.uom_type,
        target: g.target || '',
        target_date: g.target_date || '',
        weightage: g.weightage,
      })))

      const { data: approvalData } = await supabase
        .from('goal_approvals')
        .select('comment')
        .eq('goal_id', rework[0].id)
        .eq('action', 'returned')
        .order('created_at', { ascending: false })
        .limit(1)

      if (approvalData && approvalData[0]?.comment) {
        setManagerComment(approvalData[0].comment)
      }
    }

    setLoading(false)
  }

  const totalWeightage = goalRows.reduce((sum, g) => sum + (parseFloat(g.weightage) || 0), 0)
  const reworkTotalWeightage = reworkGoals.reduce((sum, g) => sum + (parseFloat(g.weightage) || 0), 0)

  const addGoalRow = () => {
    if (goalRows.length >= 8) { setError('Maximum 8 goals allowed.'); return }
    setGoalRows([...goalRows, { ...emptyGoal }])
  }

  const removeGoalRow = (index) => {
    if (goalRows.length === 1) return
    setGoalRows(goalRows.filter((_, i) => i !== index))
  }

  const updateGoalRow = (index, field, value) => {
    const updated = [...goalRows]
    updated[index][field] = value
    setGoalRows(updated)
    setError('')
  }

  const updateReworkGoal = (index, field, value) => {
    const updated = [...reworkGoals]
    updated[index][field] = value
    setReworkGoals(updated)
    setError('')
  }

  const validateGoals = (rows) => {
    if (rows.length > 8) return 'Maximum 8 goals allowed.'
    for (let i = 0; i < rows.length; i++) {
      const g = rows[i]
      if (!g.thrust_area) return `Goal ${i + 1}: Select a Thrust Area.`
      if (!g.title) return `Goal ${i + 1}: Enter a title.`
      if (!g.uom_type) return `Goal ${i + 1}: Select UoM type.`
      if (!g.weightage || parseFloat(g.weightage) < 10) return `Goal ${i + 1}: Minimum weightage is 10%.`
      if (g.uom_type === 'timeline' && !g.target_date) return `Goal ${i + 1}: Select a target date.`
      if (g.uom_type !== 'timeline' && g.uom_type !== 'zero' && !g.target) return `Goal ${i + 1}: Enter a target value.`
    }
    return null
  }

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    const validationError = validateGoals(goalRows)
    if (validationError) { setError(validationError); return }
    if (Math.round(totalWeightage) !== 100) {
      setError(`Total weightage must equal 100%. Currently: ${totalWeightage}%`)
      return
    }

    const existingCount = goals.filter(g => ['submitted', 'approved'].includes(g.status)).length
    if (existingCount + goalRows.length > 8) {
      setError(`You already have ${existingCount} active goals. Cannot exceed 8 total.`)
      return
    }

    setSubmitting(true)
    const inserts = goalRows.map(g => ({
      employee_id: profile.id,
      cycle_id: cycle?.id,
      thrust_area: g.thrust_area,
      title: g.title,
      description: g.description,
      uom_type: g.uom_type,
      target: g.uom_type !== 'timeline' && g.uom_type !== 'zero' ? parseFloat(g.target) : null,
      target_date: g.uom_type === 'timeline' ? g.target_date : null,
      weightage: parseFloat(g.weightage),
      status: 'submitted',
    }))

    const { error: insertError } = await supabase.from('goals').insert(inserts)
    if (insertError) { setError(insertError.message); setSubmitting(false); return }

    setSuccess('Goals submitted successfully! Awaiting manager approval.')
    setShowForm(false)
    setGoalRows([{ ...emptyGoal }])
    fetchData()
    setSubmitting(false)
  }

  const handleReworkSubmit = async () => {
    setError('')
    setSuccess('')
    const validationError = validateGoals(reworkGoals)
    if (validationError) { setError(validationError); return }
    if (Math.round(reworkTotalWeightage) !== 100) {
      setError(`Total weightage must equal 100%. Currently: ${reworkTotalWeightage}%`)
      return
    }

    setSubmitting(true)
    for (const goal of reworkGoals) {
      await supabase
        .from('goals')
        .update({
          thrust_area: goal.thrust_area,
          title: goal.title,
          description: goal.description,
          uom_type: goal.uom_type,
          target: goal.uom_type !== 'timeline' && goal.uom_type !== 'zero' ? parseFloat(goal.target) : null,
          target_date: goal.uom_type === 'timeline' ? goal.target_date : null,
          weightage: parseFloat(goal.weightage),
          status: 'submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', goal.id)
    }

    setSuccess('Goals resubmitted successfully! Awaiting manager approval.')
    setReworkMode(false)
    fetchData()
    setSubmitting(false)
  }

  const getStatusBadge = (status) => {
    const map = {
      draft: { color: 'bg-gray-100 text-gray-600', icon: <Clock size={12} />, label: 'Draft' },
      submitted: { color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} />, label: 'Pending Approval' },
      approved: { color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} />, label: 'Approved' },
      rework: { color: 'bg-red-100 text-red-600', icon: <AlertCircle size={12} />, label: 'Rework Required' },
    }
    const s = map[status] || map.draft
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>
        {s.icon} {s.label}
      </span>
    )
  }

  const hasRework = reworkGoals.length > 0

  const GoalFormFields = ({ goal, index, updateFn, isRework }) => (
    <div className={`border rounded-xl p-4 bg-gray-50 ${isRework ? 'border-red-100' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-indigo-700 text-sm">Goal {index + 1}</span>
        {!isRework && goalRows.length > 1 && (
          <button onClick={() => removeGoalRow(index)} className="text-red-400 hover:text-red-600">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Thrust Area *</label>
          <select
            value={goal.thrust_area}
            onChange={e => updateFn(index, 'thrust_area', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Select Thrust Area</option>
            {THRUST_AREAS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit of Measurement *</label>
          <select
            value={goal.uom_type}
            onChange={e => updateFn(index, 'uom_type', e.target.value)}
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
            value={goal.title}
            onChange={e => updateFn(index, 'title', e.target.value)}
            placeholder="e.g. Achieve ₹50L in Q1 Sales Revenue"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={goal.description}
            onChange={e => updateFn(index, 'description', e.target.value)}
            placeholder="Additional details about this goal..."
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {goal.uom_type && goal.uom_type !== 'zero' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {goal.uom_type === 'timeline' ? 'Target Date *' : 'Target Value *'}
            </label>
            {goal.uom_type === 'timeline' ? (
              <input
                type="date"
                value={goal.target_date}
                onChange={e => updateFn(index, 'target_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            ) : (
              <input
                type="number"
                value={goal.target}
                onChange={e => updateFn(index, 'target', e.target.value)}
                placeholder="e.g. 5000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Weightage % * (min 10%)</label>
          <input
            type="number"
            value={goal.weightage}
            onChange={e => updateFn(index, 'weightage', e.target.value)}
            placeholder="e.g. 30"
            min="10"
            max="100"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Rework Banner */}
        {hasRework && !reworkMode && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle size={16} /> Your goals were returned for rework
              </p>
              {managerComment && (
                <p className="text-sm text-red-600 mt-1">
                  Manager feedback: <strong>"{managerComment}"</strong>
                </p>
              )}
            </div>
            <button
              onClick={() => setReworkMode(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap"
            >
              <Edit size={14} /> Fix Goals
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Goals</h1>
            <p className="text-gray-500 text-sm mt-1">
              {cycle ? `Active Cycle: ${cycle.name} — ${cycle.phase}` : 'No active cycle'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/employee/checkins')}
              className="flex items-center gap-2 bg-white border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl font-medium transition"
            >
              <TrendingUp size={18} /> Quarterly Check-ins
            </button>
            {!showForm && !reworkMode && cycle && !hasRework && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition"
              >
                <Plus size={18} /> Add Goals
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl text-sm">{success}</div>}

        {/* REWORK FORM */}
        {reworkMode && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">Edit & Resubmit Goals</h2>
              <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                Math.round(reworkTotalWeightage) === 100
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-600'
              }`}>
                Total: {reworkTotalWeightage}% {Math.round(reworkTotalWeightage) === 100 ? '✓' : '(must be 100%)'}
              </div>
            </div>
            {managerComment && (
              <p className="text-sm text-red-500 mb-4 bg-red-50 px-3 py-2 rounded-lg">
                Manager feedback: <strong>"{managerComment}"</strong>
              </p>
            )}
            <div className="space-y-6">
              {reworkGoals.map((goal, index) => (
                <GoalFormFields
                  key={goal.id}
                  goal={goal}
                  index={index}
                  updateFn={updateReworkGoal}
                  isRework={true}
                />
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReworkSubmit}
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition"
              >
                {submitting ? 'Submitting...' : 'Resubmit for Approval'}
              </button>
              <button
                onClick={() => { setReworkMode(false); setError('') }}
                className="border border-gray-300 text-gray-600 px-6 py-2 rounded-xl font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* NEW GOAL FORM */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">New Goal Sheet</h2>
              <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                Math.round(totalWeightage) === 100
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-600'
              }`}>
                Total Weightage: {totalWeightage}% {Math.round(totalWeightage) === 100 ? '✓' : '(must be 100%)'}
              </div>
            </div>
            <div className="space-y-6">
              {goalRows.map((goal, index) => (
                <GoalFormFields
                  key={index}
                  goal={goal}
                  index={index}
                  updateFn={updateGoalRow}
                  isRework={false}
                />
              ))}
            </div>
            {goalRows.length < 8 && (
              <button
                onClick={addGoalRow}
                className="mt-4 flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                <Plus size={16} /> Add Another Goal ({goalRows.length}/8)
              </button>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition"
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
              <button
                onClick={() => { setShowForm(false); setGoalRows([{ ...emptyGoal }]); setError('') }}
                className="border border-gray-300 text-gray-600 px-6 py-2 rounded-xl font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* GOALS LIST */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading goals...</div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12">
            <Target size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No goals yet. Click "Add Goals" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal.id} className={`bg-white rounded-xl border p-5 shadow-sm ${
                goal.status === 'rework'
                  ? 'border-red-200'
                  : goal.is_shared
                  ? 'border-purple-200'
                  : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        {goal.thrust_area}
                      </span>
                      {goal.is_shared && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                          📌 Shared by Manager
                        </span>
                      )}
                      {getStatusBadge(goal.status)}
                      {goal.locked && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          🔒 Locked
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 mt-1">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-sm text-gray-500 mt-1">{goal.description}</p>
                    )}
                    {goal.is_shared && (
                      <p className="text-xs text-purple-500 mt-1">
                        Title and target are fixed. You may only adjust weightage with manager approval.
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-indigo-600">{goal.weightage}%</p>
                    <p className="text-xs text-gray-400">weightage</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-sm text-gray-500">
                  <span>UoM: <strong className="text-gray-700">
                    {UOM_TYPES.find(u => u.value === goal.uom_type)?.label?.split('(')[0]}
                  </strong></span>
                  {goal.target && (
                    <span>Target: <strong className="text-gray-700">{goal.target}</strong></span>
                  )}
                  {goal.target_date && (
                    <span>By: <strong className="text-gray-700">{goal.target_date}</strong></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}