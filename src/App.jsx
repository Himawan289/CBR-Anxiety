import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const DISEASES = [
  {
    code: "P1",
    name: "Generalized Anxiety Disorder (GAD)",
    description:
      "Kecemasan berlebihan dan kronis akan berbagai aspek kehidupan.",
  },
  {
    code: "P2",
    name: "Panic Disorder",
    description: "Serangan panik berulang dengan gejala fisik yang kuat.",
  },
  {
    code: "P3",
    name: "Specific Phobias",
    description:
      "Ketakutan intens & irasional terhadap objek/situasi tertentu.",
  },
];

const SYMPTOMS = [
  { code: "G01", name: "Nyeri otot", weights: { P1: 1 } },
  { code: "G02", name: "Kesulitan tidur", weights: { P1: 2 } },
  { code: "G03", name: "Mudah merasakan lelah", weights: { P1: 1 } },
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

function formatPct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function computeScores(selected) {
  const totals = { P1: 0, P2: 0, P3: 0 };
  const denoms = { P1: 0, P2: 0, P3: 0 };
  for (const row of SYMPTOMS) {
    for (const d of ["P1", "P2", "P3"]) {
      const w = row.weights[d] || 0;
      if (w > 0) {
        denoms[d] += w;
        if (selected.has(row.code)) totals[d] += w;
      }
    }
  }
  const scores = Object.keys(totals).map((d) => ({
    disease: d,
    numerator: totals[d],
    denominator: denoms[d] || 1,
    score: totals[d] / (denoms[d] || 1),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

const STORAGE_KEY = "cbr_anxiety_cases_v1";

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [cases, setCases] = useState([]);
  const [overrideDx, setOverrideDx] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCases(JSON.parse(raw));
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYMPTOMS;
    return SYMPTOMS.filter(
      (s) =>
        s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [query]);

  const scores = useMemo(() => computeScores(selected), [selected]);
  const top = scores[0];

  const toggle = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const clearAll = () => {
    setSelected(new Set());
    setOverrideDx("");
  };

  const retain = () => {
    if (!top) return;
    const dx = overrideDx || top.disease;
    const rawScores = { P1: 0, P2: 0, P3: 0 };
    for (const s of scores) rawScores[s.disease] = s.score;
    const payload = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      symptoms: Array.from(selected),
      result: dx,
      rawScores,
    };
    const next = [payload, ...cases];
    setCases(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const reuseCase = (id) => {
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    setSelected(new Set(c.symptoms));
    setOverrideDx(c.result);
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
          <div className="subtitle">
            Anxiety Disorders — CBR (weighted similarity)
          </div>
        </div>
        <div className="header__right">
          <span className="badge">Retrieve • Reuse • Revise • Retain</span>
        </div>
      </header>

      <main className="layout">
        <section className="panel panel-left">
          <div className="panel__title">
            <h2>Gejala (Checklist)</h2>
            <div className="toolbar">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode/nama gejala..."
              />
              <button className="btn" onClick={clearAll}>
                Reset
              </button>
            </div>
          </div>

          <ul className="symptom-list">
            {filtered.map((row) => (
              <li key={row.code} className="symptom">
                <input
                  id={row.code}
                  type="checkbox"
                  checked={selected.has(row.code)}
                  onChange={() => toggle(row.code)}
                />
                <label htmlFor={row.code}>
                  <div className="symptom__name">
                    {row.code} — {row.name}
                  </div>
                  <div className="chips">
                    {["P1", "P2", "P3"]
                      .filter((d) => (row.weights[d] || 0) > 0)
                      .map((d) => (
                        <span key={d} className="chip">
                          {d}: w{row.weights[d]}
                        </span>
                      ))}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-mid">
          <h2 className="panel__heading">Hasil Similarity & Penjelasan</h2>

          {scores.map((s) => {
            const disease = DISEASES.find((d) => d.code === s.disease);
            return (
              <div key={s.disease} className="score-card">
                <div className="score-card__top">
                  <div>
                    <div className="title">{disease.name}</div>
                    <div className="subtitle">{disease.description}</div>
                  </div>
                  <div className="value">
                    <div className="pct">{formatPct(s.score)}</div>
                    <div className="ratio">
                      {s.numerator.toFixed(0)} / {s.denominator.toFixed(0)}
                    </div>
                  </div>
                </div>
                <div className="progress">
                  <div
                    className="bar"
                    style={{ width: `${Math.min(100, s.score * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}

          {top && (
            <div className="callout">
              <div className="callout__label">Diagnosis Sementara</div>
              <div className="callout__title">
                {DISEASES.find((d) => d.code === top.disease)?.name}
              </div>
              <p>
                Hasil otomatis berdasarkan gejala yang dipilih & bobot dari
                penelitian.
              </p>
            </div>
          )}

          <div className="revise">
            <div className="revise__title">Revise (opsional)</div>
            <div className="revise__options">
              {["", "P1", "P2", "P3"].map((opt) => (
                <label key={opt} className="radio">
                  <input
                    type="radio"
                    name="revise"
                    value={opt}
                    checked={overrideDx === opt}
                    onChange={(e) => setOverrideDx(e.target.value)}
                  />
                  <span>
                    {opt === ""
                      ? "Tidak merevisi (pakai hasil otomatis)"
                      : DISEASES.find((d) => d.code === opt)?.name}
                  </span>
                </label>
              ))}
            </div>

            <div className="actions">
              <button className="btn btn--primary" onClick={retain}>
                Retain: Simpan Kasus Ini
              </button>
              <button className="btn" onClick={clearAll}>
                Bersihkan Pilihan
              </button>
            </div>

            <p className="hint">
              Catatan: ini alat bantu awal (triase). Untuk diagnosis pasti,
              konsultasikan dengan profesional.
            </p>
          </div>
        </section>

        <section className="panel panel-right">
          <h2 className="panel__heading">Case Base (Reuse / Retain)</h2>
          {cases.length === 0 ? (
            <p className="muted">
              Belum ada kasus tersimpan. Simpan kasus dari panel hasil untuk
              mulai membangun basis kasus.
            </p>
          ) : (
            <ul className="case-list">
              {cases.map((c) => (
                <li key={c.id} className="case-card">
                  <div className="meta">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                  <div className="result">
                    Hasil:{" "}
                    <strong>
                      {DISEASES.find((d) => d.code === c.result)?.name}
                    </strong>
                  </div>
                  <div className="meta">Gejala: {c.symptoms.join(", ")}</div>
                  <div className="meta">
                    Skor — P1: {formatPct(c.rawScores.P1)}, P2:{" "}
                    {formatPct(c.rawScores.P2)}, P3: {formatPct(c.rawScores.P3)}
                  </div>
                  <div className="case-card__actions">
                    <button className="btn" onClick={() => reuseCase(c.id)}>
                      Reuse
                    </button>
                    <button className="btn" onClick={() => deleteCase(c.id)}>
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="app__footer">
        © {new Date().getFullYear()} CBR Expert System
      </footer>
    </div>
  );
}
