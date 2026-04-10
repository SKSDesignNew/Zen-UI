// Core 13 credit-card authorization rules — used across Graph, Lineage, Engine
export const RULES = [
  { id: 'R001', name: 'PAN Format Check', dom: 'Validation', crit: 'LOW', type: 'code',
    src: { f: 'PANVALID.TAL', l: '12–38', r: 'CHK^PAN^FORMAT' },
    tal: 'IF PAN^LENGTH <> 16 AND PAN^LENGTH <> 19 THEN\n  CALL SET^ERROR(ERR^CODE := "14")\n  CALL REJECT^INPUT',
    java: 'if (pan.length() != 16 && pan.length() != 19) {\n  setError("14");\n  throw new InputRejectedException();\n}',
    desc: 'Validates PAN length is 16 or 19 digits before downstream processing.',
    deps: [], trig: ['R002'] },
  { id: 'R002', name: 'Luhn Checksum', dom: 'Validation', crit: 'HIGH', type: 'code',
    src: { f: 'PANVALID.TAL', l: '42–78', r: 'LUHN^CHECK' },
    tal: 'SUM := 0; I := PAN^LENGTH - 2;\nWHILE I >= 0 DO\n  D := PAN[I] * 2;\n  IF D > 9 THEN D := D - 9;\n  SUM := SUM + D; I := I - 2;\nIF SUM MOD 10 <> 0 THEN\n  CALL DECLINE^TRANSACTION("14")',
    java: 'int sum = IntStream.range(0, pan.length())\n  .map(i -> {\n    int d = Character.getNumericValue(pan.charAt(i));\n    if ((pan.length()-i)%2==0) d*=2;\n    return d>9 ? d-9 : d;\n  }).sum();\nif (sum%10!=0) decline("14");',
    desc: 'Luhn mod-10 checksum. Declines with code 14 on failure.',
    deps: ['R001'], trig: ['R003'] },
  { id: 'R003', name: 'BIN Range Lookup', dom: 'Authorization', crit: 'HIGH', type: 'code',
    src: { f: 'AUTHPROC.TAL', l: '45–89', r: 'VALIDATE^BIN^RANGE' },
    tal: 'SCAN BIN^TABLE WHILE BIN^ENTRY.STATUS = "A"\n  IF CARD^BIN >= BIN^ENTRY.LOW AND\n     CARD^BIN <= BIN^ENTRY.HIGH THEN\n    BIN^FOUND := 1',
    java: 'Optional<BinEntry> entry = binTable.stream()\n  .filter(BinEntry::isActive)\n  .filter(b -> cardBin>=b.getLow() && cardBin<=b.getHigh())\n  .findFirst();',
    desc: 'Matches card BIN to active issuer range.',
    deps: ['R002'], trig: ['R004', 'R005'] },
  { id: 'R004', name: 'Card Status Check', dom: 'Authorization', crit: 'HIGH', type: 'code',
    src: { f: 'AUTHPROC.TAL', l: '142–178', r: 'CHECK^CARD^STATUS' },
    tal: 'IF CARD^STATUS <> "ACTIVE" THEN\n  CALL DECLINE^TRANSACTION(RESP^CODE := "05")',
    java: 'if (!card.getStatus().equals(CardStatus.ACTIVE))\n  return declineTransaction("05");',
    desc: 'Validates card is active. Declines code 05 if inactive.',
    deps: ['R003'], trig: ['R006'] },
  { id: 'R005', name: 'Expiry Validation', dom: 'Authorization', crit: 'MEDIUM', type: 'code',
    src: { f: 'AUTHPROC.TAL', l: '92–110', r: 'CHECK^EXPIRY' },
    tal: 'IF CARD^EXP^DATE < CURRENT^DATE THEN\n  CALL DECLINE^TRANSACTION(RESP^CODE := "54")',
    java: 'if (card.getExpiryDate().isBefore(LocalDate.now()))\n  return declineTransaction("54");',
    desc: 'Checks card expiry. Declines code 54.',
    deps: ['R003'], trig: ['R006'] },
  { id: 'R006', name: 'Velocity Limit', dom: 'Fraud', crit: 'HIGH', type: 'code',
    src: { f: 'FRAUDCHK.TAL', l: '201–267', r: 'CHECK^VELOCITY' },
    tal: 'IF TXN^COUNT^24HR > VELOCITY^LIMIT THEN\n  CALL FLAG^SUSPICIOUS("HIGH")\n  CALL ROUTE^TO^MANUAL^REVIEW',
    java: 'if (txnCount24Hr > velocityLimit) {\n  flagSuspicious(AlertLevel.HIGH);\n  return routeToManualReview(ctx);\n}',
    desc: '24-hour velocity check. Routes to manual review if exceeded.',
    deps: ['R004', 'R005'], trig: ['R008', 'R009'] },
  { id: 'R007', name: 'Geo-Location Risk', dom: 'Fraud', crit: 'MEDIUM', type: 'code',
    src: { f: 'FRAUDCHK.TAL', l: '310–358', r: 'CALC^GEO^RISK' },
    tal: 'CALL CALC^DISTANCE(LAST^LOC, CURR^LOC)\nIF DISTANCE > IMPOSSIBLE^TRAVEL THEN\n  GEO^RISK := GEO^RISK + 40',
    java: 'double dist = calcDistance(lastLoc, currLoc);\nif (dist > IMPOSSIBLE_TRAVEL_THRESHOLD)\n  geoRiskScore += 40;',
    desc: 'Impossible-travel detection. +40 risk score.',
    deps: ['R006'], trig: ['R009'] },
  { id: 'R008', name: 'Credit Limit Auth', dom: 'Credit', crit: 'HIGH', type: 'code',
    src: { f: 'CREDITAUTH.TAL', l: '88–145', r: 'AUTH^CREDIT^LIMIT' },
    tal: 'IF (BALANCE + TXN^AMT) > CREDIT^LIMIT THEN\n  IF OVERLIMIT^OK = "Y" THEN\n    CALL APPLY^OVERLIMIT^FEE\n  ELSE CALL DECLINE("51")',
    java: 'BigDecimal projected = balance.add(txnAmt);\nif (projected.compareTo(creditLimit) > 0) {\n  if (acct.isOverlimitAllowed()) applyOverlimitFee(acct);\n  else return decline("51");\n}',
    desc: 'Checks projected balance vs credit limit.',
    deps: ['R006'], trig: ['R010', 'R011'] },
  { id: 'R009', name: 'Composite Risk Score', dom: 'Fraud', crit: 'HIGH', type: 'code',
    src: { f: 'FRAUDCHK.TAL', l: '400–460', r: 'COMPOSITE^RISK' },
    tal: 'RISK := VEL^SCORE + GEO^SCORE + MCC^SCORE\nIF RISK > BLOCK^THRESHOLD THEN\n  CALL HARD^DECLINE("59")',
    java: 'int risk = velScore + geoScore + mccScore;\nif (risk > BLOCK_THRESHOLD) return hardDecline("59");',
    desc: 'Aggregates risk scores. Hard-declines above threshold.',
    deps: ['R006', 'R007'], trig: ['R012'] },
  { id: 'R010', name: 'Interchange Fee', dom: 'Pricing', crit: 'MEDIUM', type: 'code',
    src: { f: 'FEECALC.TAL', l: '55–90', r: 'CALC^INTERCHANGE' },
    tal: 'IF MCC^CODE IN REGULATED^LIST THEN\n  FEE := TXN^AMT * REG^RATE\nELSE FEE := TXN^AMT * STD^RATE',
    java: 'BigDecimal rate = regulatedMccs.contains(mcc) ? REG_RATE : STD_RATE;\nBigDecimal fee = txnAmt.multiply(rate);',
    desc: 'Interchange fee based on MCC and Durbin tiers.',
    deps: ['R008'], trig: ['R012'] },
  { id: 'R011', name: 'FX Margin Calc', dom: 'Pricing', crit: 'MEDIUM', type: 'code',
    src: { f: 'FEECALC.TAL', l: '95–130', r: 'CALC^FX^MARGIN' },
    tal: 'IF CROSS^BORDER = "Y" THEN\n  FX^FEE := TXN^AMT * FX^RATE',
    java: 'if (isCrossBorder) {\n  BigDecimal fxFee = txnAmt.multiply(fxRate);\n  totalFee = baseFee.add(fxFee);\n}',
    desc: 'FX margin on cross-border transactions.',
    deps: ['R008'], trig: ['R012'] },
  { id: 'R012', name: 'AML/CTR Screening', dom: 'Compliance', crit: 'HIGH', type: 'document',
    src: { f: 'AML-Policy-v4.2.pdf', l: '§3.1–§3.4', r: 'N/A (Policy)' },
    tal: '-- Document Rule --\nIF TXN^AMOUNT > $10,000 THEN CALL FILE^CTR\nIF WATCHLIST^MATCH THEN CALL BLOCK^ESCALATE',
    java: 'if (txnAmt.compareTo(CTR_THRESHOLD)>0) fileCtrReport(txn);\nif (watchlistMatch) blockAndEscalate(txn);',
    desc: 'BSA/AML: CTR for >$10K; blocks watchlist matches.',
    deps: ['R009', 'R010', 'R011'], trig: ['R013'] },
  { id: 'R013', name: 'Auth Response Build', dom: 'Authorization', crit: 'HIGH', type: 'code',
    src: { f: 'AUTHRESP.TAL', l: '10–55', r: 'BUILD^AUTH^RESP' },
    tal: 'RESP^MSG.CODE := AUTH^RESULT^CODE\nRESP^MSG.AUTH^ID := GENERATE^AUTH^ID\nCALL SEND^RESPONSE(RESP^MSG)',
    java: 'AuthResponse resp = AuthResponse.builder()\n  .code(authResultCode).authId(generateAuthId())\n  .balance(availBalance).build();\nreturn sendResponse(resp);',
    desc: 'Assembles final ISO 8583 auth response.',
    deps: ['R012'], trig: [] },
];

export const DOMS = [...new Set(RULES.map((r) => r.dom))];
export const EDGES = RULES.flatMap((r) => r.trig.map((t) => ({ from: r.id, to: t })));

export const DOM_COLORS = {
  Validation: '#64748b',
  Authorization: '#2563eb',
  Fraud: '#dc2626',
  Credit: '#d97706',
  Pricing: '#059669',
  Compliance: '#7c3aed',
};

export const CRIT_COLORS = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#059669' };

export const getPath = (rule) => {
  if (!rule) return [];
  const s = new Set([rule.id]);
  const up = (id) => {
    RULES.find((x) => x.id === id)?.deps.forEach((d) => { s.add(d); up(d); });
  };
  const dn = (id) => {
    RULES.find((x) => x.id === id)?.trig.forEach((t) => { s.add(t); dn(t); });
  };
  up(rule.id);
  dn(rule.id);
  return [...s];
};
