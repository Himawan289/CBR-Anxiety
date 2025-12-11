// App.js — Final version (fixed)
// CBR logic aligned with BAB 3.2 manual
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/* ---------------------------
   Master: diseases & symptoms
   --------------------------- */
const DISEASES = [
  { code: "P1", name: "Generalized Anxiety Disorder (GAD)" },
  { code: "P2", name: "Panic Disorder" },
  { code: "P3", name: "Specific Phobias" },
];

/* ---------------------------
   SYMPTOMS (accurate per paper)
   Each symptom explicitly lists weights for P1,P2,P3 (0 if not applicable)
   --------------------------- */
const SYMPTOMS = [
  { code: "G01", name: "Nyeri otot", weights: { P1: 1, P2: 0, P3: 0 } },
  { code: "G02", name: "Kesulitan tidur", weights: { P1: 2, P2: 0, P3: 0 } },
  { code: "G03", name: "Mudah merasa lelah", weights: { P1: 1, P2: 0, P3: 0 } },
  { code: "G04", name: "Mual", weights: { P1: 1, P2: 1, P3: 1 } },
  { code: "G05", name: "Sakit kepala", weights: { P1: 1, P2: 1, P3: 1 } },
  { code: "G06", name: "Kecemasan berlebih", weights: { P1: 1, P2: 1, P3: 0 } },
  { code: "G07", name: "Merasa gelisah", weights: { P1: 1, P2: 0, P3: 1 } },
  { code: "G08", name: "Sulit berkonsentrasi", weights: { P1: 2, P2: 0, P3: 0 } },
  { code: "G09", name: "Kewaspadaan berlebihan", weights: { P1: 1, P2: 0, P3: 0 } },
  { code: "G10", name: "Mudah marah", weights: { P1: 1, P2: 0, P3: 0 } },
  { code: "G11", name: "Kebutuhan kontrol", weights: { P1: 2, P2: 0, P3: 0 } },
  { code: "G12", name: "Jantung berdebar", weights: { P1: 0, P2: 2, P3: 0 } },
  { code: "G13", name: "Keringat berlebih", weights: { P1: 0, P2: 2, P3: 0 } },
  { code: "G14", name: "Gemetar tidak terkendali", weights: { P1: 0, P2: 1, P3: 1 } },
  { code: "G15", name: "Sesak napas", weights: { P1: 0, P2: 1, P3: 1 } },
  { code: "G16", name: "Nyeri dada", weights: { P1: 0, P2: 1, P3: 0 } },
  { code: "G17", name: "Kesemutan", weights: { P1: 0, P2: 1, P3: 0 } },
  { code: "G18", name: "Menggigil", weights: { P1: 0, P2: 2, P3: 0 } },
  { code: "G19", name: "Merasa kehilangan kendali", weights: { P1: 0, P2: 2, P3: 0 } },
  { code: "G20", name: "Menghindari situasi", weights: { P1: 0, P2: 4, P3: 0 } },
  { code: "G21", name: "Menghindari serangan panik", weights: { P1: 0, P2: 4, P3: 0 } },
  { code: "G22", name: "Menghindari keramaian", weights: { P1: 0, P2: 3, P3: 0 } },
  { code: "G23", name: "Ketakutan intens", weights: { P1: 0, P2: 0, P3: 3 } },
  { code: "G24", name: "Sensasi tersendak", weights: { P1: 0, P2: 0, P3: 3 } },
  { code: "G25", name: "Kehilangan kekuatan", weights: { P1: 0, P2: 0, P3: 2 } },
  { code: "G26", name: "Langkah menghindar", weights: { P1: 0, P2: 0, P3: 4 } },
  { code: "G27", name: "Upaya mencari aman", weights: { P1: 0, P2: 0, P3: 3 } },
];

const STORAGE_KEY = "cbr_manual_casebase_v1";

/* helper: find symptom object by code */
const getSymptom = (code) => SYMPTOMS.find((s) => s.code === code) || null;

/* formatting percent */
const fmtPct = (x, d = 4) =>
  typeof x !== "number" || isNaN(x) ? "-" : `${(x * 100).toFixed(d)}%`;

/* disease denominators (fixed per paper) */
const DENOM = { P1: 14, P2: 26, P3: 20 };

/* --------------------------
   Prepopulate CASE-001 (A) & CASE-002 (B) exactly as manual
   -------------------------- */
const PREPOPULATED = [
  {
    id: "CASE-001",
    createdAt: new Date().toISOString(),
    symptoms: ["G05", "G26", "G08", "G14", "G20", "G07", "G17", "G25", "G04", "G27"],
    result: "P3",
    weights: { G05: 1, G26: 4, G08: 2, G14: 1, G20: 4, G07: 1, G17: 1, G25: 2, G04: 1, G27: 3 },
    denom: 20,
    scores: { P1: 0.357142857, P2: 0.307692308, P3: 0.65 },
    comparisons: [],
  },
  {
    id: "CASE-002",
    createdAt: new Date().toISOString(),
    symptoms: ["G05", "G06", "G07", "G14", "G17", "G18", "G20", "G23", "G25", "G27"],
    result: "P3",
    weights: { G05: 1, G06: 1, G07: 1, G14: 1, G17: 1, G18: 2, G20: 4, G23: 3, G25: 2, G27: 3 },
    denom: 19,
    scores: { P1: 0.2142857, P2: 0.3461538, P3: 0.55 },
    comparisons: [],
  },
];

/* --------------------------
   compute live similarity: new-case vs P1/P2/P3 (BAB 3.2)
   Numerator = sum of master table weights for selected symptoms
   Denominator = fixed DENOM per disease
   -------------------------- */
function computeSimilarityPerDisease(selected) {
  const sel = Array.isArray(selected) ? selected : Array.from(selected || []);
  const numerators = { P1: 0, P2: 0, P3: 0 };

  for (const g of sel) {
    const s = getSymptom(g);
    if (!s) continue;
    numerators.P1 += s.weights?.P1 || 0;
    numerators.P2 += s.weights?.P2 || 0;
    numerators.P3 += s.weights?.P3 || 0;
  }

  return {
    P1: { matched: numerators.P1, total: DENOM.P1, ratio: DENOM.P1 === 0 ? 0 : numerators.P1 / DENOM.P1 },
    P2: { matched: numerators.P2, total: DENOM.P2, ratio: DENOM.P2 === 0 ? 0 : numerators.P2 / DENOM.P2 },
    P3: { matched: numerators.P3, total: DENOM.P3, ratio: DENOM.P3 === 0 ? 0 : numerators.P3 / DENOM.P3 },
  };
}

/* --------------------------
   compute similarity between new-case and a stored case (use stored case weights)
   Numerator = sum of sourceCase.weights for intersection(new, source)
   Denominator = sum of sourceCase.weights (sourceCase.denom)
   -------------------------- */
function computeCaseToCaseSimilarity(selected, sourceCase) {
  const sel = Array.isArray(selected) ? selected : Array.from(selected || []);
  if (!sourceCase || !sourceCase.weights) return { matched: 0, total: 0, ratio: 0, dsrc: sourceCase?.result || null, intersection: [] };

  const srcKeys = Object.keys(sourceCase.weights);
  const intersection = sel.filter((g) => srcKeys.includes(g));

  let matched = 0;
  const intersectionDetails = [];
  for (const g of intersection) {
    const w = sourceCase.weights[g] || 0;
    matched += w;
    intersectionDetails.push({ code: g, w });
  }

  const total = sourceCase.denom || Object.values(sourceCase.weights).reduce((a, b) => a + b, 0);
  const ratio = total === 0 ? 0 : matched / total;

  return { matched, total, ratio, dsrc: sourceCase.result || null, intersection: intersectionDetails };
}

/* helper ID generator */
function formatCaseId(count) {
  return `CASE-${String(count + 1).padStart(3, "0")}`;
}

/* --------------------------
   Helper: compute assigned class & ratio for a stored case
   - prefers snapshot c.scores if present
   - otherwise computes similarity using c.symptoms
   Returns: { code: "P1", ratio: 0.35 }
   -------------------------- */
function computeAssignedForCase(c) {
  // prefer stored snapshot scores if present
  if (c && c.scores && typeof c.scores === "object") {
    const entries = Object.entries(c.scores);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const [code, ratio] = entries[0];
      return { code, ratio };
    }
  }

  // fallback: compute similarity from symptoms
  if (c && Array.isArray(c.symptoms)) {
    const sim = computeSimilarityPerDisease(c.symptoms);
    const arr = [
      ["P1", sim.P1.ratio],
      ["P2", sim.P2.ratio],
      ["P3", sim.P3.ratio],
    ];
    arr.sort((a, b) => b[1] - a[1]);
    return { code: arr[0][0], ratio: arr[0][1] };
  }

  // final fallback: return stored result with 0 ratio
  return { code: c?.result || "-", ratio: 0 };
}

/* --------------------------
   React component
   -------------------------- */
export default function App() {
  const [selected, setSelected] = useState(new Set());
  const [cases, setCases] = useState([]);
  const [expandedCaseId, setExpandedCaseId] = useState(null);

  // load case base from localStorage or prepopulate if empty
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        // ensure prepopulated cases exist (don't duplicate)
        const map = {};
        for (const c of loaded) map[c.id] = c;
        for (const p of PREPOPULATED) {
          if (!map[p.id]) map[p.id] = p;
        }
        const merged = Object.values(map);
        setCases(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        setCases(PREPOPULATED);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(PREPOPULATED));
      }
    } catch (e) {
      setCases(PREPOPULATED);
    }
  }, []);

  // live similarity (for currently selected symptoms)
  const liveSim = useMemo(() => computeSimilarityPerDisease(selected), [selected]);

  // case->case similarities (for debug / candidate list)
  const caseSims = useMemo(() => cases.map((c) => ({ id: c.id, ...computeCaseToCaseSimilarity(selected, c), result: c.result })), [selected, cases]);

  // Determine prediction: choose highest ratio among:
  // - liveSim.P1 / P2 / P3 (type: 'live')
  // - each case comparison (type: 'case' using case ratio)
  const predicted = useMemo(() => {
    const candidates = [];

    for (const d of ["P1", "P2", "P3"]) {
      const v = liveSim[d];
      candidates.push({ type: "live", code: d, ratio: v.ratio, matched: v.matched, total: v.total });
    }
    for (const c of cases) {
      const sim = computeCaseToCaseSimilarity(selected, c);
      candidates.push({ type: "case", code: c.result, ratio: sim.ratio, matched: sim.matched, total: sim.total, srcId: c.id });
    }

    // pick best by ratio, tie-breaker by matched then prefer case over live if tie
    candidates.sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      if ((b.matched || 0) !== (a.matched || 0)) return (b.matched || 0) - (a.matched || 0);
      if (a.type === "case" && b.type === "live") return -1;
      if (a.type === "live" && b.type === "case") return 1;
      return 0;
    });

    return candidates[0] || null;
  }, [liveSim, cases, selected]);

  /* UI actions */
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

  /* Retain: save new case with weights based on predicted disease (as in manual)
     This ensures future case-to-case comparisons use per-case weights consistent with manual.
  */
  const retain = () => {
    const id = formatCaseId(cases.length);
    const createdAt = new Date().toISOString();

    // Determine disease code to use for assigning per-case weights
    const predictedDisease = predicted?.code || null;

    // build per-case weights from master table for the predicted disease
    const weights = {};
    for (const g of selected) {
      const s = getSymptom(g);
      const w = s ? (predictedDisease ? (s.weights?.[predictedDisease] || 0) : 0) : 0;
      weights[g] = w;
    }
    const denom = Object.values(weights).reduce((a, b) => a + b, 0);

    // snapshot scores & comparisons
    const scores = { P1: liveSim.P1.ratio, P2: liveSim.P2.ratio, P3: liveSim.P3.ratio };

    const comparisons = [];
    comparisons.push({
      type: "diseases",
      label: "vs diseases (P1,P2,P3)",
      values: {
        P1: { matched: liveSim.P1.matched, total: liveSim.P1.total, ratio: liveSim.P1.ratio },
        P2: { matched: liveSim.P2.matched, total: liveSim.P2.total, ratio: liveSim.P2.ratio },
        P3: { matched: liveSim.P3.matched, total: liveSim.P3.total, ratio: liveSim.P3.ratio },
      },
    });
    for (const src of cases) {
      const s = computeCaseToCaseSimilarity(selected, src);
      comparisons.push({
        type: "case",
        label: `vs ${src.id} (base:${src.result || "-"})`,
        srcId: src.id,
        matched: s.matched,
        total: s.total,
        ratio: s.ratio,
        dsrc: s.dsrc || src.result || null,
      });
    }

    const payload = {
      id,
      createdAt,
      symptoms: Array.from(selected),
      result: predicted?.code || null,
      scores,
      comparisons,
      weights,
      denom,
    };

    const next = [payload, ...cases];
    setCases(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // ignore storage failures
    }
  };

  const reuse = (c) => {
    setSelected(new Set(c.symptoms || []));
  };

  const removeCase = (id) => {
    const next = cases.filter((r) => r.id !== id);
    setCases(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {}
  };

  const diseaseName = (code) => DISEASES.find((d) => d.code === code)?.name || code;

  /* Render */
  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <h1>Case Based Reasoning</h1>
        </div>

        <div className="top-actions">
          <button className="btn" onClick={reset}>Reset</button>
          <button className="btn btn--primary" onClick={retain} disabled={selected.size === 0}>Retain: Simpan Kasus</button>
        </div>
      </header>

      <main className="grid">
        {/* LEFT: symptoms */}
        <section className="panel left">
          <h2>Gejala (pilih untuk kasus baru)</h2>
          <ul className="symptom-list">
            {SYMPTOMS.map((s) => (
              <li key={s.code} className="symptom-item">
                <label>
                  <input type="checkbox" checked={selected.has(s.code)} onChange={() => toggleSymptom(s.code)} />
                  <div className="symptom-meta">
                    <div className="symptom-code"><strong>{s.code}</strong> — <span className="symptom-name">{s.name}</span></div>
                    <div className="symptom-chips muted">{["P1","P2","P3"].map(d => `${d}:w${s.weights[d]}`).join(" • ")}</div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* MID: live similarity + predicted */}
        <section className="panel mid">
          <h2>Hasil Similarity (kasus baru sekarang)</h2>

          <div className="live-cards">
            {Object.entries(liveSim).map(([code, v]) => (
              <div key={code} className={`live-card ${predicted?.type === "live" && predicted.code === code ? "live-card--top" : ""}`}>
                <div className="live-left">
                  <div className="disease-title">{diseaseName(code)}</div>
                  <div className="muted small">matched: {v.matched} / total: {v.total}</div>
                </div>
                <div className="live-right"><div className="score">{fmtPct(v.ratio)}</div></div>
                <div className="progress small"><div className="bar" style={{ width: `${Math.min(100, v.ratio * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: case base */}
        <section className="panel right">
          <h2>Case Base — Kasus tersimpan</h2>
          <p className="muted">Prepopulated CASE-001 (Kasus A) and CASE-002 (Kasus B) come from manual. New retained cases appended on top.</p>

          {/* === TOMBOL CLEAR CASE BASE (baru dan sudah benar) === */}
          <button
            className="btn btn--danger"
            style={{ marginBottom: 10 }}
            onClick={() => {
              if (window.confirm("Yakin ingin menghapus seluruh case base?")) {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }
            }}
          >
            Clear Case Base
          </button>
          {/* ==================================================== */}

          {cases.length === 0 ? (
            <p className="muted">Belum ada kasus tersimpan.</p>
          ) : (
            <ul className="case-list">
              {cases.map((c) => {
                // compute assigned for display
                const assignedInfo = computeAssignedForCase(c);
                const assignedLabel = `${assignedInfo.code} — ${diseaseName(assignedInfo.code)} (${fmtPct(assignedInfo.ratio)})`;

                return (
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
                        <button className="btn btn-sm" onClick={() => removeCase(c.id)}>
                          Hapus
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            setExpandedCaseId(expandedCaseId === c.id ? null : c.id)
                          }
                        >
                          {expandedCaseId === c.id ? "Collapse" : "Details"}
                        </button>
                      </div>
                    </div>

                    <div className="muted small">Assigned: {assignedLabel}</div>

                    {/* Expand section */}
                    {expandedCaseId === c.id && (
                      <div className="case-expanded">
                        <div className="muted small">
                          <b>Symptoms:</b> {c.symptoms.join(", ")}
                        </div>

                        <div className="muted small" style={{ marginTop: 6 }}>
                          <b>Weights:</b>{" "}
                          {Object.entries(c.weights || {})
                            .map(([g, w]) => `${g}(w:${w})`)
                            .join(", ")}
                        </div>

                        <div className="muted small" style={{ marginTop: 6 }}>
                          <b>Denominator:</b> {c.denom || (c.weights ? Object.values(c.weights).reduce((a,b)=>a+b,0) : "-")}
                        </div>

                        {/* Display stored comparisons */}
                        <div className="muted small" style={{ marginTop: 6 }}>
                          <b>Stored Similarity Snapshot:</b>
                        </div>

                        <ul className="muted small" style={{ marginLeft: 12 }}>
                          {(c.comparisons || []).map((cmp, idx) => (
                            <li key={idx}>
                              {cmp.type === "diseases" ? (
                                <>
                                  <b>{cmp.label}</b>: P1={fmtPct(cmp.values.P1.ratio)},{" "}
                                  P2={fmtPct(cmp.values.P2.ratio)},{" "}
                                  P3={fmtPct(cmp.values.P3.ratio)}
                                </>
                              ) : (
                                <>
                                  <b>{cmp.label}</b> → {fmtPct(cmp.ratio)} (matched{" "}
                                  {cmp.matched}/{cmp.total})
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* bottom summary */}
      <section className="panel bottom">
        <h2>Summary Table — Semua Kasus</h2>
        <div className="table-wrap">
          <table className="summary-table">
            <thead><tr><th>Case ID</th><th>Waktu</th><th>Assigned</th><th>Gejala</th><th>Denom</th></tr></thead>
            <tbody>
              {cases.length === 0 ? (<tr><td colSpan="5" className="muted">Belum ada kasus tersimpan.</td></tr>) : (
                cases.map((c) => {
                  const assignedInfo = computeAssignedForCase(c);
                  const assignedShort = `${assignedInfo.code} (${fmtPct(assignedInfo.ratio)})`;
                  return (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{new Date(c.createdAt).toLocaleString()}</td>
                      <td>{assignedShort}</td>
                      <td>{c.symptoms.join(", ")}</td>
                      <td>{c.denom || (c.weights ? Object.values(c.weights).reduce((a,b)=>a+b,0) : "-")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">© {new Date().getFullYear()} CBR — Manual-paper logic implemented</footer>
    </div>
  );
}
