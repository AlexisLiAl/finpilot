'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Zap,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  PlusCircle,
  Trash2,
  Sparkles,
  Loader2,
  Target,
  PieChart as PieChartIcon,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type Transaction = {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  date: string
}

type Budget = {
  id: string
  category: string
  monthly_limit: number
}

const EXPENSE_CATEGORIES = ['Alimentación', 'Vivienda', 'Transporte', 'Ocio', 'Servicios', 'Salud', 'Otros']
const INCOME_CATEGORIES = ['Salario', 'Freelance', 'Inversiones', 'Ventas', 'Otros']
const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b']

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userEmail, setUserEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  // Estados del formulario de movimiento
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [savingTx, setSavingTx] = useState(false)

  // Estados del formulario de presupuesto
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0])
  const [budgetLimit, setBudgetLimit] = useState('')

  // Filtros e IA
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0])

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserEmail(user.email || '')
      setUserId(user.id)

      const [txRes, bgRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('budgets').select('*'),
      ])

      if (txRes.data) setTransactions(txRes.data)
      if (bgRes.data) setBudgets(bgRes.data)
      setLoading(false)
    }

    loadData()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSavingTx(true)

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type,
        amount: Number(amount),
        category,
        description: description.trim() || category,
        date: date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (!error && data) {
      setTransactions([data, ...transactions])
      setAmount('')
      setDescription('')
    }
    setSavingTx(false)
  }

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      setTransactions(transactions.filter((t) => t.id !== id))
    }
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!budgetLimit || Number(budgetLimit) <= 0) return

    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: userId,
          category: budgetCategory,
          monthly_limit: Number(budgetLimit),
        },
        { onConflict: 'user_id,category' }
      )
      .select()
      .single()

    if (!error && data) {
      const others = budgets.filter((b) => b.category !== budgetCategory)
      setBudgets([...others, data])
      setBudgetLimit('')
    }
  }

  const handleAnalyzeWithAI = async () => {
    setAnalyzing(true)
    setAiAnalysis(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, budgets }),
      })
      const data = await res.json()
      setAiAnalysis(data.analysis || data.error)
    } catch {
      setAiAnalysis('No se pudo conectar con el asesor financiero.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Cálculos financieros
  const { totalIncome, totalExpense, balance, expensesByCategory } = useMemo(() => {
    let inc = 0
    let exp = 0
    const catMap: Record<string, number> = {}

    transactions.forEach((t) => {
      const val = Number(t.amount)
      if (t.type === 'income') {
        inc += val
      } else {
        exp += val
        catMap[t.category] = (catMap[t.category] || 0) + val
      }
    })

    const chartData = Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
    }))

    return {
      totalIncome: inc,
      totalExpense: exp,
      balance: inc - exp,
      expensesByCategory: chartData,
    }
  }, [transactions])

  const filteredTransactions = transactions.filter((t) =>
    filterType === 'all' ? true : t.type === filterType
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">FinPilot AI</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 space-y-8">
        {/* Tarjetas de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
              <span>Balance Disponible</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <p className={`text-3xl font-bold ${balance >= 0 ? 'text-white' : 'text-rose-400'}`}>
              ${balance.toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
              <span>Ingresos Totales</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400">+${totalIncome.toFixed(2)}</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
              <span>Gastos Totales</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-3xl font-bold text-rose-400">-${totalExpense.toFixed(2)}</p>
          </div>
        </div>

        {/* Sección Principal: Izquierda (Gráficos e Historial) / Derecha (Formularios e IA) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gráfico de Gastos */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold">Distribución de Gastos</h2>
              </div>

              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-slate-500 py-12 text-center">
                  Registra tu primer gasto para visualizar el gráfico por categorías.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        {expensesByCategory.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => `$${Number(value).toFixed(2)}`}
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

            {/* Presupuestos Activos */}
            {budgets.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  <h2 className="font-semibold">Control de Presupuestos</h2>
                </div>

                <div className="space-y-3">
                  {budgets.map((b) => {
                    const spent =
                      expensesByCategory.find((c) => c.name === b.category)?.value || 0
                    const pct = Math.min((spent / b.monthly_limit) * 100, 100)
                    const isOver = spent > b.monthly_limit
                    const isWarning = pct >= 80 && !isOver

                    return (
                      <div key={b.id} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300">{b.category}</span>
                          <span className={isOver ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                            ${spent.toFixed(2)} / ${Number(b.monthly_limit).toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isOver
                                ? 'bg-rose-500'
                                : isWarning
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
              </div>
            )}

            {/* Historial de Movimientos */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="font-semibold">Historial de Movimientos</h2>
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  {(['all', 'income', 'expense'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterType(f)}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        filterType === f
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  No hay movimientos para mostrar.
                </p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-lg transition"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-200">{tx.description}</p>
                        <p className="text-xs text-slate-500">
                          {tx.category} • {tx.date}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-semibold ${
                            tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha (1/3): IA + Formularios */}
          <div className="space-y-6">
            {/* Asesor Financiero Gemini AI */}
            <div className="bg-gradient-to-b from-emerald-950/40 to-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles className="w-5 h-5" />
                <h2 className="font-semibold">Asesor FinPilot AI</h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Obtén un análisis inteligente de tus hábitos de consumo y recomendaciones de ahorro personalizadas.
              </p>

              <button
                onClick={handleAnalyzeWithAI}
                disabled={analyzing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando tus datos...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analizar mis finanzas
                  </>
                )}
              </button>

              {aiAnalysis && (
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                  {aiAnalysis}
                </div>
              )}
            </div>

            {/* Formulario Nuevo Movimiento */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold">Registrar Movimiento</h2>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setType('expense')
                      setCategory(EXPENSE_CATEGORIES[0])
                    }}
                    className={`py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                      type === 'expense'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'text-slate-400'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('income')
                      setCategory(INCOME_CATEGORIES[0])
                    }}
                    className={`py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                      type === 'income'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400'
                    }`}
                  >
                    Ingreso
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monto ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Supermercado, Pago quincena..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingTx}
                  className="w-full bg-slate-100 hover:bg-white text-slate-950 font-semibold text-sm py-2.5 rounded-xl transition cursor-pointer"
                >
                  {savingTx ? 'Guardando...' : 'Guardar Movimiento'}
                </button>
              </form>
            </div>

            {/* Formulario Definir Presupuesto */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-amber-400" />
                <h2 className="font-semibold">Fijar Presupuesto Mensual</h2>
              </div>

              <form onSubmit={handleSaveBudget} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría de gasto</label>
                  <select
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Límite mensual ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder="Ej. 300.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium text-sm py-2 rounded-xl transition cursor-pointer"
                >
                  Guardar Límite
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}