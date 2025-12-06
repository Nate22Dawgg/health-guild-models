# Health Guild Models - Version Tracking

## Purpose
This file tracks the sync status between the **public models repository** and the **private production platform**.

## Versioning Strategy
- **Public Repo**: Contains snapshot copies of production models for transparency
- **Private Platform**: Uses its own internal models (may diverge)
- **Version Format**: `YYYY-MM-DD-HHMMSS` (timestamp of last sync)

---

## Current Version

**Last Sync**: 2025-12-06-013000 (December 6, 2025 01:30 UTC)

**Sync Hash**: `INITIAL_FULL_SYNC`

**Source Commit**: `3f0b78c` (Democratize-Health private repo)

---

## Files Synced

### Calculators (11 files)
- ✅ `calculators/index.ts` - Main export
- ✅ `calculators/cardiovascular.ts` - ASCVD, Framingham
- ✅ `calculators/liver.ts` - FIB-4, NAFLD
- ✅ `calculators/kidney.ts` - eGFR, CKD-EPI
- ✅ `calculators/metabolic.ts` - HOMA-IR
- ✅ `calculators/thyroid.ts` - TSH, T3/T4 ratios
- ✅ `calculators/hormone.ts` - Testosterone, estradiol
- ✅ `calculators/cbc.ts` - Complete blood count
- ✅ `calculators/advanced-lipids.ts` - ApoB, Lp(a), sdLDL
- ✅ `calculators/derived-ratios.ts` - TC/HDL, TG/HDL, etc.
- ✅ `calculators/electrolytes.ts` - Sodium, potassium

### MCP Tools (3 files)
- ✅ `mcp/server.ts` - MCP protocol server
- ✅ `mcp/tools.ts` - 28 MCP tool definitions
- ✅ `mcp/types.ts` - MCP type definitions

### Engines (6 files)
- ✅ `engines/coverageAnalysis.ts` - Data coverage analysis
- ✅ `engines/domainScoring.ts` - Domain-specific health scores
- ✅ `engines/healthIndex.ts` - Overall health index (0-100)
- ✅ `engines/trendAnalysis.ts` - Longitudinal trend analysis
- ✅ `engines/derivedRatios.ts` - Derived biomarker ratios
- ✅ `engines/imputationEngine.ts` - Biomarker prediction/imputation

### Types (1 file)
- ✅ `types/health-data.ts` - Core data structures

---

## Not Included (Private Platform Only)

These files remain in the private platform and are NOT synced to public:
- ❌ `engines/healthStoryFlow.ts` - Health story orchestration (proprietary)
- ❌ `engines/llmNarratives.ts` - LLM-based narrative generation (proprietary)
- ❌ `engines/correlationAnalysis.ts` - Wearable correlation analysis (proprietary)
- ❌ `engines/intelligentOCR.ts` - PDF OCR parsing (proprietary)
- ❌ `engines/appleHealthParser.ts` - Apple Health parsing (proprietary)
- ❌ `engines/pdfExport.ts` - PDF generation (proprietary)
- ❌ `engines/timelineQuery.ts` - Timeline querying (proprietary)
- ❌ `engines/timelineExport.ts` - Timeline export (proprietary)
- ❌ Frontend code (proprietary)
- ❌ API routes (proprietary)
- ❌ Deployment configurations (proprietary)

---

## Fork Detection

### How to Check if Models Have Forked

Run this comparison to detect divergence:

```bash
# Compare file hashes
md5sum health-guild-models/calculators/*.ts > public_hashes.txt
md5sum webapp/src/calculators/*.ts > private_hashes.txt
diff public_hashes.txt private_hashes.txt
```

### Similarity Thresholds
- **100% match**: Files are identical
- **95-99% similar**: Minor updates (comments, formatting)
- **85-94% similar**: Moderate changes (bug fixes, small improvements)
- **<85% similar**: Significant divergence (model changes, new features)

---

## Update Process

### To Sync Public Repo with Latest Private Models:

```bash
# 1. Copy latest files from private repo
cp -r /path/to/private/calculators/* health-guild-models/calculators/
cp -r /path/to/private/mcp/* health-guild-models/mcp/
cp -r /path/to/private/engines/{coverage,domain,health,trend,derived,imputation}* health-guild-models/engines/

# 2. Update VERSION.md with new timestamp
# 3. Git commit with meaningful message
git add .
git commit -m "Sync models from private platform - $(date +%Y-%m-%d)"
git push origin main
```

---

## Changelog

### 2025-12-06-013000 - Initial Full Sync
- Synced all 11 calculator files
- Synced all 28 MCP tool definitions
- Synced 6 deterministic engine files
- Synced core type definitions
- Established versioning system
- Created fork detection strategy

---

## Future Enhancements

- [ ] Automated sync script
- [ ] GitHub Actions workflow for periodic sync
- [ ] Diff report generation
- [ ] Similarity percentage calculator
- [ ] Dashboard integration for fork detection
- [ ] Public vs Private model switcher in UI
