import React, { useMemo, useState } from "react";

const Card = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      background: "#fff",
    }}
  >
    {children}
  </div>
);

const Grid = ({
  children,
  cols = 3,
}: {
  children: React.ReactNode;
  cols?: number;
}) => (
  <div
    style={{
      display: "grid",
      gap: 12,
      gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
    }}
  >
    {children}
  </div>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div style={{ display: "grid", gap: 6 }}>
    <label style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
    {...props}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
    {...props}
  />
);

const Button = ({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button style={{ padding: "8px 12px", cursor: "pointer" }} {...props}>
    {children}
  </button>
);

const RIGHTS_REFERENCE_DATE = "2023-08-30";
const INITIAL_PERIODS = ["2023/2024", "2025"];
const CATEGORY_OPTIONS = [
  "Assistente Operacional",
  "Assistente Técnico",
  "Coordenador Técnico",
  "Técnico Superior",
  "Chefe de Equipa Multidisciplinar",
  "Dirigente",
] as const;
const STORAGE_KEY = "siadap_workers_v1";

type Worker = {
  id: string;
  number: string;
  name: string;
  category: string;
  level: string;
  positionAt20230101: string;
  currentPosition: string;
  initial: number | string;
  points: Record<string, number | string>;
  override: Record<string, string>;
  levels: Record<string, string>;
  entryDate: string;
  entryEntityDate: string;
  careerDate: string;
  categoryDate: string;
  levelChangeDate: string;
  levelChangeDates: Record<string, string>;
  exitDate: string;
  notes: string;
  usufruiu6: boolean;
  dataUsufruto6: string;
};

type CalcRow = {
  period: string;
  start: string;
  initial: number;
  awarded: number;
  total: number;
  progressed: boolean;
  final: string;
  remaining: number;
  rule: string;
  level: string;
  levelChangeDate: string;
};

function loadWorkersFromStorage(): Worker[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkersToStorage(workers: Worker[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workers));
  } catch {}
}

function normalize(v: unknown): string {
  return v ? String(v).trim() : "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return null;

  const [year, month, day] = parts;
  if (!year || !month || !day) return null;

  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }

  return dt;
}

function incrementPosition(value: string): string {
  const text = normalize(value);
  if (!text) return "";

  if (/^\d+$/.test(text)) return String(Number(text) + 1);

  const parts = text
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 2) {
    const nums = parts.map((p) => {
      const match = p.match(/(\d+)/);
      return match ? Number(match[1]) : NaN;
    });
    if (nums.every((n) => !Number.isNaN(n))) {
      return `${nums[0] + 1}ª/${nums[1] + 1}ª`;
    }
  }

  const single = text.match(/(\d+)/);
  if (single) return `${Number(single[1]) + 1}ª`;

  return text;
}

function yearsBetween(start: string, end: string): number {
  if (!start || !end) return 0;

  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!s || !e) return 0;

  let years = e.getFullYear() - s.getFullYear();
  const monthDiff = e.getMonth() - s.getMonth();
  const dayDiff = e.getDate() - s.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;

  return Math.max(0, years);
}

function diffYMD(start: string): string {
  if (!start) return "";

  const s = parseLocalDate(start);
  if (!s) return "";

  const now = new Date();
  const e = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days = e.getDate() - s.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(e.getFullYear(), e.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${Math.max(0, years)}a ${Math.max(0, months)}m ${Math.max(0, days)}d`;
}

function formatProgressionDate(period: string): string {
  if (!period) return "";
  if (period.includes("/")) {
    const endYear = Number(period.split("/")[1]);
    return Number.isFinite(endYear) ? `${endYear + 1}-01-01` : "";
  }
  const year = Number(period);
  return Number.isFinite(year) ? `${year + 1}-01-01` : "";
}

function calculate(worker: Worker, periods: string[]): CalcRow[] {
  let position = normalize(worker.positionAt20230101) || "0";
  let carried = 0;
  let used6Already = Boolean(worker.usufruiu6);
  const resultsSoFar: CalcRow[] = [];
  const eligible6 = yearsBetween(worker.entryDate, RIGHTS_REFERENCE_DATE) >= 18;

  return periods.map((period, index) => {
    const awarded = Number(worker.points?.[period] || 0);
    const initial = index === 0 ? Number(worker.initial || 0) : carried;
    const total = initial + awarded;

    const threshold = !used6Already && eligible6 ? 6 : 8;
    const progressed = total >= threshold;
    const automaticEnd = progressed ? incrementPosition(position) : position;

    const hasManual =
      Object.prototype.hasOwnProperty.call(worker.override || {}, period) &&
      String(worker.override?.[period] ?? "").trim() !== "";

    const final = hasManual ? worker.override[period] : automaticEnd;
    const remaining = progressed ? total - threshold : total;
    const rule = progressed ? `${threshold} pontos` : "Nenhuma";

    const previousPeriod = index > 0 ? periods[index - 1] : null;
    const previousLevel =
      index === 0
        ? worker.level || ""
        : worker.levels?.[previousPeriod || ""] ||
          resultsSoFar[index - 1]?.level ||
          worker.level ||
          "";

    const level = worker.levels?.[period] || previousLevel;

    const autoLevelChangeDate = progressed
      ? formatProgressionDate(period)
      : index === 0
      ? worker.levelChangeDate || ""
      : resultsSoFar[index - 1]?.levelChangeDate ||
        worker.levelChangeDate ||
        "";

    if (progressed && threshold === 6) used6Already = true;

    const row: CalcRow = {
      period,
      start: position,
      initial,
      awarded,
      total,
      progressed,
      final,
      remaining,
      rule,
      level,
      levelChangeDate: worker.levelChangeDates?.[period] || autoLevelChangeDate,
    };

    resultsSoFar.push(row);
    position = final;
    carried = remaining;
    return row;
  });
}

function getDerivedLevel(worker: Worker, periods: string[]): string {
  const reversed = [...periods].reverse();
  for (const period of reversed) {
    const level = normalize(worker.levels?.[period]);
    if (level) return level;
  }
  return normalize(worker.level);
}

function getWorkerComputedState(worker: Worker, periods: string[]) {
  const results = calculate(worker, periods);
  const last = results[results.length - 1];
  const currentPosition =
    last?.final ||
    normalize(worker.currentPosition) ||
    normalize(worker.positionAt20230101);
  const currentLevel = getDerivedLevel(worker, periods);

  return {
    results,
    last,
    currentPosition,
    currentLevel,
  };
}

function createEmptyWorker(): Worker {
  return {
    id: `tmp-${Date.now()}`,
    number: "",
    name: "",
    category: "Assistente Técnico",
    level: "",
    positionAt20230101: "0",
    currentPosition: "0",
    initial: 0,
    points: { "2023/2024": 0, "2025": 0 },
    override: {},
    levels: {},
    entryDate: "",
    entryEntityDate: "",
    careerDate: "",
    categoryDate: "",
    levelChangeDate: "",
    levelChangeDates: {},
    exitDate: "",
    notes: "",
    usufruiu6: false,
    dataUsufruto6: "",
  };
}

function getDecree75Status(worker: Worker, results: CalcRow[]) {
  const last6 = [...results].reverse().find((r) => r.rule === "6 pontos");
  const usedByFlag = Boolean(worker.usufruiu6);
  const usedByResults = Boolean(last6);
  const used = usedByFlag || usedByResults;
  const usedDate =
    worker.dataUsufruto6 || (last6 ? formatProgressionDate(last6.period) : "");

  return { used, usedDate };
}

function buildDecree75Report(workers: Worker[], periods: string[]) {
  return workers.map((w) => {
    const results = calculate(w, periods);
    const decree = getDecree75Status(w, results);
    const anosReferencia = yearsBetween(w.entryDate, RIGHTS_REFERENCE_DATE);
    const elegivel = anosReferencia >= 18;
    const last = results[results.length - 1];
    const canUseNow = elegivel && !decree.used && (last?.remaining ?? 0) >= 6;
    const last6 = results.find((r) => r.rule === "6 pontos");

    return {
      id: w.id,
      number: w.number || "—",
      name: w.name || "Sem nome",
      anosReferencia,
      elegivel,
      used: decree.used,
      usedDate:
        decree.usedDate || (last6 ? formatProgressionDate(last6.period) : ""),
      points: last?.remaining ?? 0,
      canUseNow,
    };
  });
}

export default function App() {
  const [workers, setWorkers] = useState<Worker[]>(loadWorkersFromStorage);
  const [worker, setWorker] = useState<Worker>(createEmptyWorker());
  const [searchQuery, setSearchQuery] = useState("");

  const periods = INITIAL_PERIODS;

  const computed = useMemo(
    () => getWorkerComputedState(worker, periods),
    [worker, periods]
  );
  const results = computed.results;
  const currentPosition = computed.currentPosition;
  const currentLevel = computed.currentLevel;

  const anosReferencia = yearsBetween(worker.entryDate, RIGHTS_REFERENCE_DATE);
  const elegivel6 = anosReferencia >= 18;
  const decree75 = getDecree75Status(worker, results);

  const decree75Rows = useMemo(
    () => buildDecree75Report(workers, periods),
    [workers, periods]
  );
  const decree75Eligible = decree75Rows.filter((r) => r.elegivel);
  const decree75Used = decree75Rows.filter((r) => r.used);
  const decree75EligibleNotUsed = decree75Rows.filter(
    (r) => r.elegivel && !r.used
  );

  function newWorker() {
    setWorker(createEmptyWorker());
  }

  function saveCurrentWorker() {
    const id = worker.id || worker.number || `tmp-${Date.now()}`;
    const finalPosition =
      results[results.length - 1]?.final ||
      worker.currentPosition ||
      worker.positionAt20230101;

    const stored: Worker = {
      ...worker,
      id,
      currentPosition: finalPosition,
      level: currentLevel || worker.level,
    };

    setWorker(stored);

    setWorkers((prev) => {
      const exists = prev.some((w) => w.id === id);
      const nextWorkers = exists
        ? prev.map((w) => (w.id === id ? stored : w))
        : [stored, ...prev];

      saveWorkersToStorage(nextWorkers);
      return nextWorkers;
    });
  }

  function deleteCurrentWorker() {
    const exists = workers.some((w) => w.id === worker.id);

    if (!exists) {
      setWorker(createEmptyWorker());
      return;
    }

    const label = `${worker.number || "—"} | ${worker.name || "Sem nome"}`;
    const confirmed = window.confirm(`Pretende apagar o trabalhador ${label}?`);
    if (!confirmed) return;

    const nextWorkers = workers.filter((w) => w.id !== worker.id);
    setWorkers(nextWorkers);
    saveWorkersToStorage(nextWorkers);
    setWorker(createEmptyWorker());
  }

  function exportData() {
    const data = JSON.stringify({ workers }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "siadap_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.target?.result || "{}"));
          if (parsed.workers && Array.isArray(parsed.workers)) {
            setWorkers(parsed.workers);
            saveWorkersToStorage(parsed.workers);
          }
        } catch {
          alert("Erro ao importar ficheiro");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function printWorker() {
    const decree = getDecree75Status(worker, results);
    const notesHtml = escapeHtml(worker.notes).replace(/\n/g, "<br/>");

    const evaluationRows = results
      .map(
        (r) => `
          <tr>
            <td>${escapeHtml(r.period)}</td>
            <td>${escapeHtml(r.start)}</td>
            <td>${escapeHtml(r.initial)}</td>
            <td>${escapeHtml(r.awarded)}</td>
            <td>${escapeHtml(r.total)}</td>
            <td>${escapeHtml(r.rule)}</td>
            <td>${r.progressed ? "Sim" : "Não"}</td>
            <td>${escapeHtml(r.final)}</td>
            <td>${escapeHtml(r.remaining)}</td>
            <td>${escapeHtml(r.level || "—")}</td>
            <td>${escapeHtml(r.levelChangeDate || "—")}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
      <head>
        <title>Relatório Trabalhador</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h2, h3 { margin: 0 0 12px 0; }
          .section { margin-bottom: 24px; }
          .line { margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 6px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="section">
          <h2>Ficha do Trabalhador</h2>
          <div class="line"><strong>Número:</strong> ${escapeHtml(
            worker.number || "—"
          )}</div>
          <div class="line"><strong>Nome:</strong> ${escapeHtml(
            worker.name || "—"
          )}</div>
          <div class="line"><strong>Categoria:</strong> ${escapeHtml(
            worker.category || "—"
          )}</div>
          <div class="line"><strong>Nível:</strong> ${escapeHtml(
            currentLevel || "—"
          )}</div>
          <div class="line"><strong>Posição a 01/01/2023:</strong> ${escapeHtml(
            worker.positionAt20230101 || "—"
          )}</div>
          <div class="line"><strong>Posição atual:</strong> ${escapeHtml(
            currentPosition || "—"
          )}</div>
        </div>

        <div class="section">
          <h3>Antiguidade</h3>
          <div class="line"><strong>Função pública:</strong> ${escapeHtml(
            diffYMD(worker.entryDate) || "—"
          )}</div>
          <div class="line"><strong>Carreira:</strong> ${escapeHtml(
            diffYMD(worker.careerDate) || "—"
          )}</div>
          <div class="line"><strong>Categoria:</strong> ${escapeHtml(
            diffYMD(worker.categoryDate) || "—"
          )}</div>
        </div>

        <div class="section">
          <h3>Decreto-Lei 75/2023</h3>
          <div class="line"><strong>Antiguidade em 30/08/2023:</strong> ${escapeHtml(
            `${anosReferencia} anos`
          )}</div>
          <div class="line"><strong>Elegível:</strong> ${
            elegivel6 ? "Sim" : "Não"
          }</div>
          <div class="line"><strong>Já usufruiu:</strong> ${
            decree.used ? "Sim" : "Não"
          }</div>
          <div class="line"><strong>Data:</strong> ${escapeHtml(
            decree.usedDate || "—"
          )}</div>
        </div>

        <div class="section">
          <h3>Avaliação</h3>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Posição inicial</th>
                <th>Pontos iniciais</th>
                <th>Pontos atribuídos</th>
                <th>Total</th>
                <th>Regra aplicada</th>
                <th>Progressão</th>
                <th>Posição final</th>
                <th>Pontos sobrantes</th>
                <th>Nível</th>
                <th>Data mudança nível/escalão</th>
              </tr>
            </thead>
            <tbody>
              ${evaluationRows}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Observações</h3>
          <div>${notesHtml || "—"}</div>
        </div>

        <div class="section">
          <h3>Resultado final</h3>
          <div class="line"><strong>Posição final:</strong> ${escapeHtml(
            results[results.length - 1]?.final || "—"
          )}</div>
          <div class="line"><strong>Pontos sobrantes:</strong> ${escapeHtml(
            results[results.length - 1]?.remaining ?? "0"
          )}</div>
        </div>
      </body>
      </html>
    `;

    const win = window.open("", "", "width=1000,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  function printResumo() {
    const rows = workers
      .map((w) => {
        const computedWorker = getWorkerComputedState(w, periods);
        const res = computedWorker.results;
        const last = computedWorker.last;
        const lastProg = [...res].reverse().find((r) => r.progressed);
        const progressedDate = lastProg
          ? formatProgressionDate(lastProg.period)
          : "";

        return `
          <tr>
            <td>${escapeHtml(w.number || "—")}</td>
            <td>${escapeHtml(w.name || "Sem nome")}</td>
            <td>${escapeHtml(w.category || "—")}</td>
            <td>${escapeHtml(computedWorker.currentPosition || "—")}</td>
            <td>${escapeHtml(computedWorker.currentLevel || "—")}</td>
            <td>${escapeHtml(last?.remaining ?? 0)}</td>
            <td>${escapeHtml(progressedDate || "—")}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
      <head>
        <title>Resumo Trabalhadores</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 6px; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h2>Resumo de Trabalhadores</h2>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Posição</th>
              <th>Nível</th>
              <th>Pontos acumulados</th>
              <th>Data da última progressão</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open("", "", "width=1000,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  function printDecree75Report() {
    const htmlSection = (title: string, rows: typeof decree75Rows) => `
      <h3>${escapeHtml(title)}</h3>
      ${
        rows.length === 0
          ? "<div>Sem registos.</div>"
          : rows
              .map(
                (r) => `
        <div style="border:1px solid #ccc;padding:6px;margin-bottom:6px;">
          <strong>${escapeHtml(r.number)}</strong> | ${escapeHtml(r.name)}${
                  r.usedDate ? ` — ${escapeHtml(r.usedDate)}` : ""
                }${
                  r.points !== undefined
                    ? ` — Pontos: ${escapeHtml(r.points)}`
                    : ""
                }${r.canUseNow ? " — Pode usar já" : ""}
        </div>
      `
              )
              .join("")
      }
    `;

    const html = `
      <html>
      <head>
        <title>Relatório DL 75/2023</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h2 { margin-bottom: 20px; }
          h3 { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>Relatório Decreto-Lei 75/2023</h2>
        ${htmlSection("Quem tem direito", decree75Eligible)}
        ${htmlSection("Já usufruíram", decree75Used)}
        ${htmlSection("Não usufruíram", decree75EligibleNotUsed)}
      </body>
      </html>
    `;

    const win = window.open("", "", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  const filteredWorkers = workers.filter((w) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      String(w.number || "")
        .toLowerCase()
        .includes(q) ||
      String(w.name || "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div style={{ padding: 20, background: "#f8fafc", minHeight: "100vh" }}>
      <Card>
        <h3>Dados da aplicação</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={newWorker}>Novo trabalhador</Button>
          <Button onClick={exportData}>Exportar</Button>
          <Button onClick={importData}>Importar</Button>
          <Button onClick={printResumo}>Resumo PDF</Button>
          <Button onClick={printDecree75Report}>DL 75/2023 PDF</Button>
          <Button
            onClick={() =>
              alert(`${workers.length} trabalhador(es) em memória`)
            }
          >
            Diagnóstico
          </Button>
        </div>
      </Card>

      <Card>
        <h3>Resumo trabalhadores avaliados</h3>
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="Pesquisar por número ou nome"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {workers.length === 0 ? (
          <div>Sem trabalhadores guardados.</div>
        ) : (
          filteredWorkers.map((w) => {
            const computedWorker = getWorkerComputedState(w, periods);
            const res = computedWorker.results;
            const last = computedWorker.last;
            const lastOpenPeriod = [...periods].reverse().find((p) => p);
            const progressedInLastOpen = res.find(
              (x) => x.period === lastOpenPeriod
            )?.progressed;

            return (
              <div
                key={w.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  cursor: "pointer",
                  background: progressedInLastOpen ? "#ecfdf5" : "#fff",
                }}
                onClick={() => setWorker(w)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div>
                    <b>{w.number || "—"}</b> | {w.name || "Sem nome"}
                  </div>
                  {progressedInLastOpen ? (
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #86efac",
                        background: "#dcfce7",
                        color: "#166534",
                      }}
                    >
                      Progrediu
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  Posição: {computedWorker.currentPosition || "—"} | Nível:{" "}
                  {computedWorker.currentLevel || "—"} | Pontos sobrantes:{" "}
                  {last?.remaining ?? 0}
                </div>
              </div>
            );
          })
        )}
      </Card>

      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <h3>Ficha do trabalhador</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={printWorker}>Relatório PDF</Button>
            <Button onClick={saveCurrentWorker}>Guardar trabalhador</Button>
            <Button onClick={deleteCurrentWorker}>Apagar trabalhador</Button>
          </div>
        </div>

        <Grid cols={4}>
          <Field label="Número">
            <Input
              value={worker.number}
              onChange={(e) => setWorker({ ...worker, number: e.target.value })}
            />
          </Field>

          <Field label="Nome">
            <Input
              value={worker.name}
              onChange={(e) => setWorker({ ...worker, name: e.target.value })}
            />
          </Field>

          <Field label="Categoria">
            <Select
              value={worker.category}
              onChange={(e) =>
                setWorker({ ...worker, category: e.target.value })
              }
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>

          <Field label="Nível">
            <Input value={currentLevel || ""} readOnly />
          </Field>

          <Field label="Posição a 01/01/2023">
            <Input
              value={worker.positionAt20230101}
              onChange={(e) =>
                setWorker({
                  ...worker,
                  positionAt20230101: e.target.value,
                  currentPosition: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Posição atual">
            <Input value={currentPosition || ""} readOnly />
          </Field>

          <Field label="Entrada na função pública">
            <Input
              type="date"
              value={worker.entryDate}
              onChange={(e) =>
                setWorker({ ...worker, entryDate: e.target.value })
              }
            />
          </Field>

          <Field label="Antiguidade na função pública">
            <Input value={diffYMD(worker.entryDate)} readOnly />
          </Field>

          <Field label="Entrada na entidade">
            <Input
              type="date"
              value={worker.entryEntityDate}
              onChange={(e) =>
                setWorker({ ...worker, entryEntityDate: e.target.value })
              }
            />
          </Field>

          <Field label="Data na carreira">
            <Input
              type="date"
              value={worker.careerDate}
              onChange={(e) =>
                setWorker({ ...worker, careerDate: e.target.value })
              }
            />
          </Field>

          <Field label="Antiguidade na carreira">
            <Input value={diffYMD(worker.careerDate)} readOnly />
          </Field>

          <Field label="Data na categoria">
            <Input
              type="date"
              value={worker.categoryDate}
              onChange={(e) =>
                setWorker({ ...worker, categoryDate: e.target.value })
              }
            />
          </Field>

          <Field label="Antiguidade na categoria">
            <Input value={diffYMD(worker.categoryDate)} readOnly />
          </Field>

          <Field label="Mudança de escalão/nível">
            <Input
              type="date"
              value={
                results[results.length - 1]?.levelChangeDate ||
                worker.levelChangeDate
              }
              onChange={(e) =>
                setWorker({ ...worker, levelChangeDate: e.target.value })
              }
            />
          </Field>

          <Field label="Data de saída">
            <Input
              type="date"
              value={worker.exitDate}
              onChange={(e) =>
                setWorker({ ...worker, exitDate: e.target.value })
              }
            />
          </Field>
        </Grid>

        <div style={{ marginTop: 12 }}>
          <Field label="Observações">
            <textarea
              style={{
                width: "100%",
                minHeight: 90,
                padding: 8,
                boxSizing: "border-box",
              }}
              value={worker.notes}
              onChange={(e) => setWorker({ ...worker, notes: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h3>Decreto-Lei 75/2023</h3>
        <Grid cols={3}>
          <Field label="Antiguidade em 30/08/2023">
            <Input value={`${anosReferencia} anos`} readOnly />
          </Field>

          <Field label="Elegível para a regra dos 6 pontos">
            <Input value={elegivel6 ? "Sim" : "Não"} readOnly />
          </Field>

          <Field label="Já usufruiu">
            <Select
              value={decree75.used ? "Sim" : "Não"}
              onChange={(e) =>
                setWorker({ ...worker, usufruiu6: e.target.value === "Sim" })
              }
            >
              <option>Não</option>
              <option>Sim</option>
            </Select>
          </Field>

          <Field label="Data de usufruto">
            <Input
              type="date"
              value={decree75.usedDate}
              onChange={(e) =>
                setWorker({ ...worker, dataUsufruto6: e.target.value })
              }
            />
          </Field>
        </Grid>
      </Card>

      <Card>
        <h3>Relatório Decreto-Lei 75/2023</h3>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <h4 style={{ marginBottom: 8 }}>
              Trabalhadores com direito ao decreto
            </h4>
            {decree75Eligible.length === 0 ? (
              <div>Sem registos.</div>
            ) : (
              decree75Eligible.map((r) => (
                <div
                  key={`eligible-${r.id}`}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 6,
                  }}
                >
                  <strong>{r.number}</strong> | {r.name} — {r.anosReferencia}{" "}
                  anos
                </div>
              ))
            )}
          </div>

          <div>
            <h4 style={{ marginBottom: 8 }}>Trabalhadores que já usufruíram</h4>
            {decree75Used.length === 0 ? (
              <div>Sem registos.</div>
            ) : (
              decree75Used.map((r) => (
                <div
                  key={`used-${r.id}`}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 6,
                    background: "#ecfdf5",
                  }}
                >
                  <strong>{r.number}</strong> | {r.name} —{" "}
                  {r.usedDate || "Data não definida"}
                </div>
              ))
            )}
          </div>

          <div>
            <h4 style={{ marginBottom: 8 }}>
              Trabalhadores com direito e que ainda não usufruíram
            </h4>
            {decree75EligibleNotUsed.length === 0 ? (
              <div>Sem registos.</div>
            ) : (
              decree75EligibleNotUsed.map((r) => (
                <div
                  key={`notused-${r.id}`}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 6,
                  }}
                >
                  <strong>{r.number}</strong> | {r.name} — Pontos acumulados:{" "}
                  {r.points}
                  {r.canUseNow ? " — Pode usar já" : ""}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <div id="print-area" style={{ display: "none" }} />

      <Card>
        <h3>Avaliação</h3>
        {results.map((r) => (
          <div
            key={r.period}
            style={{
              border: "1px solid #ccc",
              marginBottom: 10,
              padding: 10,
              background: r.progressed ? "#ecfdf5" : "#fff",
            }}
          >
            <div>
              <b>{r.period}</b>
            </div>

            <Grid cols={8}>
              <Field label="Posição inicial">
                <Input value={r.start} readOnly />
              </Field>

              <Field label="Pontos iniciais">
                {r.period === "2023/2024" ? (
                  <Input
                    type="number"
                    value={worker.initial}
                    onChange={(e) =>
                      setWorker({ ...worker, initial: e.target.value })
                    }
                  />
                ) : (
                  <Input value={r.initial} readOnly />
                )}
              </Field>

              <Field label="Pontos atribuídos">
                <Input
                  type="number"
                  value={worker.points[r.period]}
                  onChange={(e) =>
                    setWorker({
                      ...worker,
                      points: {
                        ...worker.points,
                        [r.period]: e.target.value,
                      },
                    })
                  }
                />
              </Field>

              <Field label="Pontos sobrantes">
                <Input value={r.remaining} readOnly />
              </Field>

              <Field label="Regra aplicada">
                <Input value={r.rule} readOnly />
              </Field>

              <Field label="Progressão">
                <Input value={r.progressed ? "Sim" : "Não"} readOnly />
              </Field>

              <Field label="Posição no fim do período">
                <Input
                  value={worker.override?.[r.period] ?? r.final}
                  onChange={(e) =>
                    setWorker({
                      ...worker,
                      override: {
                        ...worker.override,
                        [r.period]: e.target.value,
                      },
                    })
                  }
                />
              </Field>

              <Field label="Nível">
                <Input
                  value={worker.levels?.[r.period] ?? ""}
                  onChange={(e) =>
                    setWorker({
                      ...worker,
                      levels: {
                        ...(worker.levels || {}),
                        [r.period]: e.target.value,
                      },
                    })
                  }
                />

                {(r.level || worker.level) && !worker.levels?.[r.period] ? (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Nível anterior: {r.level || worker.level}
                  </div>
                ) : null}

                {r.progressed ? (
                  <div style={{ fontSize: 12, color: "#92400e" }}>
                    Houve progressão neste ciclo. Confirma e atualiza o nível.
                  </div>
                ) : null}
              </Field>

              <Field label="Data de mudança nível/escalão">
                <Input
                  type="date"
                  value={
                    worker.levelChangeDates?.[r.period] ||
                    r.levelChangeDate ||
                    ""
                  }
                  onChange={(e) =>
                    setWorker({
                      ...worker,
                      levelChangeDates: {
                        ...(worker.levelChangeDates || {}),
                        [r.period]: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            </Grid>
          </div>
        ))}
      </Card>

      <Card>
        <h3>Resultado final</h3>
        <div>
          Posição final: <b>{results[results.length - 1]?.final}</b>
        </div>
        <div>
          Pontos sobrantes: <b>{results[results.length - 1]?.remaining}</b>
        </div>
      </Card>
    </div>
  );
}
