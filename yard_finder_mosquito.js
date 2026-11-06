/**
 * Yard Finder - Módulo de Despacho para Camión Mosquito
 */

// 1. Parser simulado (o respuesta de Gemini/Claude)
function parseOrder(prompt) {
  const text = prompt.toLowerCase();

  const qtyMatch = text.match(/\b(\d+)\b/);
  let quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  const models = ["cronos", "toro", "pulse", "argo", "fastback", "strada"];
  const model = models.find((m) => text.includes(m)) || null;

  const colors = ["blanco", "negro", "gris", "rojo"];
  const color = colors.find((c) => text.includes(c)) || null;

  const sectorMatch = text.match(/(?:lote|sector)\s*(\d+)/);
  const sector = sectorMatch ? parseInt(sectorMatch[1], 10) : null;

  return { quantity, model, color, sector };
}

// 2. Generar Inventario de Prueba (200 autos dispersos)
function generateYard() {
  const models = ["Cronos", "Toro", "Pulse", "Argo", "Fastback", "Strada"];
  const colors = ["blanco", "negro", "gris", "rojo"];
  const yard = [];
  let count = 1;

  for (let sector = 1; sector <= 6; sector++) {
    for (let i = 0; i < 33; i++) {
      const m = models[(count * 3) % models.length];
      const c = colors[(count * 2) % colors.length];
      yard.push({
        vin: `8AG${m.substring(0, 2).toUpperCase()}2026${String(count).padStart(5, "0")}`,
        model: m,
        color: c,
        sector: sector,
        posicionSlot: `Fila ${Math.floor(i / 6) + 1} - Espacio ${(i % 6) + 1}`,
        x: (sector - 1) * 40 + (i % 6) * 5, // Coordenadas en metros dentro del patio
        y: Math.floor(i / 6) * 7,
      });
      count++;
    }
  }
  return yard;
}

// 3. Algoritmo de Ruta Óptima para el Mosquito
function calculateMosquitoRoute(vehicles, origin = { x: 0, y: 0 }) {
  if (vehicles.length === 0) return [];

  const unvisited = [...vehicles];
  const route = [];
  let currentPos = { ...origin };

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = Math.hypot(
        unvisited[i].x - currentPos.x,
        unvisited[i].y - currentPos.y,
      );
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

// 4. Función de Procesamiento de Despacho
export function dispatchMosquitoOrder(userPrompt) {
  const MAX_CAPACITY = 8; // Restricción del Camión Mosquito
  const yard = generateYard();
  const criteria = parseOrder(userPrompt);

  console.log(`\n🚛 ORDEN RECIBIDA PARA MOSQUITO: "${userPrompt}"`);
  console.log(
    "------------------------------------------------------------------",
  );

  // Validación de cantidad solicitada
  if (criteria.quantity && criteria.quantity > MAX_CAPACITY) {
    console.log(
      `⚠️ ALERTA DE CAPACIDAD: Un camión mosquito solo puede cargar hasta ${MAX_CAPACITY} vehículos.`,
    );
    console.log(
      `   Se limitará la carga del viaje a los primeros ${MAX_CAPACITY} autos encontrados.\n`,
    );
  }

  // Filtrar coincidencia en todo el patio (puede estar en distintos sectores)
  let matches = yard.filter((v) => {
    const matchModel = criteria.model
      ? v.model.toLowerCase() === criteria.model
      : true;
    const matchColor = criteria.color
      ? v.color.toLowerCase() === criteria.color
      : true;
    const matchSector = criteria.sector ? v.sector === criteria.sector : true;
    return matchModel && matchColor && matchSector;
  });

  if (matches.length === 0) {
    console.log(
      "❌ No se encontraron vehículos que coincidan con la búsqueda.",
    );
    return;
  }

  // Tomar como máximo 8 unidades para el viaje
  const targetVehicles = matches.slice(0, MAX_CAPACITY);

  // Calcular la ruta optimizada partiendo del ingreso (0,0)
  const route = calculateMosquitoRoute(targetVehicles, { x: 0, y: 0 });

  // Hoja de ruta para el chofer
  console.log(
    `✅ HOJA DE RUTA GENERADA (${route.length}/${MAX_CAPACITY} autos a cargar):`,
  );

  route.forEach((v, index) => {
    console.log(
      `   📌 Parada ${index + 1}: Sector ${v.sector} | ${v.posicionSlot} | VIN: ${v.vin} | ${v.model} ${v.color}`,
    );
  });
}

// Probar orden dispersa
dispatchMosquitoOrder("Necesito 12 Cronos blancos");
