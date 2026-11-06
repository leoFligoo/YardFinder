/**
 * Yard Finder - NL Dispatch Agent & Route Optimizer
 * 
 * Este módulo recibe una orden de despacho en lenguaje natural (ej. "necesito los 12 Cronos blancos del lote 4"),
 * la procesa utilizando la API de Claude para extraer los criterios de búsqueda estructurados,
 * filtra el inventario sintético del patio (200 vehículos) y calcula la ruta de picking óptima.
 */

import Anthropic from '@anthropic-ai/sdk';

// Inicializar cliente de Anthropic con la API Key del entorno
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'TU_API_KEY_AQUI',
});

// Interface de datos del vehículo
export interface Vehicle {
  vin: string;
  model: string;
  color: string;
  sector: number;
  x: number;
  y: number;
  status: 'ok' | 'out_of_sector' | 'tag_unreadable';
}

// Interface del resultado parseado por Claude
export interface DispatchCriteria {
  quantity: number | null;
  model: string;
  color: string | null;
  sector: number | null;
}

// System Prompt estructurado para forzar respuesta JSON estricta
const SYSTEM_PROMPT = `Eres el asistente inteligente de despacho para la app "Yard Finder".
Tu tarea es convertir la solicitud de orden de despacho en lenguaje natural recibida por parte del despachador a un formato JSON estructurado.

Debes responder ÚNICAMENTE con un objeto JSON válido que cumpla con la siguiente estructura, sin texto adicional ni explicaciones:

{
  "quantity": <number | null>,   // Cantidad solicitada. Si se pide "todos" o no se especifica, colocar null.
  "model": "<string>",          // Modelo del vehículo (ej: "cronos", "toro", "pulse", "argo", "fastback", "strada").
  "color": "<string | null>",    // Color del vehículo (ej: "blanco", "negro", "gris", "rojo") o null si no se menciona.
  "sector": <number | null>      // Número del sector/lote (1 a 6) o null si no se menciona.
}

Ejemplo Entrada: "Necesito los 12 Cronos blancos del lote 4"
Ejemplo Salida: {"quantity": 12, "model": "cronos", "color": "blanco", "sector": 4}

Ejemplo Entrada: "Traeme todos los Toro rojos"
Ejemplo Salida: {"quantity": null, "model": "toro", "color": "rojo", "sector": null}
`;

/**
 * Función principal para procesar la orden del despachador
 * @param userPrompt Texto en lenguaje natural del usuario
 * @param inventory Array de vehículos en el patio
 */
export async function processDispatchOrder(userPrompt: string, inventory: Vehicle[]) {
  try {
    // 1. Llamada a la API de Claude (Claude 3.5 Sonnet)
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    // 2. Extraer y parsear la respuesta JSON de Claude
    const responseText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
    const criteria: DispatchCriteria = JSON.parse(responseText.trim());

    console.log('📌 Criterios interpretados por Claude:', criteria);

    // 3. Filtrar el inventario sintético según los criterios extraídos
    let matchingVehicles = inventory.filter((v) => {
      const matchModel = v.model.toLowerCase() === criteria.model.toLowerCase();
      const matchColor = criteria.color ? v.color.toLowerCase() === criteria.color.toLowerCase() : true;
      const matchSector = criteria.sector ? v.sector === criteria.sector : true;
      return matchModel && matchColor && matchSector;
    });

    // 4. Si se especificó una cantidad, tomamos hasta esa cantidad
    if (criteria.quantity && criteria.quantity > 0) {
      matchingVehicles = matchingVehicles.slice(0, criteria.quantity);
    }

    // 5. Calcular la ruta óptima de recolección (Picking Path)
    const optimizedRoute = calculateOptimalPickingRoute(matchingVehicles);

    return {
      success: true,
      queryInput: userPrompt,
      parsedCriteria: criteria,
      requestedQuantity: criteria.quantity || 'Todos los disponibles',
      foundCount: matchingVehicles.length,
      route: optimizedRoute
    };

  } catch (error) {
    console.error('❌ Error procesando la orden con el agente:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Algoritmo de optimización de ruta de picking (Nearest Neighbor / Sector Sorting)
 * Ordena los vehículos seleccionados para minimizar la distancia de recolección del camión.
 */
export function calculateOptimalPickingRoute(vehicles: Vehicle[]): Vehicle[] {
  if (vehicles.length <= 1) return vehicles;

  const unvisited = [...vehicles];
  const route: Vehicle[] = [];
  
  // Empezar desde el origen (0,0) del patio
  let currentPos = { x: 0, y: 0 };

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = Math.hypot(unvisited[i].x - currentPos.x, unvisited[i].y - currentPos.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextVehicle = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextVehicle);
    currentPos = { x: nextVehicle.x, y: nextVehicle.y };
  }

  return route;
}

// ------------------------------------------------------------------
// GENERADOR DE PATIO SINTÉTICO (200 Vehículos, 6 Sectores)
// ------------------------------------------------------------------
export function generateSyntheticYard(): Vehicle[] {
  const models = ['Cronos', 'Toro', 'Pulse', 'Argo', 'Fastback', 'Strada'];
  const colors = ['blanco', 'negro', 'gris', 'rojo'];
  const yard: Vehicle[] = [];

  let count = 1;
  // Generar 200 vehículos distribuidos en 6 sectores
  for (let sector = 1; sector <= 6; sector++) {
    const itemsInSector = sector <= 2 ? 34 : 33; // Suma total = 200
    for (let i = 0; i < itemsInSector; i++) {
      const model = models[Math.floor(Math.random() * models.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      yard.push({
        vin: `8AG${model.substring(0,2).toUpperCase()}${2026}${String(count).padStart(6, '0')}`,
        model: model,
        color: color,
        sector: sector,
        x: (sector - 1) * 30 + (i % 6) * 4.5 + Math.random(),
        y: Math.floor(i / 6) * 6.0 + Math.random(),
        status: Math.random() > 0.05 ? 'ok' : 'out_of_sector'
      });
      count++;
    }
  }

  return yard;
}

// Ejemplo de prueba rápido (ejecución directa)
if (require.main === module) {
  const inventory = generateSyntheticYard();
  console.log(`✅ Inventario sintético generado con ${inventory.length} vehículos en 6 sectores.`);

  const testPrompt = "necesito los 12 Cronos blancos del lote 4";
  console.log(`
🤖 Procesando consulta: "${testPrompt}"...`);

  processDispatchOrder(testPrompt, inventory).then((res) => {
    console.log("
📋 Resultado devuelto a la app:", JSON.stringify(res, null, 2));
  });
}
