---
name: dcf-valuation
description: Performs discounted cash flow (DCF) valuation analysis to estimate intrinsic value per share. Triggers when user asks for fair value, intrinsic value, DCF, valuation, "what is X worth", price target, undervalued/overvalued analysis, or wants to compare current price to fundamental value.
---

# DCF Valuation Skill

## Workflow Checklist

Copy and track progress:
```
DCF Analysis Progress:
- [ ] Step 1: Gather financial data (including peer group)
- [ ] Step 2: Calculate FCF growth rate
- [ ] Step 3: Estimate discount rate (WACC)
- [ ] Step 4: Project future cash flows (Years 1-5 + Terminal via two methods)
- [ ] Step 5: Calculate present value and fair value per share
- [ ] Step 5b: Relative valuation cross-check (peer comps)
- [ ] Step 5c: Bull / Base / Bear scenarios
- [ ] Step 6: Run sensitivity analysis (with peer validation)
- [ ] Step 7: Validate results
- [ ] Step 8: Present results with converging ranges
```

## Step 1: Gather Financial Data

Call the `get_financials` tool with these queries:

### 1.1 Cash Flow History
**Query:** `"[TICKER] annual cash flow statements for the last 5 years"`

**Extract:** `free_cash_flow`, `net_cash_flow_from_operations`, `capital_expenditure`

**Fallback:** If `free_cash_flow` missing, calculate: `net_cash_flow_from_operations - capital_expenditure`

### 1.2 Financial Metrics
**Query:** `"[TICKER] financial metrics snapshot"`

**Extract:** `market_cap`, `enterprise_value`, `free_cash_flow_growth`, `revenue_growth`, `return_on_invested_capital`, `debt_to_equity`, `free_cash_flow_per_share`

### 1.3 Balance Sheet
**Query:** `"[TICKER] latest balance sheet"`

**Extract:** `total_debt`, `cash_and_equivalents`, `current_investments`, `outstanding_shares`

**Fallback:** If `current_investments` missing, use 0

### 1.4 Analyst Estimates
**Query:** `"[TICKER] analyst estimates"`

**Extract:** `earnings_per_share` (forward estimates by fiscal year)

**Use:** Calculate implied EPS growth rate for cross-validation

### 1.5 Current Price
Call the `get_market_data` tool:

**Query:** `"[TICKER] price snapshot"`

**Extract:** `price`

### 1.6 Company Facts
Call the `get_financials` tool:

**Query:** `"[TICKER] company facts"`

**Extract:** `sector`, `industry`, `market_cap`

**Use:** Determine appropriate WACC range from [sector-wacc.md](sector-wacc.md)

### 1.7 Peer Group Data

**Purpose:** Gather comparable company multiples for relative valuation cross-check.

**Peer selection (8-12 companies):**
1. Start with the sector ETF holdings (see CLAUDE.md Sector ETF Reference table)
2. Filter to same industry using `get_company_facts` for each
3. Prefer similar market cap range (0.3x to 3x target's market cap)

**For each peer, call:**
- `get_key_ratios_snapshot` → extract: `pe_ratio`, `ev_to_ebitda`, `ev_to_revenue`, `market_cap`
- `get_income_statements` (limit 1, period annual) → extract: `revenue`, `revenue` YoY growth

**Store:** Peer ticker, name, and all extracted metrics for Step 5b.

## Step 2: Calculate FCF Growth Rate

Calculate 5-year FCF CAGR from cash flow history.

**Cross-validate with:** `free_cash_flow_growth` (YoY), `revenue_growth`, analyst EPS growth

**Growth rate selection:**
- Stable FCF history → Use CAGR with 10-20% haircut
- Volatile FCF → Weight analyst estimates more heavily
- **Cap at 15%** (sustained higher growth is rare)

## Step 3: Estimate Discount Rate (WACC)

**Use the `sector` from company facts** to select the appropriate base WACC range from [sector-wacc.md](sector-wacc.md).

**Default assumptions:**
- Risk-free rate: 4%
- Equity risk premium: 5-6%
- Cost of debt: 5-6% pre-tax (~4% after-tax at 30% tax rate)

Calculate WACC using `debt_to_equity` for capital structure weights.

**Reasonableness check:** WACC should be 2-4% below `return_on_invested_capital` for value-creating companies.

**Sector adjustments:** Apply adjustment factors from [sector-wacc.md](sector-wacc.md) based on company-specific characteristics.

## Step 4: Project Future Cash Flows

**Years 1-5:** Apply growth rate with 5% annual decay (multiply growth rate by 0.95, 0.90, 0.85, 0.80 for years 2-5). This reflects competitive dynamics.

**Terminal value (two methods — average both):**

1. **Gordon Growth Model:** Terminal FCF × (1 + g) / (WACC - g), where g = 2.5% (GDP proxy)
2. **Exit multiple:** Year 5 EBITDA × sector median EV/EBITDA (from peer data in Step 1.7)

If the two methods diverge >25%, investigate why and note which is more reliable for this company. Use the average unless one method is clearly inappropriate (e.g., exit multiple unreliable if no close peers).

## Step 5: Calculate Present Value

Discount all FCFs → sum for Enterprise Value → subtract Net Debt → divide by `outstanding_shares` for fair value per share.

## Step 5b: Relative Valuation Cross-Check

Using peer data from Step 1.7:

1. **Calculate percentiles** across peers for each multiple (EV/EBITDA, P/E, EV/Revenue):
   - 25th percentile, median, 75th percentile

2. **Compute implied valuation** for the target company:
   - Target EBITDA × peer median EV/EBITDA → implied EV → subtract net debt → per share
   - Target earnings × peer median P/E → implied price per share

3. **Compare to DCF fair value:**
   - If DCF and peer-implied values are within 20% → high conviction zone
   - If divergence >20% → flag and explain (growth premium? margin discount? cyclical difference?)

4. **Premium/discount assessment:**
   - Does the target deserve a premium vs. peers? (faster growth, wider moat, better margins)
   - Or a discount? (higher leverage, lower growth, regulatory risk)

## Step 5c: Bull / Base / Bear Scenarios

Run three DCF scenarios using these assumption shifts:

| Scenario | Growth Rate | WACC | Terminal Growth | Description |
|----------|------------|------|-----------------|-------------|
| **Bull** | Base +20% | Base -0.5% | 3.0% | Thesis plays out, catalysts hit |
| **Base** | As calculated | As calculated | 2.5% | Most likely outcome |
| **Bear** | Base -30% | Base +1.0% | 2.0% | Key risks materialize |

Present three fair value estimates. The base case is the primary recommendation; bull/bear define the range.

## Step 6: Sensitivity Analysis

Create 3×3 matrix: WACC (base ±1%) vs terminal growth (2.0%, 2.5%, 3.0%).

**Peer validation:** Compare base WACC to the implied cost of capital from peer trading multiples. If peers trade at significantly different multiples, your WACC may need adjustment.

## Step 7: Validate Results

Before presenting, verify these sanity checks:

1. **EV comparison**: Calculated EV should be within 30% of reported `enterprise_value`
   - If off by >30%, revisit WACC or growth assumptions

2. **Terminal value ratio**: Terminal value should be 50-80% of total EV for mature companies
   - If >90%, growth rate may be too high
   - If <40%, near-term projections may be aggressive

3. **Per-share cross-check**: Compare to `free_cash_flow_per_share × 15-25` as rough sanity check

If validation fails, reconsider assumptions before presenting results.

## Step 8: Output Format

Present a structured summary including:

1. **Valuation Summary**: Bull / base / bear fair values vs. current price
2. **Key Inputs Table**: All assumptions with their sources
3. **Projected FCF Table**: 5-year projections with present values (base case)
4. **Converging Ranges Table**: Multiple methods side by side

| Method | Low | Mid | High | Source |
|--------|-----|-----|------|--------|
| DCF | $X | $X | $X | Bear / Base / Bull |
| Peer EV/EBITDA | $X | $X | $X | 25th / 50th / 75th percentile |
| Peer P/E | $X | $X | $X | 25th / 50th / 75th percentile |
| Analyst targets | $X | $X | $X | Low / median / high |
| 52-week range | $X | — | $X | Low / high |

**Convergence zone:** $X - $X (where 3+ methods overlap)

5. **Sensitivity Matrix**: 3×3 grid varying WACC (±1%) and terminal growth (2.0%, 2.5%, 3.0%)
6. **Caveats**: Standard DCF limitations plus company-specific risks
