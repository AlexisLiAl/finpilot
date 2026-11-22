import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { transactions, budgets } = await req.json()

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { analysis: 'Aún no tienes movimientos registrados este mes. Agrega algunos ingresos y gastos para que pueda analizar tus finanzas.' },
        { status: 200 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta configurar GEMINI_API_KEY en el servidor' },
        { status: 500 }
      )
    }

    const prompt = `Eres FinPilot AI, un asesor financiero personal experto, directo y empático.
Analiza los siguientes movimientos financieros y presupuestos de un usuario y responde en español con un formato claro y accionable (máximo 180 palabras):

1. **Diagnóstico Rápido:** Porcentaje de ahorro o déficit actual.
2. **Mayor Fuga de Dinero:** En qué categoría está gastando más o superando su presupuesto.
3. **3 Consejos Concretos:** Acciones prácticas basadas en sus números reales.

Datos del usuario:
Transacciones: ${JSON.stringify(transactions)}
Presupuestos mensuales: ${JSON.stringify(budgets)}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al conectar con Gemini API')
    }

    const analysisText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No se pudo generar el análisis en este momento.'

    return NextResponse.json({ analysis: analysisText })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error interno al analizar finanzas' },
      { status: 500 }
    )
  }
}