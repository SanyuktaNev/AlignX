import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { TrendingUp, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const computeScore = (goal, actual, actualDate) => {
  if (!actual && !actualDate) return null

  switch (goal.uom_type) {
    case 'numeric_min':
      return goal.target ? Math.min((actual / goal.target) * 100, 100).toFixed(1) : null
    case 'numeric_max':
      return actual ? Math.min((goal.target / actual) * 100, 100).toFixed(1) : null
    case 'zero':
      return parseFloat(actual) === 0 ? 100 : 0
    case 'timeline':
      if (!actualDate || !goal.target_date) return null
      const deadline = new Date(goal.target_date)
      const completed = new Date(actualDate)
      return completed <= deadline ? 100 : 0
    default:
      return null
  }
}

export default function CheckinDashboard() {
  const { profile } = useAuth()
  const [goals, setGoals] = useState([])
  const [checkins, setCheckins] = useState({})
  const [activeQuarter, setActiveQuarter] = useState('Q1')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [inputs, setInputs] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // Get approved goals
    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('status', 'approved')

    setGoals(goalsData || [])

    // Get all checkins for these goals
    if (goalsData && goalsData.length > 0) {
      const goalIds = goalsData.map(g => g.id)
      const { data: checkinData } = await supabase
        .from('quarterly_checkins')
        .select('*')
        .in('goal_id', goalIds)

      // Map checkins by goal_id + quarter
      const mapped = {}
      checkinData?.forEach(c => {
        mapped[`${c.goal_id}_${c.quarter}`] = c
      })
      setCheckins(mapped)

      // Set initial inputs from existing checkins
      const initialInputs = {}
      goalsData.forEach(goal => {
        QUARTERS.forEach(q => {
          const key = `${goal.id}_${q}`
          const existing = mapped[key]
          initialInputs[key] = {
            actual_achievement: existing?.actual_achievement || '',
            actual_date: existing?.actual_date || '',
            progress_status: existing?.progress_status || 'not_started',
          }
        })
      })
      setInputs(initialInputs)
    }

    setLoading(false)
  }

  const updateInput = (goalId, quarter, field, value) => {
    const key = `${goalId}_${quarter}`
    setInputs(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    for (const goal of goals) {
      const key = `${goal.id}_${activeQuarter}`
      const input = inputs[key]
      if (!input) continue

      const score = computeScore(
        goal,
        parseFloat(input.actual_achievement),
        input.actual_date
      )

      const payload = {
        goal_id: goal.id,
        quarter: activeQuarter,
        actual_achievement: input.actual_achievement ? parseFloat(input.actual_achievement) : null,
        actual_date: input.actual_date || null,
        progress_status: input.progress_status,
        progress_score: score,
        updated_at: new Date().toISOString(),
      }

      const existing = checkins[key]
      if (existing) {
        await supabase
          .from('quarterly_checkins')
          .update(payload)
          .eq('id', existing.id)
      } else {
        await supabase
          .from('quarterly_checkins')
          .insert(payload)
      }
    }

    setSuccess(`${activeQuarter} check-in saved successfully!`)
    fetchData()
    setSaving(false)
  }

  const getScoreColor = (score) => {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle size={16} className="text-green-500" />
    if (status === 'on_track') return <TrendingUp size={16} className="text-blue-500" />
    return <Clock size={16} className="text-gray-400" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Quarterly Check-ins</h1>
          <p className="text-gray-500 text-sm mt-1">Log your actual achievements against planned targets</p>
        </div>

        {/* Quarter Selector */}
        <div className="flex gap-2 mb-6">
          {QUARTERS.map(q => {
            const hasData = goals.some(g => checkins[`${g.id}_${q}`])
            return (
              <button
                key={q}
                onClick={() => { setActiveQuarter(q); setSuccess(''); setError('') }}
                className={`px-5 py-2 rounded-xl font-medium text-sm transition relative ${
                  activeQuarter === q
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                }`}
              >
                {q}
                {hasData && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-white" />
                )}
              </button>
            )
          })}
        </div>

        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl text-sm">{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No approved goals found.</p>
            <p className="text-gray-400 text-sm">Goals must be approved by your manager before check-ins.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {goals.map(goal => {
                const key = `${goal.id}_${activeQuarter}`
                const input = inputs[key] || {}
                const existing = checkins[key]
                const score = computeScore(
                  goal,
                  parseFloat(input.actual_achievement),
                  input.actual_date
                )
                const managerComment = existing?.manager_comment

                return (
                  <div key={goal.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

                    {/* Goal Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                            {goal.thrust_area}
                          </span>
                          <span className="text-xs text-gray-400">{goal.weightage}% weightage</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                      </div>
                      {score !== null && (
                        <div className="text-right ml-4">
                          <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}%</p>
                          <p className="text-xs text-gray-400">progress score</p>
                        </div>
                      )}
                    </div>

                    {/* Planned Target */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                      <span className="text-gray-500">Planned Target: </span>
                      <strong className="text-gray-700">
                        {goal.uom_type === 'timeline'
                          ? goal.target_date
                          : goal.uom_type === 'zero'
                          ? '0 incidents'
                          : goal.target}
                      </strong>
                      <span className="ml-3 text-gray-400">
                        ({goal.uom_type === 'numeric_min' ? 'Higher is better'
                          : goal.uom_type === 'numeric_max' ? 'Lower is better'
                          : goal.uom_type === 'timeline' ? 'Complete by date'
                          : 'Zero = success'})
                      </span>
                    </div>

                    {/* Input Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      {/* Actual Achievement */}
                      {goal.uom_type !== 'zero' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {goal.uom_type === 'timeline' ? 'Completion Date' : 'Actual Achievement'}
                          </label>
                          {goal.uom_type === 'timeline' ? (
                            <input
                              type="date"
                              value={input.actual_date || ''}
                              onChange={e => updateInput(goal.id, activeQuarter, 'actual_date', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          ) : (
                            <input
                              type="number"
                              value={input.actual_achievement || ''}
                              onChange={e => updateInput(goal.id, activeQuarter, 'actual_achievement', e.target.value)}
                              placeholder={`Target: ${goal.target}`}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          )}
                        </div>
                      )}

                      {/* Zero based input */}
                      {goal.uom_type === 'zero' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Actual Count</label>
                          <input
                            type="number"
                            value={input.actual_achievement || ''}
                            onChange={e => updateInput(goal.id, activeQuarter, 'actual_achievement', e.target.value)}
                            placeholder="Enter 0 if successful"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                      )}

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                          value={input.progress_status || 'not_started'}
                          onChange={e => updateInput(goal.id, activeQuarter, 'progress_status', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                          <option value="not_started">Not Started</option>
                          <option value="on_track">On Track</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>

                      {/* Progress Bar */}
                      {score !== null && (
                        <div className="flex items-end">
                          <div className="w-full">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Progress</span>
                              <span>{score}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Manager Comment */}
                    {managerComment && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                        <p className="text-blue-600 font-medium text-xs mb-1">Manager Feedback</p>
                        <p className="text-blue-800">{managerComment}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition"
            >
              {saving ? 'Saving...' : `Save ${activeQuarter} Check-in`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}