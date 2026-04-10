// Rule generator for the Inventory + Z+Graph cluster view + Z+G2 call graph
export const TOTAL_RULES = 2000;
export const TOTAL_EDGES_TARGET = 5000;
export const SCALE_DOMS = [
  'Authorization', 'Fraud', 'Credit', 'Pricing', 'Compliance',
  'Settlement', 'Reporting', 'Risk', 'Operations', 'Security',
];

export const SCALE_DOM_COLORS = {
  Authorization: '#2563eb', Fraud: '#dc2626', Credit: '#d97706',
  Pricing: '#059669', Compliance: '#7c3aed', Settlement: '#0d9488',
  Reporting: '#6366f1', Risk: '#ea580c', Operations: '#65a30d', Security: '#be185d',
};

export const RULE_NAMES = {
  Authorization: ['Card Status Validation','BIN Range Check','PAN Format Verify','Expiry Date Check','PIN Verification','CVV Validation','3DS Authentication','EMV Chip Read','Contactless Limit','Token Mapping','Issuer Routing','Network Selection','Acquirer Validation','Terminal Auth','Merchant Validation','Stand-In Processing','Decline Override','Reversal Handling','Auth Hold','Partial Auth'],
  Fraud: ['Velocity Check','Geo-Risk Score','Device Fingerprint','IP Blacklist','Behavioral Analysis','Transaction Pattern','Account Takeover','Card Testing','Friendly Fraud','Chargeback Predict','Synthetic Identity','Money Mule Detect','Cross-Border Risk','MCC Risk Score','Time-of-Day Risk','Amount Anomaly','Merchant Risk','Shipping Mismatch','Email Domain Risk','Phone Verify'],
  Credit: ['Credit Limit Auth','Overlimit Check','Balance Inquiry','Available Credit','Payment Due Check','Minimum Payment','Interest Calc','Late Fee Assess','Grace Period','Credit Score Pull','Utilization Ratio','Hardship Flag','Collections Route','Write-Off Threshold','Recovery Score','Workout Plan','Promise to Pay','Skip Trace','Balance Transfer','Cash Advance Limit'],
  Pricing: ['Interchange Calc','FX Margin','Cross-Border Fee','ATM Surcharge','Annual Fee','Late Payment Fee','Balance Transfer Fee','Cash Advance Fee','Foreign Transaction','Over-Limit Fee','Return Payment Fee','Expedited Payment','Statement Copy Fee','Account Research','Wire Transfer Fee','Currency Conv','Dynamic Pricing','Loyalty Discount','Promotional Rate','Penalty APR'],
  Compliance: ['AML Screening','CTR Filing','SAR Filing','OFAC Check','KYC Verification','PEP Screening','Sanctions List','CDD Review','EDD Trigger','FinCEN Report','Reg E Dispute','Reg Z Disclosure','TILA Compliance','FCRA Check','ECOA Monitor','UDAAP Screen','GLBA Privacy','SOX Audit','BSA Monitor','Patriot Act'],
  Settlement: ['Batch Processing','Net Settlement','Gross Settlement','Clearing House','Interchange Settle','Cross-Border Settle','Multi-Currency','Reconciliation','Exception Handle','Chargeback Settle','Representment','Pre-Arbitration','Compliance Settle','Fee Collection','Revenue Share','Merchant Payout','Issuer Settle','Network Settle','Reserve Calc','Funding Cycle'],
  Reporting: ['Daily Auth Report','Fraud Summary','Settlement Report','Compliance Report','Risk Dashboard','Revenue Report','Exception Report','Audit Trail','Regulatory Filing','Portfolio Report','Merchant Report','Issuer Report','Network Report','Dispute Report','Collections Report','Write-Off Report','Recovery Report','Fee Revenue','Volume Analytics','Trend Analysis'],
  Risk: ['Credit Risk Score','Market Risk Calc','Operational Risk','Liquidity Risk','Counterparty Risk','Concentration Risk','Interest Rate Risk','Currency Risk','Regulatory Risk','Reputation Risk','Model Risk','Cyber Risk Score','Third Party Risk','Strategic Risk','Legal Risk','Environmental Risk','Technology Risk','People Risk','Process Risk','Systemic Risk'],
  Operations: ['Batch Scheduler','Queue Manager','Load Balancer','Failover Switch','Health Monitor','Log Aggregator','Alert Router','Capacity Plan','Incident Trigger','Change Control','Release Gate','Config Manager','Cache Refresh','Session Manager','Rate Limiter','Timeout Handler','Retry Logic','Circuit Breaker','Dead Letter Queue','Archive Rotate'],
  Security: ['Encryption Check','Token Vault','Key Rotation','Access Control','MFA Enforce','Session Timeout','IP Whitelist','API Rate Limit','WAF Rule','DDoS Protect','Cert Validate','HSTS Enforce','CSP Policy','Data Masking','Audit Log','Intrusion Detect','Vuln Scan','Pen Test Gate','SOC Monitor','Zero Trust'],
};

export const TAL_FILES = {
  Authorization: ['AUTHPROC.TAL','BINVALID.TAL','PANCHECK.TAL','EMVPROC.TAL','TOKENMAP.TAL'],
  Fraud: ['FRAUDCHK.TAL','GEORISK.TAL','DEVFPRT.TAL','BEHVRSK.TAL','PATTRNCHK.TAL'],
  Credit: ['CREDITAUTH.TAL','BALCHK.TAL','INTCALC.TAL','COLLROUTE.TAL','WRKOUT.TAL'],
  Pricing: ['FEECALC.TAL','FXMARGIN.TAL','DYNPRICE.TAL','PROMO.TAL','PENALTY.TAL'],
  Compliance: ['AMLCHK.TAL','KYCPROC.TAL','SANCTION.TAL','REGMON.TAL','BSAPROC.TAL'],
  Settlement: ['SETTLPROC.TAL','CLRHOUSE.TAL','RECONC.TAL','CHGBKSETTL.TAL','FUNDCYC.TAL'],
  Reporting: ['RPTGEN.TAL','DASHBRD.TAL','AUDTRAIL.TAL','REGFILE.TAL','ANALYTICS.TAL'],
  Risk: ['RISKSCR.TAL','MKTRISK.TAL','OPRISK.TAL','MDLRISK.TAL','CYBRISK.TAL'],
  Operations: ['BATCHSCHED.TAL','QMGR.TAL','FAILOVER.TAL','HLTHMON.TAL','CFGMGR.TAL'],
  Security: ['ENCCHK.TAL','TOKVAULT.TAL','KEYROT.TAL','ACCESSCTL.TAL','WAFPROC.TAL'],
};

// Cross-domain coupling: each rule preferentially triggers ~70% intra-domain,
// ~30% to a related domain (forming the dense call graph BFSI systems actually have).
export const DOMAIN_NEIGHBORS = {
  Authorization: ['Fraud', 'Credit', 'Settlement'],
  Fraud: ['Authorization', 'Risk', 'Compliance'],
  Credit: ['Authorization', 'Pricing'],
  Pricing: ['Credit', 'Settlement'],
  Compliance: ['Fraud', 'Reporting'],
  Settlement: ['Authorization', 'Pricing', 'Reporting'],
  Reporting: ['Settlement', 'Compliance', 'Risk'],
  Risk: ['Fraud', 'Reporting'],
  Operations: ['Authorization', 'Settlement', 'Security'],
  Security: ['Authorization', 'Operations'],
};

// Exact domain distribution for the Governed Rules Repository (totals 2000).
export const DOM_COUNTS_MAP = {
  Authorization: 370,
  Security: 372,
  Fraud: 174,
  Compliance: 161,
  Operations: 175,
  Settlement: 157,
  Credit: 148,
  Pricing: 149,
  Reporting: 149,
  Risk: 145,
};

// Generate 2000 rules with both legacy field names (id/name/dom/crit/file/lines)
// and the canonical names used by GraphView (ruleId/ruleName/domain/criticality/
// sourceFile/lineStart/lineEnd/secondaryDomain).
export function genScaleRules() {
  const rules = [];
  const seed = (i) => (Math.sin(i * 9301 + 49297) % 1 + 1) % 1;
  // Build a flat list of (domain, slot) by walking each domain's count.
  const slots = [];
  for (const dom of Object.keys(DOM_COUNTS_MAP)) {
    for (let k = 0; k < DOM_COUNTS_MAP[dom]; k++) slots.push(dom);
  }
  for (let i = 0; i < slots.length; i++) {
    const dom = slots[i];
    const names = RULE_NAMES[dom];
    const name = names[Math.floor(seed(i + 1) * names.length)];
    const files = TAL_FILES[dom];
    const file = files[Math.floor(seed(i + 2) * files.length)];
    const s3 = seed(i + 3);
    const crit = s3 < 0.15 ? 'HIGH' : s3 < 0.5 ? 'MEDIUM' : 'LOW';
    const lineStart = Math.floor(seed(i + 4) * 2000) + 1;
    const lineEnd = lineStart + Math.floor(seed(i + 6) * 120) + 20;
    const variant = Math.floor(i / 20);
    const id = `R${String(i + 1).padStart(6, '0')}`;
    // ~15% of rules span a second domain (organic neighbor)
    const neighbors = DOMAIN_NEIGHBORS[dom] || [];
    const secondary =
      neighbors.length && seed(i + 7) < 0.15
        ? neighbors[Math.floor(seed(i + 8) * neighbors.length)]
        : undefined;
    rules.push({
      // Legacy field names — kept for InventoryTab, GraphTab, LineageTab
      id,
      name: `${name}${variant > 0 ? ' v' + variant : ''}`,
      dom,
      crit,
      type: seed(i + 5) < 0.85 ? 'code' : 'document',
      file,
      lines: `${lineStart}–${lineEnd}`,
      // Canonical field names — required by GraphView spec
      ruleId: id,
      ruleName: `${name}${variant > 0 ? ' v' + variant : ''}`,
      domain: dom,
      criticality: crit,
      sourceFile: file,
      lineStart,
      lineEnd,
      ...(secondary ? { secondaryDomain: secondary } : {}),
    });
  }
  return rules;
}

// (DOMAIN_NEIGHBORS hoisted to top of file)

/**
 * Generate ~5K dependency edges for the 2K rules — average 2.5 per rule.
 * 70% intra-domain, 30% cross-domain. Capped at TOTAL_EDGES_TARGET.
 */
export function genScaleEdges(rules) {
  const links = [];
  const N = rules.length;
  // Pre-bucket rule indices by domain for fast random selection
  const byDomain = {};
  SCALE_DOMS.forEach((d) => { byDomain[d] = []; });
  for (let i = 0; i < N; i++) byDomain[rules[i].dom].push(i);

  const seed = (i) => (Math.sin(i * 12.9898 + 78.233) % 1 + 1) % 1;

  for (let i = 0; i < N; i++) {
    if (links.length >= TOTAL_EDGES_TARGET) break;
    const r = rules[i];
    // 1-4 triggers per rule, weighted toward 2-3 (avg ~2.5)
    const s = seed(i + 0.7);
    const triggerCount = s < 0.15 ? 1 : s < 0.55 ? 2 : s < 0.85 ? 3 : 4;
    const neighbors = DOMAIN_NEIGHBORS[r.dom] || [r.dom];
    for (let k = 0; k < triggerCount; k++) {
      if (links.length >= TOTAL_EDGES_TARGET) break;
      // 70% intra-domain, 30% cross-domain to a neighbor
      const cross = seed(i * 7 + k * 3.1) > 0.7;
      const targetDom = cross ? neighbors[Math.floor(seed(i * 11 + k) * neighbors.length)] : r.dom;
      const pool = byDomain[targetDom];
      if (!pool || pool.length === 0) continue;
      const targetIdx = pool[Math.floor(seed(i * 13 + k * 5) * pool.length)];
      if (targetIdx === i) continue;
      links.push({ source: rules[i].id, target: rules[targetIdx].id });
    }
  }
  return links;
}
