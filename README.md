# ⚡ TCG Pro Ledger & Vault (PY)

Sistema integral de finanzas personales, gestión de cobranzas (**dinero colgado**) y análisis de rentabilidad (**P&L y ROI**) para jugadores competitivos y vendedores de cartas coleccionables (TCG como Pokémon, Magic o Yu-Gi-Oh!).

Construido con **React 19**, **TypeScript**, **Vite** y esquemas determinísticos validados con **Zod** y **Vitest**.

---

## 🎯 Dolores que Resuelve

1. **Eliminación de la fricción al registrar ventas:**
   - En lugar de abrir hojas de cálculo complejas en la tienda, ingresas texto en lenguaje natural:
     > *"Le vendí un playset de Charizard a Lucas por 250mil, me dio 100mil y los 150mil me paga el viernes"*
   - El parser extrae automáticamente el comprador, ítems, entrega inicial, saldo pendiente y fecha de vencimiento sin depender de APIs externas ni fallas de red.

2. **Control Semafórico del "Dinero Colgado":**
   - Panel de cuentas por cobrar con clasificación automática: **Vencido (Mora)**, **Por Vencer (≤ 3 días)** y **Al Día**.
   - Generador en 1 clic de recordatorios directos para **WhatsApp** (`wa.me`) con mensaje personalizado y educado.
   - Registro de cobros parciales con validación de montos (nunca permite cobrar más del saldo adeudado).

3. **Módulo de Torneos & P&L Competitivo:**
   - Registra inscripciones, viáticos y transporte.
   - Monetiza premios en efectivo y premios en producto (sobres y cartas selladas calculadas a valor de reventa).
   - Calcula métricas clave: **Balance Neto del Mes**, **ROI por Torneo (%)** y **Tasa de Rentabilidad**.

4. **Portabilidad y Privacidad:**
   - Funciona 100% offline con persistencia en `LocalStorage`.
   - Exportación e importación de backups en formato JSON con validación de esquema en tiempo real.

---

## 🚀 Cómo Ejecutarlo

```bash
# Entrar al directorio
cd /home/alejandro/proyectos/04_tcg_ledger

# Instalar dependencias (ya instaladas)
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Ejecutar suite de pruebas Vitest (39 tests unitarios y guardrails)
npm test

# Compilar para producción
npm run build
```

---

## 🧪 Pruebas Automatizadas (Guardrails)

La suite de tests (`tests/`) cubre:
- **`money-dates.test.ts`:** Formato en Guaraníes (`Gs. 1.200.000` / `₲ 1.200.000`), detección de sufijos (`mil`, `k`, `millones`) y resolución determinística de fechas relativas ("el viernes", "en 2 semanas", "15/11").
- **`parser.test.ts`:** Ingesta en lenguaje natural, extracción de compradores y cartas, detección de números de contacto paraguayos (`+595` / `0981...`) y guardrails ante inconsistencias matemáticas.
- **`ledger.test.ts`:** Cálculos de cuentas por cobrar, estados de mora, amortización de pagos y resumen financiero.

---

## 📁 Arquitectura del Código

```
04_tcg_ledger/
├── src/
│   ├── components/       # Componentes visuales interactivos
│   │   ├── Header.tsx            # Navegación y badge de deudas activas
│   │   ├── IntakeParserView.tsx  # Extractor en lenguaje natural con previsualización
│   │   ├── ReceivablesView.tsx   # Tabla de dinero colgado, cobros y botón WhatsApp
│   │   ├── TournamentsView.tsx   # Calculadora de P&L y registro de torneos
│   │   └── BackupView.tsx        # Importación/Exportación de JSON y datos demo
│   ├── domain/           # Lógica pura de negocio y contratos Zod
│   │   ├── schemas.ts            # Contratos estrictos Zod
│   │   ├── parser.ts             # Parser determinístico en lenguaje natural
│   │   ├── ledger.ts             # Funciones de libro contable y dinero colgado
│   │   ├── tournaments.ts        # Métricas de rentabilidad de torneos (P&L/ROI)
│   │   ├── money.ts              # Normalización de Guaraníes paraguayos
│   │   ├── dates.ts              # Manejo de fechas relativas y plazos
│   │   └── whatsapp.ts           # Integración con wa.me y plantillas
│   ├── storage/          # Persistencia segura y recuperación ante corrupción
│   ├── App.tsx           # Contenedor raíz React 19
│   ├── main.tsx          # Punto de entrada
│   └── index.css         # Diseño dark-mode moderno para mobile y desktop
├── tests/                # Suites de tests con Vitest
└── package.json
```
