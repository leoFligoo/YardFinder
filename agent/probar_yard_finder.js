/**
 * Yard Finder - Módulo Completo de Despacho, Capacidad y Trazado para Camión Mosquito
 *
 * Este módulo contiene la lógica completa para:
 * 1. Parsear el pedido en lenguaje natural (RegEx local).
 * 2. Filtrar el patio sintético (200 vehículos en 6 sectores).
 * 3. Aplicar la restricción estricta de cupo (Máximo 8 vehículos por viaje para camión mosquito).
 * 4. Optimizar el recorrido de recolección (Algoritmo Nearest Neighbor desde la entrada 0,0).
 * 5. Generar la recomendación detallada para el chofer y la serie de coordenadas X,Y para trazar la línea en el mapa UI.
 */

// 1. PARSER DE PEDIDO (Extrae cantidad, modelo, color y sector)
function parseOrder(prompt) {
  const text = prompt.toLowerCase();

  const qtyMatch = text.match(/\b(\d+)\b/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  const models = ["cronos", "toro", "pulse", "argo", "fastback", "strada"];
  const model = models.find((m) => text.includes(m)) || null;

  const colors = ["blanco", "negro", "gris", "rojo"];
  const color = colors.find((c) => text.includes(c)) || null;

  const sectorMatch = text.match(/(?:lote|sector)\s*(\d+)/);
  const sector = sectorMatch ? parseInt(sectorMatch[1], 10) : null;

  return { quantity, model, color, sector };
}

// 2. GENERADOR DEL PATIO SINTÉTICO (200 Vehículos distribuidos en 6 sectores)
function generateSyntheticYard() {
  const models = ["Cronos", "Toro", "Pulse", "Argo", "Fastback", "Strada"];
  const colors = ["blanco", "negro", "gris", "rojo"];
  const yard = [];
  let count = 1;

  for (let sector = 1; sector <= 6; sector++) {
    const itemsInSector = sector <= 2 ? 34 : 33;
    for (let i = 0; i < itemsInSector; i++) {
      const m = models[(count * 3) % models.length];
      const c = colors[(count * 2) % colors.length];
      yard.push({
        vin: `8AG${m.substring(0, 2).toUpperCase()}2026${String(count).padStart(5, "0")}`,
        model: m,
        color: c,
        sector: sector,
        slot: `Fila ${Math.floor(i / 6) + 1} - Pos ${(i % 6) + 1}`,
        x: (sector - 1) * 35 + (i % 6) * 5, // Ubicación X en metros
        y: Math.floor(i / 6) * 7, // Ubicación Y en metros
      });
      count++;
    }
  }
  return yard;
}

// 3. ALGORITMO RECOMENDADOR Y TRAZADOR DE RUTA ÓPTIMA
function generarRecomendacionYRuta(vehiculos, origen = { x: 0, y: 0 }) {
  if (vehiculos.length === 0)
    return { ruta: [], trazadoRuta: [], distanciaTotal: 0 };

  const pendientes = [...vehiculos];
  const rutaOrdenada = [];
  let posActual = { ...origen };
  let distanciaTotal = 0;

  // El trazado para la UI arranca desde el punto de acceso del camión (0,0)
  const trazadoRuta = [
    { x: origen.x, y: origen.y, etiqueta: "Ingreso Patio (Origen)" },
  ];

  while (pendientes.length > 0) {
    let indiceMasCercano = 0;
    let distanciaMinima = Infinity;

    // Buscar el vehículo más cercano a la ubicación actual del camión
    for (let i = 0; i < pendientes.length; i++) {
      const dist = Math.hypot(
        pendientes[i].x - posActual.x,
        pendientes[i].y - posActual.y,
      );
      if (dist < distanciaMinima) {
        distanciaMinima = dist;
        indiceMasCercano = i;
      }
    }

    const siguiente = pendientes.splice(indiceMasCercano, 1)[0];
    distanciaTotal += distanciaMinima;

    const pasoActual = rutaOrdenada.length + 1;

    rutaOrdenada.push({
      paso: pasoActual,
      vehiculo: siguiente,
      distanciaDesdeAnterior: distanciaMinima,
    });

    // Guardar el punto exacto para graficar la línea continua en el mapa
    trazadoRuta.push({
      x: siguiente.x,
      y: siguiente.y,
      etiqueta: `Parada ${pasoActual}: ${siguiente.model} (VIN: ${siguiente.vin})`,
    });

    posActual = { x: siguiente.x, y: siguiente.y };
  }

  return { ruta: rutaOrdenada, trazadoRuta, distanciaTotal };
}

// 4. FUNCIÓN PRINCIPAL DE DESPACHO Y PRESENTACIÓN DE RESULTADOS
function dispatchMosquitoOrder(userPrompt) {
  const MAX_CAPACITY = 8; // Cupo máximo estricto del camión mosquito
  const yard = generateSyntheticYard();
  const criteria = parseOrder(userPrompt);

  console.log(`\n🚛 ORDEN RECIBIDA: "${userPrompt}"`);
  console.log(
    "------------------------------------------------------------------",
  );

  // Filtrar vehículos en el patio
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
      "❌ No se encontraron vehículos que coincidan con los criterios.",
    );
    return;
  }

  let requestedQty = criteria.quantity || matches.length;

  // Control de capacidad del mosquito (Límite 8)
  if (requestedQty > MAX_CAPACITY) {
    console.log(
      `⚠️ ALERTA DE CAPACIDAD: Se pidieron ${requestedQty} unidades, pero el camión mosquito solo soporta ${MAX_CAPACITY}.`,
    );
    console.log(
      `   Se asignan los primeros ${MAX_CAPACITY} vehículos para este viaje.\n`,
    );
  }

  const targetVehicles = matches.slice(0, MAX_CAPACITY);

  // Generar la recomendación y el trazado
  const { ruta, trazadoRuta, distanciaTotal } = generarRecomendacionYRuta(
    targetVehicles,
    { x: 0, y: 0 },
  );

  // Output 1: Hoja de ruta secuencial para el chofer
  console.log(
    `🗺️ HOJA DE RUTA GENERADA (${ruta.length}/${MAX_CAPACITY} Slots Ocupados):`,
  );
  console.log("Punto de partida: Ingreso principal del patio (0m, 0m)\n");

  ruta.forEach((item) => {
    const v = item.vehiculo;
    console.log(`📍 Parada ${item.paso}:`);
    console.log(`   • Ir a: Sector ${v.sector} (${v.slot})`);
    console.log(`   • Cargar: ${v.model} ${v.color} [VIN: ${v.vin}]`);
    console.log(
      `   • Distancia de tramo: ${item.distanciaDesdeAnterior.toFixed(1)} metros\n`,
    );
  });

  console.log(
    `📏 Distancia total estimada a recorrer: ${distanciaTotal.toFixed(1)} metros\n`,
  );

  // Output 2: Cadena de puntos X,Y para que el Frontend dibuje la línea en el mapa (SVG / Canvas)
  const puntosSVG = trazadoRuta
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  console.log(
    "🎨 TRAZADO DE CAMINO PARA FRONTEND (Propiedad 'points' para SVG polyline):",
  );
  console.log(`"${puntosSVG}"\n`);
}

// Ejecución con el texto enviado por línea de comandos (o valor por defecto)
const consulta = process.argv[2] || "Necesito 12 Cronos blancos";
dispatchMosquitoOrder(consulta);
