import { NextResponse } from 'next/server'

const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite',
  'gemini-3.5-flash',
]

export async function POST(req: Request) {
  try {
    const { transactions, budgets, mode = 'diagnostico', goal = '' } = await req.json()
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta configurar GEMINI_API_KEY en el servidor.' },
        { status: 500 }
      )
    }

    const modeInstructions: Record<string, string> = {
      diagnostico: `Realiza un **Diagnóstico General Completo**:
1. **Puntaje de Salud Financiera (0 a 100):** Calcula una nota realista según su tasa de ahorro y cumplimiento de presupuestos, explicando brevemente el porqué.
2. **Mayor Fuga de Dinero y Gastos Hormiga:** Detecta qué categoría consume más recursos o supera su límite, y calcula cuánto ahorraría al año recortándola un 25%.
3. **Regla 50/30/20 y Proyección:** Compara sus números reales contra la regla ideal (50% necesidades, 30% gustos, 20% ahorro) y estima cómo cerrará el mes.`,

      ahorro: `Crea un **Plan de Ahorro Exprés de 7 Días** ultra práctico basado estrictamente en sus gastos recientes:
1. **Meta de Rescate Semanal:** Define cuánto dinero exacto puede liberar esta semana sin afectar sus necesidades básicas.
2. **3 Retos Accionables (Días 1 al 7):** Propón 3 acciones concretas atacando sus categorías con mayor gasto real (ej. sustituir compras específicas o pausar gastos no esenciales).
3. **Impacto Mensual:** Muestra cuánto dinero extra acumularía al mes si mantiene estos ajustes.`,

      meta: `Actúa como un **Simulador de Metas Financieras**:
El usuario quiere alcanzar esta meta: "${goal || 'Ahorrar un fondo de emergencia equivalente a 1 mes de gastos'}".
1. **Viabilidad Real:** Analiza con sus ingresos y gastos actuales cuánto dinero libre le queda realmente al mes para esta meta.
2. **Tiempo Estimado y Cuota Mensual:** Calcula en cuántos meses lograría la meta al ritmo actual y cuánto debería apartar por semana/mes.
3. **Acelerador de Meta:** Señala exactamente de qué categorías de gasto puede recortar dinero para alcanzar la meta en la mitad de tiempo.`,
    }

    const selectedInstruction = modeInstructions[mode] || modeInstructions.diagnostico

    const prompt = `Eres FinPilot AI, un copiloto financiero personal experto, directo, motivador y muy claro.
Responde en español usando viñetas cortas, negritas para cifras clave y un tono cercano (sin párrafos largos ni tecnicismos innecesarios).

${selectedInstruction}

Datos financieros actuales del usuario:
- Movimientos registrados: ${JSON.stringify(transactions)}
- Presupuestos configurados: ${JSON.stringify(budgets)}`

    let lastError = 'Los servidores de IA están ocupados. Intenta de nuevo en unos segundos.'

    for (const model of FALLBACK_MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        const text =
          data.candidates?.[0]?.content?.parts?.[0]?.text ||
          'No se pudo generar el análisis en este momento.'
        return NextResponse.json({ analysis: text })
      }

      lastError = data.error?.message || lastError

      // Si el error es por alta demanda (503) o límite temporal (429), prueba el siguiente modelo
      if (response.status !== 503 && response.status !== 429 && response.status !== 404) {
        break
      }
    }

    return NextResponse.json({ error: lastError }, { status: 503 })
  } catch (error) {
    console.error('Error en /api/analyze:', error)
    return NextResponse.json(
      { error: 'Error interno al procesar el análisis financiero.' },
      { status: 500 }
    )
  }
}