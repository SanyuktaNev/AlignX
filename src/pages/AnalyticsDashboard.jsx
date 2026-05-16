import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Users, Target, Award } from 'lucide-react'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function AnalyticsDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [goals, setGoals] = useState([])
  const [checkins, setCheckins] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const [
      { data: usersData },
      { data: goalsData },
      { data: checkinsData },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('quarterly_checkins').select('*'),
    ])

    setUsers(usersData || [])
    setGoals(goalsData || [])
    setCheckins(checkinsData || [])
    setLoading(false)
  }

  // ── Data Computations ──────────────────────────────────────────────

  // 1. QoQ Achievement Trend
  const qoqData = QUARTERS.map(q => {
    const quarterCheckins = checkins.filter(c => c.quarter === q && c.progress_score !== null)
    const avg = quarterCheckins.length > 0
      ? Math.round(quarterCheckins.reduce((s, c) => s + c.progress_score, 0) / quarterCheckins.length)
      : 0
    return { quarter: q, avgScore: avg, count: quarterCheckins.length }
  })

  // 2. Goal Distribution by Thrust Area
  const thrustData = goals.reduce((acc, g) => {
    acc[g.thrust_area] = (acc[g.thrust_area] || 0) + 1
    return acc
  }, {})
  const thrustChartData = Object.entries(thrustData)
    .map(([name, value]) => ({ name: name.split(' ').slice(0, 2).join(' '), value }))
    .sort((a, b) => b.value - a.value)

  // 3. Goal Status Distribution
  const statusData = goals.reduce((acc, g) => {
    const label = g.status.charAt(0).toUpperCase() + g.status.slice(1)
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
  const statusChartData = Object.entries(statusData).map(([name, value]) => ({ name, value }))

  // 4. UoM Type Distribution
  const uomLabels = {
    numeric_min: 'Higher Better',
    numeric_max: 'Lower Better',
    timeline: 'Timeline',
    zero: 'Zero Based',
  }
  const uomData = goals.reduce((acc, g) => {
    const label = uomLabels[g.uom_type] || g.uom_type
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
  const uomChartData = Object.entries(uomData).map(([name, value]) => ({ name, value }))

  // 5. Employee Performance (approved goals with check-ins)
  const employees = users.filter(u => u.role === 'employee')
  const employeePerf = employees.map(emp => {
    const empGoals = goals.filter(g => g.employee_id === emp.id && g.status === 'approved')
    const empCheckins = checkins.filter(c =>
      empGoals.some(g => g.id === c.goal_id) && c.progress_score !== null
    )
    const avg = empCheckins.length > 0
      ? Math.round(empCheckins.reduce((s, c) => s + c.progress_score, 0) / empCheckins.length)
      : 0
    return {
      name: emp.name.split(' ')[0],
      avgScore: avg,
      goals: empGoals.length,
      checkins: empCheckins.length,
    }
  }).filter(e => e.goals > 0)

  // 6. Check-in completion per quarter
  const completionData = QUARTERS.map(q => {
    const empWithApproved = employees.filter(emp =>
      goals.some(g => g.employee_id === emp.id && g.status === 'approved')
    )
    const completed = empWithApproved.filter(emp => {
      const empGoals = goals.filter(g => g.employee_id === emp.id && g.status === 'approved')
      return empGoals.some(g => checkins.find(c => c.goal_id === g.id && c.quarter === q))
    })
    return {
      quarter: q,
      completed: completed.length,
      pending: empWithApproved.length - completed.length,
      total: empWithApproved.length,
    }
  })

  // 7. Radar: Thrust area avg scores
  const thrustScores = Object.keys(thrustData).map(area => {
    const areaGoals = goals.filter(g => g.thrust_area === area)
    const areaCheckins = checkins.filter(c =>
      areaGoals.some(g => g.id === c.goal_id) && c.progress_score !== null
    )
    const avg = areaCheckins.length > 0
      ? Math.round(areaCheckins.reduce((s, c) => s + c.progress_score, 0) / areaCheckins.length)
      : 0
    return {
      area: area.split(' ')[0],
      score: avg,
    }
  })

  // ── Stats ──────────────────────────────────────────────────────────
  const totalGoals = goals.length
  const approvedGoals = goals.filter(g => g.status === 'approved').length
  const totalCheckins = checkins.length
  const avgScore = checkins.filter(c => c.progress_score !== null).length > 0
    ? Math.round(
        checkins
          .filter(c => c.progress_score !== null)
          .reduce((s, c) => s + c.progress_score, 0) /
        checkins.filter(c => c.progress_score !== null).length
      )
    : 0

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
          <p className="font-semibold text-gray-700 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>
              {p.name}: <strong>{p.value}{p.name.includes('Score') || p.name.includes('score') ? '%' : ''}</strong>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Organisation-wide goal performance insights
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading analytics...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Goals', value: totalGoals, icon: <Target size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Approved Goals', value: approvedGoals, icon: <Award size={20} />, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Total Check-ins', value: totalCheckins, icon: <TrendingUp size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Avg Progress Score', value: `${avgScore}%`, icon: <Users size={20} />, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                    {stat.icon}
                  </div>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Row 1: QoQ Trend + Employee Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* QoQ Achievement Trend */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-1">Quarter-on-Quarter Achievement</h3>
                <p className="text-xs text-gray-400 mb-4">Average progress score per quarter</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={qoqData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="avgScore"
                      name="Avg Score"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Employee Performance */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-1">Employee Performance</h3>
                <p className="text-xs text-gray-400 mb-4">Average score across all check-ins</p>
                {employeePerf.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    No check-in data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={employeePerf}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgScore" name="Avg Score" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Row 2: Check-in Completion + Goal Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Check-in Completion */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-1">Check-in Completion</h3>
                <p className="text-xs text-gray-400 mb-4">Completed vs pending per quarter</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={completionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Goal Status Pie */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-1">Goal Status Distribution</h3>
                <p className="text-xs text-gray-400 mb-4">Breakdown by current status</p>
                {statusChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    No goals yet
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusChartData.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {statusChartData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-xs text-gray-600">{item.name}</span>
                          <span className="text-xs font-semibold text-gray-800 ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Thrust Area Distribution + Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Thrust Area Bar */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-1">Goals by Thrust Area</h3>
                <p className="text-xs text-gray-400 mb-4">Number of goals per thrust area</p>
                {thrustChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    No goals yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={thrustChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Goals" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* UoM Type Pie */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-1">UoM Type Breakdown</h3>
                <p className="text-xs text-gray-400 mb-4">Distribution of measurement types</p>
                {uomChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    No goals yet
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie
                          data={uomChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {uomChartData.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {uomChartData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-xs text-gray-600">{item.name}</span>
                          <span className="text-xs font-semibold text-gray-800 ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Radar Chart - Thrust Area Scores */}
            {thrustScores.length > 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
                <h3 className="font-semibold text-gray-800 mb-1">Performance by Thrust Area</h3>
                <p className="text-xs text-gray-400 mb-4">Average achievement score per thrust area</p>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={thrustScores}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
                    <Radar
                      name="Avg Score"
                      dataKey="score"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Heatmap: Employee x Quarter */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-1">Check-in Heatmap</h3>
              <p className="text-xs text-gray-400 mb-4">Employee progress scores across quarters</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Employee</th>
                      {QUARTERS.map(q => (
                        <th key={q} className="text-center py-2 px-3 text-xs text-gray-500 font-medium">{q}</th>
                      ))}
                      <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const empGoals = goals.filter(g => g.employee_id === emp.id && g.status === 'approved')
                      if (empGoals.length === 0) return null

                      const scores = QUARTERS.map(q => {
                        const qCheckins = checkins.filter(c =>
                          empGoals.some(g => g.id === c.goal_id) && c.quarter === q && c.progress_score !== null
                        )
                        return qCheckins.length > 0
                          ? Math.round(qCheckins.reduce((s, c) => s + c.progress_score, 0) / qCheckins.length)
                          : null
                      })

                      const validScores = scores.filter(s => s !== null)
                      const avg = validScores.length > 0
                        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                        : null

                      const getHeatColor = (score) => {
                        if (score === null) return 'bg-gray-100 text-gray-400'
                        if (score >= 80) return 'bg-green-100 text-green-700'
                        if (score >= 60) return 'bg-yellow-100 text-yellow-700'
                        if (score >= 40) return 'bg-orange-100 text-orange-700'
                        return 'bg-red-100 text-red-700'
                      }

                      return (
                        <tr key={emp.id} className="border-t border-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-800">{emp.name}</td>
                          {scores.map((score, i) => (
                            <td key={i} className="py-3 px-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${getHeatColor(score)}`}>
                                {score !== null ? `${score}%` : '—'}
                              </span>
                            </td>
                          ))}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${getHeatColor(avg)}`}>
                              {avg !== null ? `${avg}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}