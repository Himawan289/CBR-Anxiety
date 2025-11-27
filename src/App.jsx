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
  { code: "G12", name: "Jantung berdebar-debar", weights: { P2: 2 } },
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

const STORAGE_KEY = "cbr_newcases_v1";

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
function fmtPct(x) {
  // show percentage with 4 decimal places to be precise
  return `${(x * 100).toFixed(4)}%`;
}

/* compute similarity per disease between selected (new case) and disease table */
function computeSimilarityPerDisease(selectedSet, totalsDenom) {
  // numerator per disease = sum of weights of selected symptoms that belong to disease
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
    const denom = totalsDenom[d] || 1; // avoid div0
    const ratio = denom === 0 ? 0 : numerators[d] / denom;
    results[d] = { matched: numerators[d], total: denom, ratio };
  }
  return results;
}

/* =========================
   React Component
   ========================= */
export default function App() {
  const [selected, setSelected] = useState(new Set());
  const [cases, setCases] = useState([]); // stored new cases (history)
  const [showMath, setShowMath] = useState(false);
  const [expandedMathFor, setExpandedMathFor] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCases(JSON.parse(raw));
    } catch {}
  }, []);

  // denom totals based on table
  const totalsDenom = useMemo(() => computeTotalWeightsPerDisease(), []);

  // live similarity for current selected (new case)
  const liveSimilarity = useMemo(() => {
    return computeSimilarityPerDisease(selected, totalsDenom);
  }, [selected, totalsDenom]);

  // predicted disease (highest ratio; tie-breaker by matched weight)
  const predicted = useMemo(() => {
    const arr = Object.entries(liveSimilarity).map(([d, v]) => ({
      code: d,
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
    setExpandedMathFor(null);
  };

  const retain = () => {
    // save current new-case as next training case
    const id = `CASE-${Date.now()}`;
    const payload = {
      id,
      createdAt: new Date().toISOString(),
      symptoms: Array.from(selected),
      result: predicted?.code || null,
      scores: {
        P1: liveSimilarity.P1.ratio,
        P2: liveSimilarity.P2.ratio,
        P3: liveSimilarity.P3.ratio,
      },
    };
    const next = [payload, ...cases];
    setCases(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const reuse = (c) => {
    setSelected(new Set(c.symptoms));
  };

  const removeCase = (id) => {
    const next = cases.filter((r) => r.id !== id);
    setCases(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const diseaseName = (code) =>
    DISEASES.find((d) => d.code === code)?.name || code;

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <h1>CBR — New-cases (paper logic) </h1>
          <div className="muted">
            Similarity per penyakit = Σ bobot(gejala terpilih & termasuk
            penyakit) / Σ bobot(semua gejala penyakit)
          </div>
        </div>

        <div className="top-actions">
          <button className="btn" onClick={reset}>
            Reset
          </button>
          {/* <button className="btn" onClick={() => setShowMath((s) => !s)}>
            {showMath ? "Hide math" : "Show math"}
          </button> */}
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
        {/* LEFT: checklist */}
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
                      {s.code} — <span className="symptom-name">{s.name}</span>
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

        {/* MIDDLE: live similarity */}
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
                  <div className="score">{fmtPct(v.ratio)}</div>
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      setExpandedMathFor(expandedMathFor === code ? null : code)
                    }
                  >
                    {expandedMathFor === code ? "Hide math" : "Show math"}
                  </button>
                </div>

                <div className="progress small">
                  <div
                    className="bar"
                    style={{ width: `${Math.min(100, v.ratio * 100)}%` }}
                  />
                </div>

                {expandedMathFor === code && (
                  <div className="math-block muted">
                    <div>
                      <b>Numerator (matched weight):</b> {v.matched}
                    </div>
                    <div>
                      <b>Denominator (total disease weight):</b> {v.total}
                    </div>
                    <div>
                      Ratio = {v.matched} / {v.total} = {fmtPct(v.ratio)}
                    </div>
                  </div>
                )}
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
                {predicted ? fmtPct(predicted.ratio) : "-"}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: stored case base */}
        <section className="panel right">
          <h2>Case Base — Kasus tersimpan</h2>
          <p className="muted">
            Setiap kali tekan "Retain", kasus baru disimpan di sini
            (history/training).
          </p>

          {cases.length === 0 ? (
            <p className="muted">Belum ada kasus tersimpan.</p>
          ) : (
            <ul className="case-list">
              {cases.map((c) => (
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* bottom table: ringkasan semua kasus */}
      <section className="panel bottom">
        <h2>Summary Table — Semua Kasus Tersimpan</h2>
        <div className="table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Waktu</th>
                <th>Result</th>
                <th>P1</th>
                <th>P2</th>
                <th>P3</th>
                <th>Gejala</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="muted">
                    Belum ada kasus tersimpan.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{new Date(c.createdAt).toLocaleString()}</td>
                    <td>{c.result ? diseaseName(c.result) : "-"}</td>
                    <td>{fmtPct(c.scores.P1)}</td>
                    <td>{fmtPct(c.scores.P2)}</td>
                    <td>{fmtPct(c.scores.P3)}</td>
                    <td style={{ minWidth: 200 }}>{c.symptoms.join(", ")}</td>
                  </tr>
                ))
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
