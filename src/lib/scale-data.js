// 100K rule generator for the Inventory + Z+Graph cluster view
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

export function genScaleRules() {
  const rules = [];
  const seed = (i) => (Math.sin(i * 9301 + 49297) % 1 + 1) % 1;
  for (let i = 0; i < 100000; i++) {
    const dom = SCALE_DOMS[Math.floor(seed(i) * 10)];
    const names = RULE_NAMES[dom];
    const name = names[Math.floor(seed(i + 1) * names.length)];
    const files = TAL_FILES[dom];
    const file = files[Math.floor(seed(i + 2) * files.length)];
    const crits = ['HIGH', 'MEDIUM', 'LOW'];
    const s3 = seed(i + 3);
    const crit = crits[s3 < 0.15 ? 0 : s3 < 0.5 ? 1 : 2];
    const lineStart = Math.floor(seed(i + 4) * 2000) + 1;
    const variant = Math.floor(i / 200);
    rules.push({
      id: `R${String(i + 1).padStart(6, '0')}`,
      name: `${name}${variant > 0 ? ' v' + variant : ''}`,
      dom, crit,
      type: seed(i + 5) < 0.85 ? 'code' : 'document',
      file,
      lines: `${lineStart}–${lineStart + Math.floor(seed(i + 6) * 120) + 20}`,
    });
  }
  return rules;
}

export const DOM_COUNTS_MAP = SCALE_DOMS.reduce((a, d, i) => {
  const dist = [0.12, 0.14, 0.10, 0.08, 0.11, 0.09, 0.07, 0.10, 0.10, 0.09];
  a[d] = Math.round(100000 * dist[i]);
  return a;
}, {});

// Cross-domain coupling: each rule preferentially triggers ~70% intra-domain,
// ~30% to a related domain (forming the dense call graph BFSI systems actually have).
const DOMAIN_NEIGHBORS = {
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

/**
 * Generate ~300K dependency edges for the 100K rules.
 * Each rule triggers 2-4 downstream rules. Realistic call-graph density.
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
    const r = rules[i];
    const triggerCount = 2 + Math.floor(seed(i + 0.7) * 3); // 2-4 triggers
    const neighbors = DOMAIN_NEIGHBORS[r.dom] || [r.dom];
    for (let k = 0; k < triggerCount; k++) {
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
