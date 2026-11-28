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

    const modeContext: Record<string, string> = {
      diagnostico: `Enfócate en un Diagnóstico General Completo:
- Calcula un score de salud financiera de 0 a 100 según su tasa de ahorro y pesos de gastos fijos.
- Identifica la mayor fuga de dinero comparando contra la regla 50/30/20.
- Da 3 acciones concretas con cifras exactas de ahorro mensual/anual.`,

      ahorro: `Enfócate en un Plan de Ahorro Exprés de 7 Días:
- Calcula en "score" el porcentaje de viabilidad del reto (0 a 100).
- Define en "headline" cuánto dinero exacto puede rescatar en 7 días.
- En "cards" pon los retos concretos (Días 1-2, Días 3-5, Días 6-7) atacando sus gastos reales.`,

      meta: `Enfócate en Simular la Meta: "${goal || 'Ahorrar un fondo de emergencia de 1 mes de gastos'}".
- Calcula en "score" la probabilidad de éxito (0 a 100) según su superávit actual.
- Define en "headline" el tiempo estimado y cuota mensual recomendada.
- En "cards" detalla la viabilidad real, el ritmo semanal y cómo acelerar la meta a la mitad de tiempo.`,
    }

    const prompt = `Eres FinPilot AI, un asesor financiero personal de nivel ejecutivo, claro y directo.
Analiza los datos del usuario y responde ÚNICAMENTE con un objeto JSON válido (sin bloques markdown \`\`\`json, sin texto antes ni después, y SIN usar asteriscos ** en los textos).

${modeContext[mode] || modeContext.diagnostico}

Usa exactamente esta estructura JSON:
{
  "score": 75,
  "scoreLabel": "Ej: Buen margen, gastos fijos altos",
  "headline": "Resumen ejecutivo de 1 línea con la cifra más importante",
  "cards": [
    {
      "type": "alert",
      "title": "Título corto del hallazgo",
      "metric": "$650 / mes (54%)",
      "body": "Explicación clara y directa en máximo 2 oraciones sin asteriscos."
    },
    {
      "type": "opportunity",
      "title": "Título de oportunidad de ahorro",
      "metric": "+$40 / mes",
      "body": "Acción específica que puede aplicar hoy mismo."
    },
    {
      "type": "tip",
      "title": "Siguiente paso recomendado",
      "metric": "Regla 50/30/20",
      "body": "Consejo práctico basado en sus categorías."
    }
  ],
  "quickPrompts": [
    "¿Cómo bajo mis gastos fijos?",
    "Simular fondo de emergencia de $1,000"
  ]
}

Nota sobre "type": usa solo "alert" (para riesgos/fugas), "opportunity" (para ahorros/metas) o "tip" (para consejos).

Datos financieros del usuario:
- Movimientos: ${JSON.stringify(transactions)}
- Presupuestos: ${JSON.stringify(budgets)}`

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
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const cleaned = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim()

        try {
          const parsed = JSON.parse(cleaned)
          return NextResponse.json({ structured: parsed })
        } catch {
          return NextResponse.json({ analysis: rawText.replace(/\*\*/g, '') })
        }
      }

      lastError = data.error?.message || lastError

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