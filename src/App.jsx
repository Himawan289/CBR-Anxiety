import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/* =========================
   DATA: Diseases & Symptoms
   (Bobot sesuai tabel paper)
   ========================= */
const DISEASES = [
  { code: "P1", name: "Generalized Anxiety Disorder (GAD)" },
  { code: "P2", name: "Panic Disorder" },
  { code: "P3", name: "Specific Phobias" },
];

const SYMPTOMS = [
  { code: "G01", name: "Nyeri otot", weights: { P1: 1 } },
  { code: "G02", name: "Kesulitan tidur", weights: { P1: 2 } },
  { code: "G03", name: "Mudah merasa lelah", weights: { P1: 1 } },
  { code: "G04", name: "Mual", weights: { P1: 1, P2: 1, P3: 1 } },
  { code: "G05", name: "Sakit kepala", weights: { P1: 1, P2: 1, P3: 1 } },
  { code: "G06", name: "Kecemasan berlebih", weights: { P1: 1, P2: 1 } },
  { code: "G07", name: "Merasa gelisah", weights: { P1: 1, P3: 1 } },
  { code: "G08", name: "Sulit berkonsentrasi", weights: { P1: 2 } },
  { code: "G09", name: "Kewaspadaan yang berlebihan", weights: { P1: 1 } },
  { code: "G10", name: "Mudah marah", weights: { P1: 1 } },
  { code: "G11", name: "Kebutuhan untuk kontrol", weights: { P1: 2 } },
  { code: "G12", name: "Jantung berdebar", weights: { P2: 2 } },
  { code: "G13", name: "Keringat berlebih", weights: { P2: 2 } },
  { code: "G14", name: "Gemetar tidak terkendali", weights: { P2: 1, P3: 1 } },
  { code: "G15", name: "Sesak napas", weights: { P2: 1, P3: 1 } },
  { code: "G16", name: "Nyeri dada", weights: { P2: 1 } },
  { code: "G17", name: "Kesemutan", weights: { P2: 1 } },
  { code: "G18", name: "Menggigil", weights: { P2: 2 } },
  { code: "G19", name: "Merasa kehilangan kendali", weights: { P2: 2 } },
  {
    code: "G20",
    name: "Menghindari tempat/situasi (serangan sebelumnya)",
    weights: { P2: 4 },
  },
  {
    code: "G21",
    name: "Menghindari situasi yang diasosiasikan dgn serangan panik",
    weights: { P2: 4 },
  },
  { code: "G22", name: "Menghindari tempat ramai", weights: { P2: 3 } },
  { code: "G23", name: "Ketakutan intens", weights: { P3: 3 } },
  { code: "G24", name: "Sensasi tersendak", weights: { P3: 3 } },
  { code: "G25", name: "Kehilangan kekuatan otot", weights: { P3: 2 } },
  {
    code: "G26",
    name: "Langkah besar menghindari objek/situasi ditakuti",
    weights: { P3: 4 },
  },
  { code: "G27", name: "Berbagai cara agar merasa aman", weights: { P3: 3 } },
];

const STORAGE_KEY = "cbr_newcases_v_final";

/* helper: find symptom data */
const getSymptom = (code) => SYMPTOMS.find((s) => s.code === code) || null;

/* precompute total weights per disease from table (denominator) */
function computeTotalWeightsPerDisease() {
  const totals = { P1: 0, P2: 0, P3: 0 };
  for (const s of SYMPTOMS) {
    for (const d of Object.keys(totals)) {
      const w = s.weights?.[d] || 0;
      totals[d] += w;
    }
  }
  return totals;
}

/* formatting */
function fmtPct(x, digits = 4) {
  if (typeof x !== "number" || isNaN(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}

/* compute similarity per disease between selected (new case) and disease table
   Numerator: sum weights of selected symptoms that belong to disease d.
   Denominator: total weights of disease d (precomputed).
*/
function computeSimilarityPerDisease(selectedSet, totalsDenom) {
  const numerators = { P1: 0, P2: 0, P3: 0 };
  for (const code of selectedSet) {
    const s = getSymptom(code);
    if (!s) continue;
    for (const d of Object.keys(numerators)) {
      const w = s.weights?.[d] || 0;
      numerators[d] += w;
    }
  }
  const results = {};
  for (const d of Object.keys(numerators)) {
    const denom = totalsDenom[d] || 1;
    const ratio = denom === 0 ? 0 : numerators[d] / denom;
    results[d] = { matched: numerators[d], total: denom, ratio };
  }
  return results;
}

/* compute similarity between new-case selectedSet and a stored case (sourceCase),
   using the disease label of sourceCase (sourceCase.result).
   Numerator: sum weights_{d_src} of intersection(new, sourceCase.symptoms)
   Denominator: total weights of disease d_src (totalsDenom[d_src])
*/
function computeCaseToCaseSimilarity(selectedSet, sourceCase) {
  // sourceCase.weights must exist (mapping gejala -> weight for that case)
  const dsrc = sourceCase.result || null;
  const weights = sourceCase.weights || {}; // prefer stored per-case weights

  // intersection
  const intersection = [...selectedSet].filter((g) =>
    sourceCase.symptoms.includes(g)
  );

  // sum using sourceCase.weights (fallback to SYMPTOMS table weight for dsrc if not present)
  let matched = 0;
  for (const g of intersection) {
    // prefer case.weights
    const w_case = typeof weights[g] === "number" ? weights[g] : null;
    if (w_case !== null) {
      matched += w_case;
      continue;
    }
    // fallback: use SYMPTOMS weight for sourceCase.result disease
    const s = getSymptom(g);
    const w = s?.weights?.[dsrc] || 0;
    matched += w;
  }

  // denominator: total weight of sourceCase (sum of sourceCase.weights if exists)
  let total = 0;
  if (Object.keys(weights).length > 0) {
    total = Object.values(weights).reduce((a, b) => a + b, 0);
  } else {
    // fallback: sum of SYMPTOMS weights for disease dsrc across sourceCase.symptoms
    for (const g of sourceCase.symptoms) {
      const s = getSymptom(g);
      total += s?.weights?.[dsrc] || 0;
    }
  }

  const ratio = total === 0 ? 0 : matched / total;
  return { matched, total, ratio, dsrc };
}

/* generate CASE-00X id based on existing count */
function formatCaseId(count) {
  const n = count + 1; // next index
  return `CASE-${String(n).padStart(3, "0")}`;
}

/* =========================
   React Component
   ========================= */
export default function App() {
  const [selected, setSelected] = useState(new Set());
  const [cases, setCases] = useState([]); // stored new cases (history)
  const [expandedCaseId, setExpandedCaseId] = useState(null);

  // load stored cases
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCases(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  // totals denom precomputed
  const totalsDenom = useMemo(() => computeTotalWeightsPerDisease(), []);

  // live disease similarity
  const liveSimilarity = useMemo(() => {
    return computeSimilarityPerDisease(selected, totalsDenom);
  }, [selected, totalsDenom]);

  // predicted disease (highest ratio, tie-breaker highest matched)
  const predicted = useMemo(() => {
    const arr = Object.entries(liveSimilarity).map(([code, v]) => ({
      code,
      ...v,
    }));
    arr.sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return b.matched - a.matched;
    });
    return arr[0] || null;
  }, [liveSimilarity]);

  const toggleSymptom = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const reset = () => {
    setSelected(new Set());
    setExpandedCaseId(null);
  };

  const retain = () => {
    // prepare id incremental
    const id = formatCaseId(cases.length);
    const createdAt = new Date().toISOString();

    // compute disease scores (use liveSimilarity)
    const scores = {
      P1: liveSimilarity.P1.ratio,
      P2: liveSimilarity.P2.ratio,
      P3: liveSimilarity.P3.ratio,
    };

    // assigned disease (predicted); if tie or none, assigned null
    const assigned = predicted?.code || null;

    // build comparisons:
    // first comparison entry = aggregate vs diseases (this is one row)
    const comparisons = [];
    comparisons.push({
      type: "diseases",
      label: "vs diseases (P1,P2,P3)",
      values: {
        P1: {
          matched: liveSimilarity.P1.matched,
          total: liveSimilarity.P1.total,
          ratio: liveSimilarity.P1.ratio,
        },
        P2: {
          matched: liveSimilarity.P2.matched,
          total: liveSimilarity.P2.total,
          ratio: liveSimilarity.P2.ratio,
        },
        P3: {
          matched: liveSimilarity.P3.matched,
          total: liveSimilarity.P3.total,
          ratio: liveSimilarity.P3.ratio,
        },
      },
    });

    // second: comparisons to each existing retained case (case→case) using source case's assigned disease
    for (const src of cases) {
      const sim = computeCaseToCaseSimilarity(selected, src, totalsDenom);
      comparisons.push({
        type: "case",
        label: `vs ${src.id} (base:${src.result || "-"})`,
        srcId: src.id,
        matched: sim.matched,
        total: sim.total,
        ratio: sim.ratio,
        dsrc: sim.dsrc || src.result || null,
      });
    }

    // payload to save
    const payload = {
      id,
      createdAt,
      symptoms: Array.from(selected),
      result: assigned,
      scores,
      comparisons, // store the comparisons snapshot at the time of retain
    };

    const next = [payload, ...cases];
    setCases(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // ignore
    }

    // keep selection as-is OR clear? We keep selected so user sees it — they can reset manually
  };

  const reuse = (c) => {
    setSelected(new Set(c.symptoms));
  };

  const removeCase = (id) => {
    const next = cases.filter((r) => r.id !== id);
    setCases(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // ignore
    }
  };

  const diseaseName = (code) =>
    DISEASES.find((d) => d.code === code)?.name || code;

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <h1>CBR — New-case (paper-flow)</h1>
          <div className="muted">
            Similarity = Σ bobot(gejala terpilih & termasuk penyakit) / Σ
            bobot(semua gejala penyakit).
            <br />
            Saat retain: case→case membandingkan new-case ke retained-case
            menggunakan bobot penyakit source-case.
          </div>
        </div>

        <div className="top-actions">
          <button className="btn" onClick={reset}>
            Reset
          </button>
          <button
            className="btn btn--primary"
            onClick={retain}
            disabled={selected.size === 0}
          >
            Retain: Simpan Kasus
          </button>
        </div>
      </header>

      <main className="grid">
        {/* LEFT */}
        <section className="panel left">
          <h2>Gejala (pilih untuk kasus baru)</h2>
          <ul className="symptom-list">
            {SYMPTOMS.map((s) => (
              <li key={s.code} className="symptom-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(s.code)}
                    onChange={() => toggleSymptom(s.code)}
                  />
                  <div className="symptom-meta">
                    <div className="symptom-code">
                      <strong>{s.code}</strong> —{" "}
                      <span className="symptom-name">{s.name}</span>
                    </div>
                    <div className="symptom-chips muted">
                      {["P1", "P2", "P3"]
                        .filter((d) => (s.weights?.[d] || 0) > 0)
                        .map((d) => `${d}:w${s.weights[d]}`)
                        .join(" • ")}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* MID */}
        <section className="panel mid">
          <h2>Hasil Similarity (kasus baru sekarang)</h2>

          <div className="live-cards">
            {Object.entries(liveSimilarity).map(([code, v]) => (
              <div
                key={code}
                className={`live-card ${
                  predicted?.code === code ? "live-card--top" : ""
                }`}
              >
                <div className="live-left">
                  <div className="disease-title">{diseaseName(code)}</div>
                  <div className="muted small">
                    matched: {v.matched} / total: {v.total}
                  </div>
                </div>
                <div className="live-right">
                  <div className="score">{fmtPct(v.ratio, 4)}</div>
                </div>
                <div className="progress small">
                  <div
                    className="bar"
                    style={{ width: `${Math.min(100, v.ratio * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="callout">
            <div className="callout-left">
              <div className="muted">Diagnosis otomatis</div>
              <div className="callout-title">
                {predicted ? diseaseName(predicted.code) : "—"}
              </div>
            </div>
            <div className="callout-right">
              <div className="callout-score">
                {predicted ? fmtPct(predicted.ratio, 4) : "-"}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <section className="panel right">
          <h2>Case Base — Kasus tersimpan</h2>
          <p className="muted">
            Setiap kali tekan "Retain", kasus baru disimpan di sini (history).
            Klik "Reuse" untuk memuat gejala kasus tersimpan ke panel kiri.
          </p>

          {cases.length === 0 ? (
            <p className="muted">Belum ada kasus tersimpan.</p>
          ) : (
            <ul className="case-list">
              {cases.map((c, idx) => (
                <li key={c.id} className="case-row">
                  <div className="case-row-top">
                    <div>
                      <b>{c.id}</b> •{" "}
                      <span className="muted small">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="case-actions">
                      <button className="btn btn-sm" onClick={() => reuse(c)}>
                        Reuse
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => removeCase(c.id)}
                      >
                        Hapus
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          setExpandedCaseId(
                            expandedCaseId === c.id ? null : c.id
                          )
                        }
                      >
                        {expandedCaseId === c.id ? "Collapse" : "Details"}
                      </button>
                    </div>
                  </div>

                  <div className="muted small">
                    Assigned: {c.result ? diseaseName(c.result) : "-"}
                  </div>
                  <div className="muted small">
                    Scores — P1: {fmtPct(c.scores.P1)} • P2:{" "}
                    {fmtPct(c.scores.P2)} • P3: {fmtPct(c.scores.P3)}
                  </div>
                  <div className="muted small">
                    Gejala: {c.symptoms.join(", ") || "-"}
                  </div>

                  {expandedCaseId === c.id && (
                    <div className="case-comparisons">
                      <div className="muted small">Comparisons snapshot:</div>
                      <ul>
                        {c.comparisons.map((cmp, i) => (
                          <li key={i} className="muted">
                            {cmp.type === "diseases" ? (
                              <div>
                                vs diseases — P1: {fmtPct(cmp.values.P1.ratio)}{" "}
                                ({cmp.values.P1.matched}/{cmp.values.P1.total})
                                • P2: {fmtPct(cmp.values.P2.ratio)} (
                                {cmp.values.P2.matched}/{cmp.values.P2.total}) •
                                P3: {fmtPct(cmp.values.P3.ratio)} (
                                {cmp.values.P3.matched}/{cmp.values.P3.total})
                              </div>
                            ) : (
                              <div>
                                {cmp.label} — {fmtPct(cmp.ratio)} ({cmp.matched}
                                /{cmp.total}) base:{cmp.dsrc || "-"}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* bottom summary table */}
      <section className="panel bottom">
        <h2>
          Summary Table — Semua Kasus & Perbandingan (snapshot saat retain)
        </h2>
        <div className="table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Waktu</th>
                <th>Comparison</th>
                <th>Detail</th>
                <th>Ratio</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan="5" className="muted">
                    Belum ada kasus tersimpan.
                  </td>
                </tr>
              ) : (
                cases.flatMap((c) =>
                  c.comparisons.map((cmp, i) => (
                    <tr key={c.id + "-" + i}>
                      <td>{c.id}</td>
                      <td>{new Date(c.createdAt).toLocaleString()}</td>
                      <td>
                        {cmp.type === "diseases"
                          ? "vs diseases (P1,P2,P3)"
                          : cmp.label}
                      </td>
                      <td style={{ minWidth: 240 }}>
                        {cmp.type === "diseases"
                          ? `P1: ${fmtPct(cmp.values.P1.ratio)} (${
                              cmp.values.P1.matched
                            }/${cmp.values.P1.total}); P2: ${fmtPct(
                              cmp.values.P2.ratio
                            )} (${cmp.values.P2.matched}/${
                              cmp.values.P2.total
                            }); P3: ${fmtPct(cmp.values.P3.ratio)} (${
                              cmp.values.P3.matched
                            }/${cmp.values.P3.total})`
                          : `${cmp.matched}/${cmp.total} (base:${
                              cmp.dsrc || "-"
                            })`}
                      </td>
                      <td>
                        {cmp.type === "diseases"
                          ? `P1:${fmtPct(cmp.values.P1.ratio)} • P2:${fmtPct(
                              cmp.values.P2.ratio
                            )} • P3:${fmtPct(cmp.values.P3.ratio)}`
                          : fmtPct(cmp.ratio)}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} CBR — New-case training (paper logic)
      </footer>
    </div>
  );
}
