// 1. Parser simulado usando expresiones regulares (Sin API externa)
function parseOrderLocal(prompt) {
  const text = prompt.toLowerCase();

  // Buscar cantidad
  const qtyMatch = text.match(/\b(\d+)\b/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  // Buscar modelo
  const models = ['cronos', 'toro', 'pulse', 'argo', 'fastback', 'strada'];
  const model = models.find(m => text.includes(m)) || 'cronos';

  // Buscar color
  const colors = ['blanco', 'negro', 'gris', 'rojo'];
  const color = colors.find(c => text.includes(c)) || null;

  // Buscar sector/lote
  const sectorMatch = text.match(/(?:lote|sector)\s*(\d+)/);
  const sector = sectorMatch ? parseInt(sectorMatch[1], 10) : null;

  return { quantity, model, color, sector };
}

// 2. Generador del Patio Sintético (200 vehículos)
function generateYard() {
  const models = ['Cronos', 'Toro', 'Pulse', 'Argo', 'Fastback', 'Strada'];
  const colors = ['blanco', 'negro', 'gris', 'rojo'];
  const yard = [];
  let count = 1;

  for (let sector = 1; sector <= 6; sector++) {
    for (let i = 0; i < 33; i++) {
      const m = models[Math.floor(Math.random() * models.length)];
      const c = colors[Math.floor(Math.random() * colors.length)];
      yard.push({
        vin: `8AG${m.substring(0,2).toUpperCase()}2026${String(count).padStart(5, '0')}`,
        model: m,
        color: c,
        sector: sector,
        x: (sector - 1) * 20 + (i % 5) * 4,
        y: Math.floor(i / 5) * 5
      });
      count++;
    }
  }
  return yard;
}

// 3. Ejecución de la prueba
const inventory = generateYard();
const userPrompt = "necesito los 12 Cronos blancos del lote 4";

console.log(`💬 Input: "${userPrompt}"`);

// Extraer criterios
const criteria = parseOrderLocal(userPrompt);
console.log("\n📌 Criterios parseados:", criteria);

// Filtrar inventario
let results = inventory.filter(v => 
  v.model.toLowerCase() === criteria.model &&
  (!criteria.color || v.color.toLowerCase() === criteria.color) &&
  (!criteria.sector || v.sector === criteria.sector)
);

if (criteria.quantity) {
  results = results.slice(0, criteria.quantity);
}

console.log(`\n✅ Vehículos encontrados en el patio: ${results.length}`);
console.log("📍 Primeros 3 vehículos encontrados:");
console.table(results.slice(0, 3));