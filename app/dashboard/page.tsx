'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Zap,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  PlusCircle,
  Trash2,
  Sparkles,
  PieChart as PieChartIcon,
  Target,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  BarChart3,
  Flame,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'

type Transaction = {
  id: string
  user_id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string | null
  date: string
  created_at?: string
}

type Budget = {
  id: string
  user_id: string
  category: string
  monthly_limit: number
}

type AiCard = {
  type: 'alert' | 'opportunity' | 'tip'
  title: string
  metric?: string
  body: string
}

type StructuredAnalysis = {
  score: number
  scoreLabel: string
  headline: string
  cards: AiCard[]
  quickPrompts?: string[]
}

const CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Vivienda',
  'Servicios',
  'Entretenimiento',
  'Salud',
  'Educación',
  'Compras',
  'Salario',
  'Freelance',
  'Inversiones',
  'Otros',
]

const CHART_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userEmail, setUserEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])

  // Formulario nuevo movimiento
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Alimentación')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  // Formulario nuevo presupuesto
  const [budgetCategory, setBudgetCategory] = useState('Alimentación')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  // Filtro historial
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  // Estado IA (3 Modos + Tarjetas Visuales)
  const [aiMode, setAiMode] = useState<'diagnostico' | 'ahorro' | 'meta'>('diagnostico')
  const [aiGoal, setAiGoal] = useState('')
  const [structuredAi, setStructuredAi] = useState<StructuredAnalysis | null>(null)
  const [aiFallbackText, setAiFallbackText] = useState<string>('')
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    const loadUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserEmail(user.email || '')
      setUserId(user.id)

      await Promise.all([fetchTransactions(user.id), fetchBudgets(user.id)])
      setLoading(false)
    }

    loadUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTransactions = async (uid: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })

    if (!error && data) {
      setTransactions(data)
    }
  }

  const fetchBudgets = async (uid: string) => {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', uid)

    if (!error && data) {
      setBudgets(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0 || !userId) return

    setSubmitting(true)
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      type,
      amount: Number(amount),
      category,
      description: description.trim() || category,
      date,
    })

    if (!error) {
      setAmount('')
      setDescription('')
      await fetchTransactions(userId)
    }
    setSubmitting(false)
  }

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error && userId) {
      await fetchTransactions(userId)
    }
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!budgetLimit || Number(budgetLimit) <= 0 || !userId) return

    setSavingBudget(true)
    const existing = budgets.find((b) => b.category === budgetCategory)

    if (existing) {
      await supabase
        .from('budgets')
        .update({ monthly_limit: Number(budgetLimit) })
        .eq('id', existing.id)
    } else {
      await supabase.from('budgets').insert({
        user_id: userId,
        category: budgetCategory,
        monthly_limit: Number(budgetLimit),
      })
    }

    setBudgetLimit('')
    await fetchBudgets(userId)
    setSavingBudget(false)
  }

  const handleAnalyzeFinances = async (
    overrideMode?: 'diagnostico' | 'ahorro' | 'meta',
    overrideGoal?: string
  ) => {
    const activeMode = overrideMode || aiMode
    const activeGoal = overrideGoal !== undefined ? overrideGoal : aiGoal

    setAnalyzing(true)
    setStructuredAi(null)
    setAiFallbackText('')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          budgets,
          mode: activeMode,
          goal: activeGoal,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAiFallbackText(data.error || 'No se pudo obtener respuesta de la IA.')
      } else if (data.structured) {
        setStructuredAi(data.structured)
      } else {
        setAiFallbackText(data.analysis || 'Análisis completado.')
      }
    } catch {
      setAiFallbackText('Error de conexión al consultar al asesor con IA.')
    } finally {
      setAnalyzing(false)
    }
  }

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let income = 0
    let expense = 0

    for (const t of transactions) {
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }

    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
    }
  }, [transactions])

  const expenseChartData = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const t of transactions) {
      if (t.type === 'expense') {
        grouped[t.category] = (grouped[t.category] || 0) + Number(t.amount)
      }
    }
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return transactions
    return transactions.filter((t) => t.type === filterType)
  }, [transactions, filterType])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mr-2" />
        Cargando FinPilot AI...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">FinPilot AI</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">
              {userEmail}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm text-slate-300 transition"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Tarjetas superiores de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
              <span>Balance Disponible</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              ${balance.toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
              <span>Ingresos Totales</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400">
              +${totalIncome.toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
              <span>Gastos Totales</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-3xl font-bold text-rose-400">
              -${totalExpense.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Fila Principal: Gráfico + Asesor IA Mejorado */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Gráfico de Distribución (7 columnas) */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-base">Distribución de Gastos</h2>
              </div>
              {totalIncome > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                  Tasa de ahorro:{' '}
                  <strong className="text-emerald-400">
                    {Math.max(0, Math.round((balance / totalIncome) * 100))}%
                  </strong>
                </span>
              )}
            </div>

            {expenseChartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
                Registra tu primer gasto para visualizar el gráfico por categorías.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {expenseChartData.map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `$${Number(value ?? 0).toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '0.75rem',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tarjeta Asesor FinPilot AI Rediseñada (5 columnas) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-emerald-950/35 via-slate-900/90 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 flex flex-col shadow-lg shadow-emerald-950/20">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2>Asesor FinPilot AI</h2>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                IA Activa
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Diagnóstico inteligente, retos semanales y simulación de metas.
            </p>

            {/* Pestañas de 3 Modos */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800 mb-3">
              <button
                type="button"
                onClick={() => setAiMode('diagnostico')}
                className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                  aiMode === 'diagnostico'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Diagnóstico
              </button>
              <button
                type="button"
                onClick={() => setAiMode('ahorro')}
                className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                  aiMode === 'ahorro'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Plan 7 Días
              </button>
              <button
                type="button"
                onClick={() => setAiMode('meta')}
                className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                  aiMode === 'meta'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                Meta
              </button>
            </div>

            {/* Input condicional para Simulador de Meta */}
            {aiMode === 'meta' && (
              <input
                type="text"
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                placeholder="Ej: Ahorrar $600 para laptop en 3 meses"
                className="w-full mb-3 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            )}

            <button
              type="button"
              onClick={() => handleAnalyzeFinances()}
              disabled={analyzing}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/20"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando tus finanzas...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {aiMode === 'diagnostico' && 'Ejecutar Diagnóstico'}
                  {aiMode === 'ahorro' && 'Generar Plan 7 Días'}
                  {aiMode === 'meta' && 'Simular Mi Meta'}
                </>
              )}
            </button>

            {/* Resultado Visual Estructurado */}
            {structuredAi && (
              <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {/* Barra de Puntaje de Salud Financiera */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      {aiMode === 'diagnostico' && 'Salud Financiera'}
                      {aiMode === 'ahorro' && 'Viabilidad del Reto'}
                      {aiMode === 'meta' && 'Probabilidad de Éxito'}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        structuredAi.score >= 75
                          ? 'text-emerald-400'
                          : structuredAi.score >= 50
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {structuredAi.score}/100
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        structuredAi.score >= 75
                          ? 'bg-emerald-500'
                          : structuredAi.score >= 50
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, structuredAi.score))}%`,
                      }}
                    />
                  </div>

                  <p className="text-xs font-medium text-slate-200">
                    {structuredAi.headline}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {structuredAi.scoreLabel}
                  </p>
                </div>

                {/* Tarjetas de Hallazgos */}
                <div className="space-y-2.5">
                  {structuredAi.cards?.map((card, idx) => {
                    const isAlert = card.type === 'alert'
                    const isOpp = card.type === 'opportunity'

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          isAlert
                            ? 'bg-rose-950/20 border-rose-500/30'
                            : isOpp
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            {isAlert ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ) : isOpp ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <h3 className="text-xs font-semibold text-slate-100">
                              {card.title}
                            </h3>
                          </div>

                          {card.metric && (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                isAlert
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : isOpp
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {card.metric}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {card.body}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Chips Rápidos de Seguimiento */}
                {structuredAi.quickPrompts && structuredAi.quickPrompts.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {structuredAi.quickPrompts.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiMode('meta')
                          setAiGoal(q)
                          handleAnalyzeFinances('meta', q)
                        }}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1 transition"
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Respaldo si devuelve texto simple o error */}
            {!structuredAi && aiFallbackText && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {aiFallbackText}
              </div>
            )}
          </div>
        </div>

        {/* Fila Inferior: Historial + Registrar Movimiento + Presupuestos */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Historial y Presupuestos (7 columnas) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Historial de Movimientos */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-base">Historial de Movimientos</h2>
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['all', 'income', 'expense'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilterType(tab)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        filterType === tab
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab === 'all' && 'Todos'}
                      {tab === 'income' && 'Ingresos'}
                      {tab === 'expense' && 'Gastos'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">
                  No hay movimientos para mostrar.
                </p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {filteredTransactions.map((t) => (
                    <div
                      key={t.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {t.description || t.category}
                        </p>
                        <p className="text-xs text-slate-400">
                          {t.category} • {t.date}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-semibold ${
                            t.type === 'income'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'}$
                          {Number(t.amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="text-slate-500 hover:text-rose-400 transition"
                          title="Eliminar movimiento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Presupuestos Mensuales */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-base">Presupuestos por Categoría</h2>
              </div>

              <form
                onSubmit={handleSaveBudget}
                className="flex flex-col sm:flex-row gap-3 mb-5"
              >
                <select
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Límite mensual ($)"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="sm:w-44 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100"
                  required
                />
                <button
                  type="submit"
                  disabled={savingBudget}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
                >
                  Guardar
                </button>
              </form>

              {budgets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aún no has definido límites de presupuesto.
                </p>
              ) : (
                <div className="space-y-4">
                  {budgets.map((b) => {
                    const spent = transactions
                      .filter(
                        (t) => t.type === 'expense' && t.category === b.category
                      )
                      .reduce((sum, t) => sum + Number(t.amount), 0)
                    const pct = Math.min(
                      100,
                      Math.round((spent / Number(b.monthly_limit)) * 100)
                    )
                    const over = spent > Number(b.monthly_limit)

                    return (
                      <div key={b.id} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-200">
                            {b.category}
                          </span>
                          <span
                            className={
                              over ? 'text-rose-400 font-semibold' : 'text-slate-400'
                            }
                          >
                            ${spent.toFixed(2)} / ${Number(b.monthly_limit).toFixed(2)} (
                            {pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              over
                                ? 'bg-rose-500'
                                : pct > 80
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Formulario Registrar Movimiento (5 columnas) */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-base">Registrar Movimiento</h2>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    type === 'expense'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    type === 'income'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ingreso
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Monto ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Almuerzo, Pago mensual..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold text-sm transition"
              >
                {submitting ? 'Guardando...' : 'Guardar Movimiento'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}