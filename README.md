# Health Guild Models

**Open-source clinical calculators and MCP tools for transparent health risk modeling**

This repository contains the **scientific core** of Health Guild—all clinical calculators, analysis engines, and MCP tool definitions used to compute health risk scores and provide longitudinal analysis.

---

## 🎯 Philosophy

**Transparency First**: Every risk score shows exactly which models ran, what inputs were used, and the evidence tier of each calculation.

**User Data Ownership**: These models are stateless—they never store or transmit personal health information. All data stays in the user's browser or personal files.

**Open Science**: By open-sourcing our models, we enable:
- Independent verification of calculations
- Community contributions and improvements
- Trust through transparency

---

## 📦 Repository Structure

```
health-guild-models/
├── calculators/          # Clinical risk calculators
│   ├── ascvd.ts         # ASCVD 10-year cardiovascular risk
│   ├── fib4.ts          # FIB-4 liver fibrosis score
│   ├── nafld.ts         # NAFLD fibrosis score
│   ├── egfr.ts          # eGFR (CKD-EPI 2021)
│   ├── ckd.ts           # CKD staging
│   └── homaIR.ts        # HOMA-IR insulin resistance
├── engines/             # Analysis engines
│   ├── trendAnalysis.ts # Longitudinal trend detection
│   ├── domainScoring.ts # 6-domain health scoring
│   └── healthIndex.ts   # Overall Health Index (0-100)
├── mcp/                 # Model Context Protocol definitions
│   ├── tools.ts         # MCP tool schemas
│   └── schema.ts        # JSON-RPC 2.0 types
├── types/               # Shared TypeScript types
│   ├── labs.ts          # Lab data structures
│   └── profile.ts       # User profile types
└── examples/            # Example payloads and responses
    ├── calculate_risk_scores.json
    ├── analyze_lab_history.json
    └── health_coverage_map.json
```

---

## 🧮 Available Models

### 1. Clinical Risk Calculators

| Calculator | Purpose | Evidence Tier | Reference |
|------------|---------|---------------|-----------|
| **ASCVD** | 10-year cardiovascular risk | A | [ACC/AHA 2013](https://www.ahajournals.org/doi/10.1161/01.cir.0000437738.63853.7a) |
| **FIB-4** | Liver fibrosis severity | A | [Sterling et al. 2006](https://pubmed.ncbi.nlm.nih.gov/16557397/) |
| **NAFLD** | NAFLD fibrosis score | A | [Angulo et al. 2007](https://pubmed.ncbi.nlm.nih.gov/17393509/) |
| **eGFR** | Kidney function (CKD-EPI 2021) | A | [Inker et al. 2021](https://pubmed.ncbi.nlm.nih.gov/34554658/) |
| **CKD Stage** | Chronic kidney disease staging | A | [KDIGO 2012](https://kdigo.org/guidelines/) |
| **HOMA-IR** | Insulin resistance | B | [Matthews et al. 1985](https://pubmed.ncbi.nlm.nih.gov/3899825/) |

### 2. Longitudinal Analysis Engines

- **Trend Analysis**: Detects improving/worsening/stable patterns across 20+ lab markers
- **Domain Scoring**: Aggregates markers into 6 health domains (Metabolic, Cardiovascular, Kidney, Liver, Inflammation, Nutrients)
- **Health Index**: Weighted composite score (0-100) across all domains

---

## 🔌 Model Context Protocol (MCP) Tools

Health Guild implements 4 MCP tools for stateless health analysis:

### 1. `calculate_risk_scores`
Computes clinical risk scores from a single point-in-time snapshot.

**Input:**
```typescript
{
  user_profile: { age, sex, race, smoking_status, ... },
  labs: { glucose, hba1c, cholesterol_total, ldl, hdl, ... }
}
```

**Output:**
```typescript
{
  scores: [
    { name: "ASCVD 10-Year Risk", value: 12.5, unit: "%", category: "Intermediate", evidence_tier: "A" }
  ],
  models_ran: [
    { name: "ASCVD", inputs_used: ["age", "sex", "cholesterol_total", ...], evidence_tier: "A" }
  ],
  models_skipped: [
    { name: "FIB-4", reason: "Missing required inputs", missing_inputs: ["alt", "ast", "platelets"] }
  ]
}
```

### 2. `analyze_lab_history`
Performs longitudinal analysis on time-series lab data.

**Input:**
```typescript
{
  user_profile: { ... },
  lab_history: [
    { date: "2024-01-15", labs: { glucose: 95, hba1c: 5.4, ... } },
    { date: "2024-06-10", labs: { glucose: 102, hba1c: 5.7, ... } }
  ]
}
```

**Output:**
```typescript
{
  health_index: { score: 72, category: "Good", trend: "stable" },
  domain_scores: [
    { domain: "Metabolic", score: 68, category: "Fair", markers_included: ["glucose", "hba1c"], trend: "worsening" }
  ],
  marker_trends: [
    { marker: "glucose", trend: "worsening", severity: "moderate", change_percent: 7.4, earliest_value: 95, latest_value: 102 }
  ],
  recommendations: [
    { priority: "high", domain: "Metabolic", action: "Monitor rising glucose trends..." }
  ]
}
```

### 3. `health_coverage_map`
Analyzes data completeness and suggests additional tests.

**Input:**
```typescript
{
  user_profile: { ... },
  lab_history: [ ... ]
}
```

**Output:**
```typescript
{
  coverage_summary: { total_markers_available: 12, total_markers_possible: 25, coverage_percent: 48 },
  domain_coverage: [
    { domain: "Metabolic", available_markers: ["glucose", "hba1c"], missing_markers: ["fasting_insulin"], coverage_percent: 67 }
  ],
  suggested_tests: [
    { priority: "high", test: "Lipid Panel", reason: "Enables ASCVD risk calculation", domains: ["Cardiovascular"] }
  ]
}
```

### 4. `get_calculator_info`
Returns metadata about available calculators (name, evidence tier, required inputs).

---

## 🔐 Privacy & Security

- **Stateless**: Models never persist or transmit PHI
- **Browser-only**: All calculations run client-side or in ephemeral edge functions
- **Zero logs**: No health data is logged server-side
- **Open source**: Independently verifiable code

---

## 🚀 Usage

### As a Library (TypeScript/Node.js)

```typescript
import { calculateRiskScores } from './calculators/riskScores'
import { analyzeLabHistory } from './engines/trendAnalysis'

const result = calculateRiskScores({
  user_profile: { age: 55, sex: 'male', smoking_status: 'never', race: 'white' },
  labs: { cholesterol_total: 200, hdl: 45, ldl: 130, systolic_bp: 130, ... }
})

console.log(result.scores)
console.log(result.models_ran)
```

### Via MCP (Model Context Protocol)

Health Guild exposes these models via a JSON-RPC 2.0 MCP server at:
```
https://health-guild-mcp.pages.dev/mcp
```

**Example request:**
```bash
curl -X POST https://health-guild-mcp.pages.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "calculate_risk_scores",
      "arguments": {
        "user_profile": { "age": 55, "sex": "male", ... },
        "labs": { "cholesterol_total": 200, ... }
      }
    }
  }'
```

---

## 📚 Examples

See `/examples/` for complete request/response samples for each MCP tool.

---

## 🤝 Contributing

We welcome contributions! Areas for improvement:
- Additional clinical calculators (e.g., Framingham, QRISK3)
- Enhanced trend detection algorithms
- Support for more lab markers
- Improved evidence tier documentation

**Guidelines:**
1. All calculators must cite peer-reviewed evidence
2. Include unit tests with known-good values
3. Document required inputs and edge cases
4. Maintain TypeScript type safety

---

## 📄 License

MIT License - See LICENSE file

---

## 🔗 Related

- **Health Guild Platform**: [https://health-guild-mcp.pages.dev](https://health-guild-mcp.pages.dev) (proprietary UI, uses these models)
- **MCP Dashboard**: [https://health-guild-mcp.pages.dev/mcp-dashboard.html](https://health-guild-mcp.pages.dev/mcp-dashboard.html) (test models interactively)
- **Documentation**: See `/docs/` for detailed methodology

---

**Built with ❤️ for transparent, user-owned health insights**
