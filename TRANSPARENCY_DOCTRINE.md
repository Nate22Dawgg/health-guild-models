# The Transparency Doctrine

## Health Guild's Commitment to Open Science

Health Guild is built on the principle that **health risk calculations should be transparent, auditable, and evidence-based**.

This document explains our commitment to transparency and how we implement it.

---

## Core Principles

### 1. **Every Model Must Be Auditable**
- All risk calculators are open-source (this repository)
- Exact formulas are visible and reviewable
- Evidence tiers are clearly documented
- References to peer-reviewed research are provided

### 2. **Every Result Must Show Provenance**
- MCP responses include `models_ran` (which calculators executed)
- Each model declares `inputs_used` (what data was analyzed)
- Each model declares `evidence_tier` (quality of underlying research)
- Failed models show `models_skipped` with reasons

### 3. **User Data Ownership**
- All calculations are stateless (no server-side PHI storage)
- Data stays in user's browser or personal files
- Users can export their complete health data as JSON
- Platform never logs, stores, or transmits health data

---

## Evidence Tiers

Health Guild uses a 3-tier evidence system:

### Tier A: Clinical Guidelines
**Definition:** Based on peer-reviewed clinical practice guidelines from major medical organizations.

**Examples:**
- **ASCVD 10-Year Risk**: ACC/AHA 2013 Pooled Cohort Equations
- **eGFR**: CKD-EPI 2021 creatinine-based equation (KDIGO guidelines)
- **CKD Staging**: KDIGO 2012 classification

**Why it matters:** These are the gold standard used by doctors worldwide.

### Tier B: Validated Research
**Definition:** Based on peer-reviewed studies with clinical validation.

**Examples:**
- **FIB-4 Score**: Sterling et al. 2006 (validated for liver fibrosis)
- **NAFLD Fibrosis Score**: Angulo et al. 2007 (validated in NAFLD patients)
- **HOMA-IR**: Matthews et al. 1985 (widely used insulin resistance index)

**Why it matters:** Robust evidence, but not yet formalized into clinical guidelines.

### Tier C: Experimental
**Definition:** Novel algorithms or composite scores without widespread clinical validation.

**Examples:**
- **Health Index**: Weighted composite score across 6 health domains (Health Guild proprietary)
- **Domain Scores**: Aggregated markers per health domain (Health Guild proprietary)

**Why it matters:** Useful for longitudinal tracking, but not a substitute for clinical diagnosis.

---

## Transparency in Action

### Example 1: ASCVD Risk Calculation

**User Input:**
```json
{
  "age": 55,
  "sex": "male",
  "race": "white",
  "cholesterol_total": 200,
  "hdl": 45,
  "systolic_bp": 130,
  "smoking_status": "never",
  "on_bp_meds": false
}
```

**MCP Response:**
```json
{
  "scores": [
    {
      "name": "ASCVD 10-Year Risk",
      "value": 12.5,
      "unit": "%",
      "category": "Intermediate Risk (7.5-20%)",
      "evidence_tier": "A"
    }
  ],
  "models_ran": [
    {
      "name": "ASCVD",
      "inputs_used": [
        "age",
        "sex",
        "race",
        "cholesterol_total",
        "hdl",
        "systolic_bp",
        "smoking_status",
        "on_bp_meds"
      ],
      "evidence_tier": "A",
      "reference": "Goff DC Jr, et al. Circulation. 2014;129(25 Suppl 2):S49-73"
    }
  ],
  "models_skipped": []
}
```

**What you can audit:**
1. Go to `calculators/cardiovascular.ts`
2. Find `calculateASCVD()` function
3. See exact ACC/AHA 2013 formula
4. Verify inputs match: age=55, sex=male, chol=200, hdl=45, bp=130
5. Confirm result: 12.5%

### Example 2: Missing Data

**User Input:**
```json
{
  "age": 55,
  "sex": "male",
  "glucose": 102,
  "hba1c": 5.7
  // Missing: alt, ast, platelets (needed for FIB-4)
}
```

**MCP Response:**
```json
{
  "scores": [
    {
      "name": "HOMA-IR",
      "value": 2.8,
      "evidence_tier": "B"
    }
  ],
  "models_ran": [
    {
      "name": "HOMA-IR",
      "inputs_used": ["glucose", "fasting_insulin"],
      "evidence_tier": "B"
    }
  ],
  "models_skipped": [
    {
      "name": "FIB-4",
      "reason": "Missing required inputs",
      "missing_inputs": ["alt", "ast", "platelets"]
    },
    {
      "name": "ASCVD",
      "reason": "Missing required inputs",
      "missing_inputs": ["cholesterol_total", "hdl", "systolic_bp"]
    }
  ]
}
```

**What this shows:**
- ✅ Only HOMA-IR ran (had glucose + insulin)
- ❌ FIB-4 skipped (needs liver enzymes)
- ❌ ASCVD skipped (needs lipids and blood pressure)
- 🔍 User knows exactly what data to collect next

---

## Longitudinal Analysis Transparency

Health Guild's trend analysis and domain scoring are also transparent.

### Health Index Calculation

**Formula (open-source):**
```typescript
// From engines/healthIndex.ts
const weights = {
  metabolic: 0.25,      // 25% weight
  cardiovascular: 0.25, // 25% weight
  kidney: 0.15,         // 15% weight
  liver: 0.15,          // 15% weight
  inflammation: 0.10,   // 10% weight
  nutrients: 0.10       // 10% weight
};

healthIndex = Σ(domainScore × weight)
```

**Why weights matter:**
- Higher weight for metabolic/cardiovascular (major disease drivers)
- Lower weight for nutrients (important but less immediate risk)
- All weights sum to 1.0 (100%)

**Auditability:**
- See exact formula in `engines/healthIndex.ts`
- See domain score calculations in `engines/domainScoring.ts`
- See trend detection in `engines/trendAnalysis.ts`

---

## What Is NOT Public

While our **models are open-source**, our **platform code is proprietary**:

### Private (Not in This Repo):
- 🔒 User interface design and implementation
- 🔒 API orchestration and routing
- 🔒 Import wizards (Apple Health, CSV, JSON)
- 🔒 Google Drive sync implementation
- 🔒 Deployment infrastructure
- 🔒 Future feature roadmap

### Why This Split?
- **Transparency where it matters**: Users can audit health calculations
- **IP protection**: UI/UX remains a competitive advantage
- **Sustainable business**: Can monetize platform while keeping models open

---

## How to Verify Our Calculations

### For Users:
1. Visit the MCP Dashboard: https://health-guild-mcp.pages.dev/mcp-dashboard.html
2. Click "Run Tool" on `calculate_risk_scores`
3. Enter your health data
4. Review the `models_ran` section in the response
5. Click "GitHub" to see the source code for each model
6. Verify formulas match published research

### For Developers:
1. Clone this repository: `git clone https://github.com/Nate22Dawgg/health-guild-models.git`
2. Review `/calculators/` for risk score implementations
3. Review `/engines/` for trend analysis and domain scoring
4. Review `/mcp/tools.ts` for MCP tool schemas
5. Check `/examples/` for sample requests/responses
6. Run tests (when available): `npm test`

### For Healthcare Providers:
1. Review `/calculators/` to confirm formulas match clinical guidelines
2. Check evidence tiers and references in each calculator
3. Verify required inputs align with standard lab panels
4. Confirm risk categories match published thresholds
5. Provide feedback via GitHub Issues

---

## Commitment to Updates

As medical research evolves, so will our models:

### When Guidelines Update:
- We update calculators to match latest evidence
- Version bumps follow semantic versioning
- Changelog documents what changed and why
- Old versions remain in git history (for reproducibility)

### Example:
```
v1.0.0 → v2.0.0: Updated eGFR to CKD-EPI 2021 (removed race coefficient)
Reason: Inker et al. NEJM 2021 - race-free equation now recommended
Reference: https://pubmed.ncbi.nlm.nih.gov/34554658/
```

---

## Community Contributions

We welcome contributions to improve model accuracy:

### How to Contribute:
1. **Report issues**: Found a calculation error? Open a GitHub Issue
2. **Suggest improvements**: Know of a better formula? Submit a Pull Request
3. **Add calculators**: Want to contribute a new risk score? We'll review
4. **Improve documentation**: Clarify formulas or add references

### Guidelines:
- All calculators must cite peer-reviewed evidence
- Include unit tests with known-good values
- Document required inputs and edge cases
- Maintain TypeScript type safety

---

## Contact

- **Public Models**: https://github.com/Nate22Dawgg/health-guild-models
- **Platform**: https://health-guild-mcp.pages.dev
- **Issues**: Open a GitHub Issue on this repo
- **Questions**: See README.md for detailed documentation

---

## License

All models in this repository are open-source under the MIT License.

See [LICENSE](LICENSE) for details.

---

**Built with ❤️ for transparent, evidence-based health insights.**

*Last updated: 2024*
