/**
 * Multivariate Soil Moisture Memory Forecast Engine
 * Implements 3-Week Lagged Rainfall Multiple Linear Regression (OLS)
 * Equation: ΔTMAT_t = a + b0*CH_t + b1*CH_{t-1} + b2*CH_{t-2}
 */

import { CLASS_ORDER, classifyTMAT, sumValues, mean } from './forecastEngine.js';

export function solveOLS4(X, Y) {
  // X: array of [1, x0, x1, x2]
  // Y: array of y
  const n = X.length;
  if (n < 8) return null; // Need sufficient degrees of freedom

  const XTX = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const XTY = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const row = X[i];
    const y = Y[i];
    for (let r = 0; r < 4; r++) {
      XTY[r] += row[r] * y;
      for (let c = 0; c < 4; c++) {
        XTX[r][c] += row[r] * row[c];
      }
    }
  }

  // Small Ridge Regularization (λ = 0.01) on diagonal to ensure positive definiteness
  for (let i = 0; i < 4; i++) {
    XTX[i][i] += 0.01;
  }

  // Gauss-Jordan Inversion
  const A = XTX.map((row, i) => [
    ...row,
    i === 0 ? 1 : 0,
    i === 1 ? 1 : 0,
    i === 2 ? 1 : 0,
    i === 3 ? 1 : 0
  ]);

  for (let i = 0; i < 4; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 4; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    const temp = A[i];
    A[i] = A[maxRow];
    A[maxRow] = temp;

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) return null;

    for (let j = 0; j < 8; j++) A[i][j] /= pivot;

    for (let k = 0; k < 4; k++) {
      if (k === i) continue;
      const factor = A[k][i];
      for (let j = 0; j < 8; j++) {
        A[k][j] -= factor * A[i][j];
      }
    }
  }

  const beta = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      beta[i] += A[i][j + 4] * XTY[j];
    }
  }

  // Physical hydrological constraints:
  // Rainfall should not decrease ground water level (b <= 0)
  // Clamp b0, b1, b2 to non-positive values to prevent noise artifacts
  let a = beta[0];
  let b0 = Math.min(0, beta[1]);
  let b1 = Math.min(0, beta[2]);
  let b2 = Math.min(0, beta[3]);

  // Compute goodness of fit metrics
  const yMean = Y.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0, ssRes = 0, sumAbsErr = 0;
  for (let i = 0; i < n; i++) {
    const yHat = a + b0 * X[i][1] + b1 * X[i][2] + b2 * X[i][3];
    ssTot += Math.pow(Y[i] - yMean, 2);
    ssRes += Math.pow(Y[i] - yHat, 2);
    sumAbsErr += Math.abs(Y[i] - yHat);
  }

  const r2 = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
  const mae = sumAbsErr / n;

  return { a, b0, b1, b2, r2, mae, n };
}

/**
 * Train 3-lag OLS models for each estate, company, and overall group
 */
export function trainLaggedModels(weeksChronological, tmatRecords, rainRecords) {
  // 1. Structure data: tmatMap[estCode][week] and rainMap[estCode][week]
  const estateTmatMap = {};
  const companyTmatMap = {};
  const estateToCompany = {};

  tmatRecords.forEach(r => {
    const est = r.est_code;
    const comp = r.company_code;
    estateToCompany[est] = comp;

    if (!estateTmatMap[est]) estateTmatMap[est] = {};
    estateTmatMap[est][r.month_name] = parseFloat(r.avg_tmat);

    if (!companyTmatMap[comp]) companyTmatMap[comp] = {};
    if (!companyTmatMap[comp][r.month_name]) companyTmatMap[comp][r.month_name] = [];
    companyTmatMap[comp][r.month_name].push(parseFloat(r.avg_tmat));
  });

  const estateRainMap = {};
  const companyRainMap = {};

  rainRecords.forEach(r => {
    const est = r.est_code;
    const comp = r.company_code;

    if (!estateRainMap[est]) estateRainMap[est] = {};
    estateRainMap[est][r.week] = parseFloat(r.total_rain);

    if (!companyRainMap[comp]) companyRainMap[comp] = {};
    if (!companyRainMap[comp][r.week]) companyRainMap[comp][r.week] = [];
    companyRainMap[comp][r.week].push(parseFloat(r.total_rain));
  });

  // Average company rain & tmat
  const avgCompanyTmat = {};
  Object.keys(companyTmatMap).forEach(comp => {
    avgCompanyTmat[comp] = {};
    Object.keys(companyTmatMap[comp]).forEach(w => {
      avgCompanyTmat[comp][w] = mean(companyTmatMap[comp][w]);
    });
  });

  const avgCompanyRain = {};
  Object.keys(companyRainMap).forEach(comp => {
    avgCompanyRain[comp] = {};
    Object.keys(companyRainMap[comp]).forEach(w => {
      avgCompanyRain[comp][w] = mean(companyRainMap[comp][w]);
    });
  });

  // Train Estate Models
  const estateModels = {};
  const estates = Object.keys(estateTmatMap);

  estates.forEach(est => {
    const tData = estateTmatMap[est] || {};
    const rData = estateRainMap[est] || {};
    const X = [], Y = [];

    for (let i = 2; i < weeksChronological.length; i++) {
      const w0 = weeksChronological[i];     // current week
      const w1 = weeksChronological[i - 1]; // lag 1
      const w2 = weeksChronological[i - 2]; // lag 2

      const t0 = tData[w0], t1 = tData[w1];
      const r0 = rData[w0], r1 = rData[w1], r2 = rData[w2];

      if (Number.isFinite(t0) && Number.isFinite(t1) &&
          Number.isFinite(r0) && Number.isFinite(r1) && Number.isFinite(r2)) {
        const delta = t0 - t1;
        if (Math.abs(delta) <= 50) {
          X.push([1, r0, r1, r2]);
          Y.push(delta);
        }
      }
    }

    const fit = solveOLS4(X, Y);
    if (fit && fit.n >= 10 && fit.r2 >= 0.10) {
      estateModels[est] = { ...fit, method: 'estate-ols' };
    }
  });

  // Train Company Models (for fallback)
  const companyModels = {};
  const companies = Object.keys(avgCompanyTmat);

  companies.forEach(comp => {
    const tData = avgCompanyTmat[comp] || {};
    const rData = avgCompanyRain[comp] || {};
    const X = [], Y = [];

    for (let i = 2; i < weeksChronological.length; i++) {
      const w0 = weeksChronological[i];
      const w1 = weeksChronological[i - 1];
      const w2 = weeksChronological[i - 2];

      const t0 = tData[w0], t1 = tData[w1];
      const r0 = rData[w0], r1 = rData[w1], r2 = rData[w2];

      if (Number.isFinite(t0) && Number.isFinite(t1) &&
          Number.isFinite(r0) && Number.isFinite(r1) && Number.isFinite(r2)) {
        const delta = t0 - t1;
        if (Math.abs(delta) <= 50) {
          X.push([1, r0, r1, r2]);
          Y.push(delta);
        }
      }
    }

    const fit = solveOLS4(X, Y);
    if (fit && fit.n >= 10) {
      companyModels[comp] = { ...fit, method: 'company-ols' };
    }
  });

  // Group / National Default Model
  const validEstateModels = Object.values(estateModels);
  const groupModel = {
    a: validEstateModels.length > 0 ? mean(validEstateModels.map(m => m.a)) : 4.5,
    b0: validEstateModels.length > 0 ? mean(validEstateModels.map(m => m.b0)) : -0.05,
    b1: validEstateModels.length > 0 ? mean(validEstateModels.map(m => m.b1)) : -0.08,
    b2: validEstateModels.length > 0 ? mean(validEstateModels.map(m => m.b2)) : -0.01,
    r2: validEstateModels.length > 0 ? mean(validEstateModels.map(m => m.r2)) : 0.40,
    mae: validEstateModels.length > 0 ? mean(validEstateModels.map(m => m.mae)) : 3.5,
    method: 'group-ols'
  };

  return {
    estateModels,
    companyModels,
    groupModel,
    estateRainMap,
    companyRainMap,
    estateToCompany
  };
}

/**
 * Predict next week TMAT distribution for a company given scenarios & antecedent moisture
 */
export function predictCompanyScenarios({
  company,
  baselineRows,
  scenarios,
  models,
  weeksChronological,
  baselineWeek
}) {
  const { estateModels, companyModels, groupModel, estateRainMap, companyRainMap } = models;

  // Identify lag weeks relative to baselineWeek
  const bIdx = weeksChronological.indexOf(baselineWeek);
  const lag1Week = bIdx > 0 ? weeksChronological[bIdx - 1] : null;
  const lag2Week = bIdx > 1 ? weeksChronological[bIdx - 2] : null;

  // Baseline metrics
  const baselineCounts = {};
  CLASS_ORDER.forEach(c => baselineCounts[c] = 0);
  let baselineSumTmat = 0;
  let baselineTotal = 0;

  baselineRows.forEach(r => {
    const val = r.__TMAT_NUM__;
    if (Number.isFinite(val)) {
      baselineCounts[r.TMAT_Class]++;
      baselineSumTmat += val;
      baselineTotal++;
    }
  });

  const baselineAvgTMAT = baselineTotal > 0 ? baselineSumTmat / baselineTotal : 0;
  const baselinePct = {};
  CLASS_ORDER.forEach(c => {
    baselinePct[c] = baselineTotal > 0 ? (baselineCounts[c] / baselineTotal) * 100 : 0;
  });

  // Identify company-level models for summary
  const compModel = companyModels[company] || groupModel;

  // Collect estates in this company
  const companyEstates = [...new Set(baselineRows.map(r => r.est_code))];
  const estModelsUsed = companyEstates.map(est => {
    return estateModels[est] || companyModels[company] || groupModel;
  });

  const avgA = mean(estModelsUsed.map(m => m.a));
  const avgB0 = mean(estModelsUsed.map(m => m.b0));
  const avgB1 = mean(estModelsUsed.map(m => m.b1));
  const avgB2 = mean(estModelsUsed.map(m => m.b2));
  const avgR2 = mean(estModelsUsed.map(m => m.r2));
  const avgMae = mean(estModelsUsed.map(m => m.mae));

  // Determine actual antecedent rainfall (lag 1 and lag 2)
  const coRain = companyRainMap[company] || {};
  const antecedentRainCurrent = lag1Week ? (coRain[baselineWeek] || 0) : 0; // Rain during baseline week
  const antecedentRainLag1 = lag2Week ? (coRain[lag1Week] || 0) : 0;        // Rain week before baseline

  // Evaluate each scenario
  const scenarioResults = scenarios.map(scenarioMm => {
    const counts = {};
    CLASS_ORDER.forEach(c => counts[c] = 0);
    let sumNext = 0;
    let validCount = 0;

    baselineRows.forEach(row => {
      const est = row.est_code;
      const estModel = estateModels[est] || companyModels[company] || groupModel;

      // Estate-specific antecedent rain if available, else company
      const estRain = estateRainMap[est] || {};
      const ch1 = estRain[baselineWeek] !== undefined ? estRain[baselineWeek] : antecedentRainCurrent;
      const ch2 = lag1Week && estRain[lag1Week] !== undefined ? estRain[lag1Week] : antecedentRainLag1;

      // 3-Week Memory Forecast Formula:
      // ΔTMAT_next = a + b0 * scenarioMm + b1 * ch1 + b2 * ch2
      let dAvg = estModel.a + (estModel.b0 * scenarioMm) + (estModel.b1 * ch1) + (estModel.b2 * ch2);

      // Relative physical sanity check:
      // High rainfall cannot dry out the soil compared to zero rain
      const dAvgZero = estModel.a + (estModel.b1 * ch1) + (estModel.b2 * ch2);
      if (scenarioMm > 0 && dAvg > dAvgZero) {
        dAvg = dAvgZero;
      }

      const nextVal = row.__TMAT_NUM__ + dAvg;
      const nextCls = classifyTMAT(nextVal);

      counts[nextCls]++;
      sumNext += nextVal;
      validCount++;
    });

    const avgNext = validCount > 0 ? sumNext / validCount : baselineAvgTMAT;
    const pct = {};
    CLASS_ORDER.forEach(c => {
      pct[c] = validCount > 0 ? (counts[c] / validCount) * 100 : 0;
    });

    const basah = (counts["Tergenang (0-40)"] || 0) + (counts["A Tergenang (41-45)"] || 0) + (counts["Banjir (<0)"] || 0);
    const kering = (counts["A Kering (61-65)"] || 0) + (counts["Kering (>65)"] || 0);

    return {
      scenarioMm,
      avgNext,
      dAvg: avgNext - baselineAvgTMAT,
      counts,
      pct,
      summary: {
        "Basah <=45 Count": basah,
        "Basah <=45 %": validCount > 0 ? (basah / validCount) * 100 : 0,
        "Kering >60 Count": kering,
        "Kering >60 %": validCount > 0 ? (kering / validCount) * 100 : 0,
        Total: validCount
      }
    };
  });

  return {
    company,
    baselineWeek,
    totalPoints: baselineTotal,
    baselineAvgTmat: baselineAvgTMAT,
    baselineCounts,
    baselinePct,
    fit: {
      a: avgA,
      b0: avgB0,
      b1: avgB1,
      b2: avgB2,
      r2: avgR2,
      mae: avgMae,
      modelType: '3-week-memory-ols',
      validEstates: estModelsUsed.filter(m => m.method === 'estate-ols').length,
      totalEstates: companyEstates.length,
      antecedentRainCurrent,
      antecedentRainLag1
    },
    scenarios: scenarioResults
  };
}
