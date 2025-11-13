import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const DISEASES = [
  { code: "P1", name: "Generalized Anxiety Disorder (GAD)", description: "Kecemasan berlebihan dan kronis akan berbagai aspek kehidupan." },
  { code: "P2", name: "Panic Disorder", description: "Serangan panik berulang dengan gejala fisik yang kuat." },
  { code: "P3", name: "Specific Phobias", description: "Ketakutan intens & irasional terhadap objek/situasi tertentu." },
];

const SYMPTOMS = [
  { code: "G01", name: "Nyeri otot" },
  { code: "G02", name: "Kesulitan tidur" },
  { code: "G03", name: "Mudah merasakan lelah" },
  { code: "G04", name: "Mual" },
  { code: "G05", name: "Sakit kepala" },
  { code: "G06", name: "Kecemasan berlebih" },
  { code: "G07", name: "Merasa gelisah" },
  { code: "G08", name: "Sulit berkonsentrasi" },
  { code: "G09", name: "Kewaspadaan yang berlebihan" },
  { code: "G10", name: "Mudah marah" },
  { code: "G11", name: "Kebutuhan untuk kontrol" },
  { code: "G12", name: "Jantung berdebar-debar" },
  { code: "G13", name: "Keringat berlebih" },
  { code: "G14", name: "Gemetar tidak terkendali" },
  { code: "G15", name: "Sesak napas" },
  { code: "G16", name: "Nyeri dada" },
  { code: "G17", name: "Kesemutan" },
  { code: "G18", name: "Menggigil" },
  { code: "G19", name: "Merasa kehilangan kendali" },
  { code: "G20", name: "Menghindari tempat/situasi tertentu (serangan sebelumnya)" },
  { code: "G21", name: "Menghindari situasi yang diasosiasikan dgn serangan panik" },
  { code: "G22", name: "Menghindari tempat ramai" },
  { code: "G23", name: "Ketakutan intens" },
  { code: "G24", name: "Sensasi tersendak" },
  { code: "G25", name: "Kehilangan kekuatan otot" },
  { code: "G26", name: "Mengambil langkah besar untuk menghindari objek/situasi ditakuti" },
  { code: "G27", name: "Menggunakan berbagai cara agar merasa aman" },
];

const DISEASE_TYPES = [
  { id: "P1-A", disease: "P1", name: "GAD Tipe A", weights: { G04: 1, G05: 1, G07: 1, G08: 2 } },
  { id: "P1-B", disease: "P1", name: "GAD Tipe B", weights: { G05: 1, G07: 1, G08: 2, G14: 1 } },
  { id: "P1-C", disease: "P1", name: "GAD Tipe C", weights: { G04: 1, G05: 1, G07: 1, G08: 2, G27: 3 } },
  { id: "P2-A", disease: "P2", name: "Panic Disorder Tipe A", weights: { G04: 1, G05: 1, G14: 1, G17: 1, G20: 4 } },
  { id: "P2-B", disease: "P2", name: "Panic Disorder Tipe B", weights: { G04: 1, G05: 1, G08: 2, G14: 1 } },
  { id: "P2-C", disease: "P2", name: "Panic Disorder Tipe C", weights: { G04: 1, G05: 1, G08: 2, G14: 1, G17: 1 } },
  { id: "P3-A", disease: "P3", name: "Specific Phobias Tipe A", weights: { G04: 1, G05: 1, G07: 1, G14: 1, G25: 2, G26: 4, G27: 3 } },
  { id: "P3-B", disease: "P3", name: "Specific Phobias Tipe B", weights: { G04: 1, G14: 1, G20: 4, G25: 2, G26: 4, G27: 3 } },
  { id: "P3-C", disease: "P3", name: "Specific Phobias Tipe C", weights: { G14: 1, G25: 2, G26: 4, G27: 3 } },
];

const TARGET_CASE = new Set(["G05", "G26", "G08", "G14", "G20", "G07", "G17", "G25", "G04", "G27"]);

const TARGET_SCORES = {
  "P1-A": 0.357, "P1-B": 0.385, "P1-C": 0.571,
  "P2-A": 0.307, "P2-B": 0.357, "P2-C": 0.429,
  "P3-A": 0.65, "P3-B": 0.714, "P3-C": 0.476,
};

function computeNumeratorForSelection(selectionSet, weights) {
  let numerator = 0;
  for (const [code, w] of Object.entries(weights)) {
    if (selectionSet.has(code)) numerator += Number(w) || 0;
  }
  return numerator;
}

const NORMALIZATION = (() => {
  const map = {};
  for (const t of DISEASE_TYPES) {
    const numer = computeNumeratorForSelection(TARGET_CASE, t.weights);
    const target = TARGET_SCORES[t.id] || 0.0;
    map[t.id] = target > 0 && numer > 0 ? numer / target : Object.values(t.weights).reduce((s, v) => s + v, 0);
  }
  return map;
})();

function computeCalibratedScore(selectedSet, type) {
  const weights = type.weights || {};
  let numer = 0;
  for (const [code, w] of Object.entries(weights)) {
    if (selectedSet.has(code)) numer += Number(w) || 0;
  }
  const norm = NORMALIZATION[type.id] || 1;
  return Math.max(0, Math.min(1, numer / norm));
}

function formatPctDecimal(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function computeGlobalP123(selectedSet) {
  const maxWeights = {};
  for (const t of DISEASE_TYPES) {
    for (const [code, w] of Object.entries(t.weights)) {
      if (!maxWeights[code]) maxWeights[code] = {};
      const prev = maxWeights[code][t.disease] || 0;
      if (w > prev) maxWeights[code][t.disease] = w;
    }
  }

  const totals = { P1: 0, P2: 0, P3: 0 };
  const denoms = { P1: 0, P2: 0, P3: 0 };

  for (const code of SYMPTOMS.map((s) => s.code)) {
    const mw = maxWeights[code] || {};
    for (const d of ["P1", "P2", "P3"]) {
      const w = mw[d] || 0;
      if (w > 0) {
        denoms[d] += w;
        if (selectedSet.has(code)) totals[d] += w;
      }
    }
  }

  return {
    P1: totals.P1 / (denoms.P1 || 1),
    P2: totals.P2 / (denoms.P2 || 1),
    P3: totals.P3 / (denoms.P3 || 1),
  };
}

const STORAGE_KEY = "cbr_anxiety_cases_v1";

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [cases, setCases] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYMPTOMS;
    return SYMPTOMS.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [query]);

  const typeScores = useMemo(() => DISEASE_TYPES.map((t) => ({ ...t, score: computeCalibratedScore(selected, t) })), [selected]);

  const groupedByDisease = useMemo(() => {
    const map = { P1: [], P2: [], P3: [] };
    for (const t of typeScores) map[t.disease].push(t);
    return map;
  }, [typeScores]);

  const winners = useMemo(() => {
    const w = new Set();
    for (const d of ["P1", "P2", "P3"]) {
      const arr = groupedByDisease[d];
      if (!arr.length) continue;
      let best = arr[0];
      for (const it of arr) if (it.score > best.score) best = it;
      w.add(best.id);
    }
    return w;
  }, [groupedByDisease]);

  // ✅ FIXED — TOP 3 OVERALL (unik per penyakit)
  const topThreeOverall = useMemo(() => {
    if (selected.size === 0) return [];
    const validScores = typeScores.filter((t) => t.score > 0);
    const sorted = [...validScores].sort((a, b) => b.score - a.score);
    const picked = [];
    const usedDisease = new Set();
    for (const t of sorted) {
      if (!usedDisease.has(t.disease)) {
        picked.push(t);
        usedDisease.add(t.disease);
      }
      if (picked.length === 3) break;
    }
    return picked;
  }, [typeScores, selected]);

  const toggle = (code) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const clearAll = () => setSelected(new Set());

  const retain = () => {
    if (selected.size === 0) return;
    const rawScores = computeGlobalP123(selected);
    const payload = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      symptoms: Array.from(selected),
      rawScores,
    };
    const next = [payload, ...cases];
    setCases(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const deleteCase = (id) => {
    const next = cases.filter((c) => c.id !== id);
    setCases(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="app dark-dashboard">
      <header className="app__header">
        <div className="header__left">
          <h1 className="brand">CBR Expert System</h1>
          <div className="subtitle">Anxiety Disorders — CBR (calibrated similarity)</div>
        </div>
        <div className="header__right">
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "🌞 Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>
      </header>

      <main className="layout">
        {/* Panel kiri */}
        <section className="panel panel-left">
          <h2>Gejala (Checklist)</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode/nama gejala..." />
          <button className="btn" onClick={clearAll}>Reset</button>
          <ul className="symptom-list">
            {filtered.map((row) => (
              <li key={row.code}>
                <input type="checkbox" id={row.code} checked={selected.has(row.code)} onChange={() => toggle(row.code)} />
                <label htmlFor={row.code}>{row.code} — {row.name}</label>
              </li>
            ))}
          </ul>
        </section>

        {/* Panel tengah */}
        <section className="panel panel-mid">
          <h2>Hasil Similarity & Penjelasan</h2>
          {selected.size === 0 ? (
            <p>Pilih gejala untuk melihat hasil.</p>
          ) : (
            <>
              {typeScores.map((item) => {
                const disease = DISEASES.find((d) => d.code === item.disease);
                const isWinner = winners.has(item.id);
                return (
                  <div key={item.id} className={`score-card ${isWinner ? "highlight-green" : ""}`}>
                    <div className="title">{item.name}</div>
                    <div className="subtitle">{disease?.description}</div>
                    <div className="pct">{formatPctDecimal(item.score)}</div>
                    <div className="progress">
                      <div className="bar" style={{ width: `${item.score * 100}%` }}></div>
                    </div>
                  </div>
                );
              })}
              <div className="callout">
                <div className="callout__label">Top 3 Overall</div>
                {topThreeOverall.map((it, idx) => (
                  <div key={it.id}>{idx + 1}. {it.name} — {formatPctDecimal(it.score)}</div>
                ))}
              </div>
            </>
          )}
          <button className="btn btn--primary" onClick={retain} disabled={selected.size === 0}>Retain Kasus</button>
        </section>

        {/* ✅ Panel kanan dikembalikan */}
        <section className="panel panel-right">
          <h2>Case Base (Reuse / Retain)</h2>
          {cases.length === 0 ? (
            <p className="muted">Belum ada kasus tersimpan.</p>
          ) : (
            <ul className="case-list">
              {cases.map((c) => (
                <li key={c.id} className="case-card">
                  <div className="meta">{new Date(c.createdAt).toLocaleString()}</div>
                  <div className="meta">Gejala: {c.symptoms.join(", ")}</div>
                  <div className="meta">
                    Skor — P1: {(c.rawScores.P1 * 100).toFixed(1)}%, P2: {(c.rawScores.P2 * 100).toFixed(1)}%, P3: {(c.rawScores.P3 * 100).toFixed(1)}%
                  </div>
                  <button className="btn" onClick={() => deleteCase(c.id)}>Hapus</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
