"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./summary.module.css";
import NavBar from "@/components/layout/NavBar";
import { useAuth } from "@/context/AuthContext";
import { subscribeSummary, blankSummary } from "@/lib/summary";
import { subscribeProducts, LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import AppBar from "@/components/layout/AppBar";
import ExportMenu from "@/components/layout/ExportMenu";
import { buildSummaryCsv } from "@/lib/csv-builders";

/* ---------- constants (UI only, no backend) ---------- */

const COLOR_PRIMARY = "#0b3d2e";
const COLOR_MID = "#059669";
const COLOR_LIGHT = "#34d399";
const COLOR_YELLOW = "#ffd23f";
const COLOR_GRAY = "#cbd5e1";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "annual", label: "Annual" },
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
  { key: "daily", label: "Daily" },
];

const SUMMARY_DATA = {
  all: {
    title: "All Time",
    note: "2022 - 2026",
    labels: ["2022", "2023", "2024", "2025", "2026"],
    sales: [310000, 420000, 515000, 640000, 735000],
    gross: [140000, 190000, 236000, 298000, 345000],
    net: [52000, 76000, 98000, 131000, 158000],
    prevNet: [40000, 52000, 76000, 98000, 131000],
    cashIn: [295000, 405000, 498000, 615000, 702000],
    cashOut: [270000, 372000, 455000, 556000, 630000],
    change: { sales: 14.8, spending: 9.6, cash: 11.2 },
    avgStock: 1240,
    rankScale: 20,
  },
  annual: {
    title: "This Year",
    note: "Jan - Dec 2026",
    labels: ["Q1", "Q2", "Q3", "Q4"],
    sales: [168000, 182000, 195000, 210000],
    gross: [78000, 84000, 90000, 97000],
    net: [34000, 37000, 40000, 44000],
    prevNet: [30000, 32000, 35000, 38000],
    cashIn: [160000, 174000, 186000, 200000],
    cashOut: [141000, 150000, 158000, 167000],
    change: { sales: 12.4, spending: 8.1, cash: 9.7 },
    avgStock: 1180,
    rankScale: 8,
  },
  monthly: {
    title: "This Month",
    note: "October 2026",
    labels: ["W1", "W2", "W3", "W4", "W5"],
    sales: [14200, 16800, 15400, 18900, 17100],
    gross: [6600, 7900, 7100, 8800, 8000],
    net: [2900, 3600, 3100, 4000, 3500],
    prevNet: [2600, 3000, 3200, 3300, 3100],
    cashIn: [13500, 15900, 14800, 17600, 16400],
    cashOut: [12100, 13400, 13100, 14800, 14200],
    change: { sales: 6.3, spending: 7.4, cash: 3.9 },
    avgStock: 1120,
    rankScale: 2,
  },
  weekly: {
    title: "This Week",
    note: "Mon - Sun",
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    sales: [2100, 2400, 2250, 2800, 3600, 4300, 3100],
    gross: [980, 1120, 1050, 1300, 1690, 2010, 1450],
    net: [420, 500, 460, 590, 780, 930, 640],
    prevNet: [380, 450, 470, 520, 700, 820, 610],
    cashIn: [2000, 2300, 2100, 2650, 3400, 4100, 2900],
    cashOut: [1800, 1950, 1900, 2200, 2700, 3100, 2400],
    change: { sales: 4.1, spending: 2.8, cash: 5.6 },
    avgStock: 1085,
    rankScale: 1,
  },
  daily: {
    title: "Today",
    note: "8am - 6pm",
    labels: ["8am", "10am", "12pm", "2pm", "4pm", "6pm"],
    sales: [180, 420, 860, 610, 740, 520],
    gross: [84, 196, 400, 285, 345, 243],
    net: [36, 88, 176, 122, 150, 104],
    prevNet: [30, 80, 160, 130, 132, 96],
    cashIn: [170, 400, 820, 580, 700, 490],
    cashOut: [150, 330, 610, 470, 520, 400],
    change: { sales: -2.3, spending: -4.5, cash: 1.8 },
    avgStock: 1070,
    rankScale: 0.2,
  },
};

const SPENDING_BREAKDOWN = [
  { name: "Stock Purchase", percent: 42, color: COLOR_PRIMARY },
  { name: "Salary", percent: 28, color: COLOR_MID },
  { name: "Rent", percent: 12, color: COLOR_LIGHT },
  { name: "Utilities", percent: 8, color: COLOR_YELLOW },
  { name: "Others", percent: 10, color: COLOR_GRAY },
];

const INVENTORY = { value: 86400, inStock: 78, low: 14, out: 8 };

const BEST_SELLERS = [
  { name: "Sugar 1kg", sold: 480 },
  { name: "Cooking Oil 2L", sold: 420 },
  { name: "Rice 5kg", sold: 365 },
  { name: "Flour 1kg", sold: 290 },
  { name: "Instant Noodles", sold: 240 },
];

const SLOW_MOVERS = [
  { name: "Soy Sauce 1L", sold: 38 },
  { name: "Canned Tuna", sold: 30 },
  { name: "Oats 800g", sold: 24 },
  { name: "Olive Oil 500ml", sold: 16 },
  { name: "Tea Leaves 250g", sold: 9 },
];

const LOW_STOCK = [
  { name: "Eggs (tray)", left: 4, min: 15 },
  { name: "Cooking Oil 2L", left: 6, min: 20 },
  { name: "Sugar 1kg", left: 9, min: 25 },
  { name: "Rice 5kg", left: 11, min: 20 },
];

/* ---------- helpers ---------- */

const compact = new Intl.NumberFormat("en-MY", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const sum = (list) => list.reduce((total, value) => total + value, 0);
// returns null when there's nothing to compare against
const pct = (current, previous) =>
  previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;

const formatRM = (value) =>
  `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function niceMax(max) {
  const power = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / power;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * power;
}

function smoothPath(points) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];
    const cx = (prev.x + next.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
  }
  return d;
}

/* ---------- small chart components ---------- */

function Trend({ change, inverse = false, suffix = "vs previous" }) {
  if (change === null)
    return <p className={styles.trendNone}>No previous data</p>;
  const up = change >= 0;
  const good = inverse ? !up : up;
  return (
    <p className={good ? styles.trendUp : styles.trendDown}>
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% {suffix}
    </p>
  );
}

function Badge({ change }) {
  if (change === null) return null;
  const up = change >= 0;
  return (
    <span className={up ? styles.badgeUp : styles.badgeDown}>
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function LineChart({ labels, values }) {
  const width = 320;
  const height = 170;
  const padLeft = 38;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 26;

  const yMax = niceMax(Math.max(...values));
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const baseY = padTop + innerHeight;

  const points = values.map((value, i) => ({
    x: padLeft + (innerWidth / (values.length - 1)) * i,
    y: padTop + innerHeight - (value / yMax) * innerHeight,
  }));

  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`}>
      {grid.map((step) => {
        const y = padTop + innerHeight - step * innerHeight;
        return (
          <g key={step}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              className={styles.gridLine}
            />
            <text
              x={padLeft - 6}
              y={y + 3}
              textAnchor="end"
              className={styles.axisText}
            >
              {compact.format(yMax * step)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="rgba(5, 150, 105, 0.12)" />
      <path
        d={line}
        fill="none"
        stroke={COLOR_MID}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {points.map((point, i) => (
        <g key={labels[i]}>
          <circle cx={point.x} cy={point.y} r="3.5" fill={COLOR_MID} />
          <text
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            className={styles.axisText}
          >
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BarChart({ labels, series }) {
  const max = Math.max(...series.flatMap((item) => item.values));

  return (
    <div className={styles.barChartWrapper}>
      <div className={styles.barChart}>
        {labels.map((label, i) => (
          <div className={styles.barGroup} key={label}>
            <div className={styles.barPair}>
              {series.map((item) => (
                <div
                  key={item.name}
                  className={styles.bar}
                  title={`${item.name}: ${formatRM(item.values[i])}`}
                  style={{
                    height: `${(item.values[i] / max) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              ))}
            </div>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        {series.map((item) => (
          <div className={styles.legendItem} key={item.name}>
            <i style={{ backgroundColor: item.color }} />
            <p>{item.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ items, total }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg className={styles.donut} viewBox="0 0 120 120">
      {items.map((item) => {
        const length = (item.percent / 100) * circumference;
        const circle = (
          <circle
            key={item.name}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth="16"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        );
        offset += length;
        return circle;
      })}
      <text x="60" y="56" textAnchor="middle" className={styles.donutLabel}>
        Total
      </text>
      <text x="60" y="72" textAnchor="middle" className={styles.donutValue}>
        {compact.format(total)}
      </text>
    </svg>
  );
}

function RankList({ items, max, color }) {
  return (
    <div className={styles.rankList}>
      {items.map((item) => (
        <div className={styles.rankRow} key={item.name}>
          <p>{item.name}</p>
          <div className={styles.rankTrack}>
            <div
              className={styles.rankFill}
              style={{
                width: `${Math.max((item.sold / max) * 100, 3)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span>{item.sold.toLocaleString("en-MY")}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function SummaryPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const [filter, setFilter] = useState("monthly");
  const [data, setData] = useState(null);
  const [products, setProducts] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    setData(null);
    return subscribeSummary(orgId, filter, setData);
  }, [orgId, filter]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeProducts(orgId, setProducts);
  }, [orgId]);

  const current = data ?? blankSummary(filter);

  const salesTotal = sum(current.sales);
  const spendingTotal = sum(current.spending);
  const grossTotal = sum(current.gross);
  const netTotal = sum(current.net);
  const prevSalesTotal = sum(current.prevSales);
  const prevSpendingTotal = sum(current.prevSpending);
  const prevNetTotal = sum(current.prevNet);
  const cashNet = salesTotal - spendingTotal;

  const compare = (now, before) => (current.hasPrev ? pct(now, before) : null);
  const salesChange = compare(salesTotal, prevSalesTotal);
  const spendingChange = compare(spendingTotal, prevSpendingTotal);
  const profitChange = compare(netTotal, prevNetTotal);

  const grossMargin = salesTotal > 0 ? (grossTotal / salesTotal) * 100 : 0;
  const netMargin = salesTotal > 0 ? (netTotal / salesTotal) * 100 : 0;

  const kpis = [
    { label: "Sales", value: formatRM(salesTotal), change: salesChange },
    { label: "Profit", value: formatRM(netTotal), change: profitChange },
    {
      label: "Spending",
      value: formatRM(spendingTotal),
      change: spendingChange,
      inverse: true,
    },
    { label: "Cash Flow", value: formatRM(cashNet), change: profitChange },
  ];

  // ── Inventory (live, independent of the period filter) ──
  const stock = useMemo(() => {
    const list = products ?? [];
    const total = list.length;
    const out = list.filter((p) => p.stock <= 0).length;
    const low = list.filter(
      (p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD,
    ).length;
    const unitsByCategory = {};
    list.forEach((p) => {
      unitsByCategory[p.category] =
        (unitsByCategory[p.category] ?? 0) + p.stock;
    });
    const pctOf = (n) => (total ? Math.round((n / total) * 100) : 0);
    return {
      total,
      out,
      low,
      inStock: total - out - low,
      pctIn: pctOf(total - out - low),
      pctLow: pctOf(low),
      pctOut: pctOf(out),
      value: list.reduce((s, p) => s + p.cost * p.stock, 0),
      units: list.reduce((s, p) => s + p.stock, 0),
      alerts: list
        .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
      byCategory: Object.entries(unitsByCategory)
        .map(([name, sold]) => ({ name, sold }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 6),
    };
  }, [products]);

  const barWidth = (n) => `${(n / (stock.total || 1)) * 100}%`;

  const getExportData = () => buildSummaryCsv(current, stock);

  return (
    <>
      <AppBar
        title="Summary"
        actionMenu={<ExportMenu page="summary" getData={getExportData}  />}
      />
      <main className={styles.summaryPage}>
        <section className={styles.topWrapper}>
          <div className={styles.topHeader}>
            <h1>{current.title}</h1>
            <p>{current.note}</p>
          </div>
          <div className={styles.filterWrapper}>
            {FILTERS.map((item) => (
              <button
                key={item.key}
                className={`${styles.filterButton} ${
                  filter === item.key ? styles.filterActive : ""
                }`}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.kpiGrid}>
            {kpis.map((item) => (
              <div className={styles.kpiCard} key={item.label}>
                <h1>
                  {item.label}
                  <span>{item.value}</span>
                  <Trend change={item.change} inverse={item.inverse} />
                </h1>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.sectionHead}>
            <h1>Performance</h1>
            <p>Sales and profit for the selected period</p>
          </div>
          <div className={styles.cardGrid}>
            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHead}>
                <h1>Sales Trend</h1>
                <p>{current.note}</p>
              </div>
              <LineChart labels={current.labels} values={current.sales} />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Gross vs Net Profit</h1>
                <p>Gross = sales minus stock purchases</p>
              </div>
              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <p>Gross margin</p>
                  <h1>{grossMargin.toFixed(1)}%</h1>
                </div>
                <div className={styles.statBox}>
                  <p>Net margin</p>
                  <h1>{netMargin.toFixed(1)}%</h1>
                </div>
              </div>
              <BarChart
                labels={current.labels}
                series={[
                  { name: "Gross", color: COLOR_MID, values: current.gross },
                  { name: "Net", color: COLOR_PRIMARY, values: current.net },
                ]}
              />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Compare Profit</h1>
                <p>This period vs previous period</p>
              </div>
              <div className={styles.compareRow}>
                <div className={styles.compareValue}>
                  <h1>{formatRM(netTotal)}</h1>
                  <span>
                    {current.hasPrev
                      ? `vs ${formatRM(prevNetTotal)}`
                      : "No previous period"}
                  </span>
                </div>
                <Badge change={profitChange} />
              </div>
              <BarChart
                labels={current.labels}
                series={[
                  {
                    name: "This period",
                    color: COLOR_MID,
                    values: current.net,
                  },
                  {
                    name: "Previous",
                    color: COLOR_GRAY,
                    values: current.prevNet,
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.sectionHead}>
            <h1>Cash</h1>
            <p>Money in, money out and where it goes</p>
          </div>
          <div className={styles.cardGrid}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Cash Flow</h1>
                <p>Cash in vs cash out</p>
              </div>
              <div className={styles.compareRow}>
                <div className={styles.compareValue}>
                  <h1>{formatRM(cashNet)}</h1>
                  <span>net cash flow</span>
                </div>
                <Badge change={profitChange} />
              </div>
              <BarChart
                labels={current.labels}
                series={[
                  { name: "Cash in", color: COLOR_MID, values: current.sales },
                  {
                    name: "Cash out",
                    color: COLOR_YELLOW,
                    values: current.spending,
                  },
                ]}
              />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Spending Breakdown</h1>
                <p>By category</p>
              </div>
              {current.breakdown.length === 0 ? (
                <p className={styles.emptyText}>No spending in this period.</p>
              ) : (
                <div className={styles.donutWrapper}>
                  <DonutChart items={current.breakdown} total={spendingTotal} />
                  <div className={styles.donutList}>
                    {current.breakdown.map((item) => (
                      <div className={styles.donutRow} key={item.name}>
                        <i style={{ backgroundColor: item.color }} />
                        <p>{item.name}</p>
                        <span>{item.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.sectionHead}>
            <h1>Stock</h1>
            <p>Current inventory health</p>
          </div>
          <div className={styles.cardGrid}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Stock on Hand</h1>
                <p>Total units across all products</p>
              </div>
              <div className={styles.bigValue}>
                <h1>{stock.units.toLocaleString("en-MY")}</h1>
                <span>units</span>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Inventory</h1>
                <p>Total stock value at cost</p>
              </div>
              <div className={styles.bigValue}>
                <h1>{formatRM(stock.value)}</h1>
              </div>
              <div className={styles.stackBar}>
                <div
                  style={{
                    width: barWidth(stock.inStock),
                    backgroundColor: COLOR_MID,
                  }}
                />
                <div
                  style={{
                    width: barWidth(stock.low),
                    backgroundColor: COLOR_YELLOW,
                  }}
                />
                <div
                  style={{
                    width: barWidth(stock.out),
                    backgroundColor: "#ef4444",
                  }}
                />
              </div>
              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <i style={{ backgroundColor: COLOR_MID }} />
                  <p>In stock {stock.pctIn}%</p>
                </div>
                <div className={styles.legendItem}>
                  <i style={{ backgroundColor: COLOR_YELLOW }} />
                  <p>Low {stock.pctLow}%</p>
                </div>
                <div className={styles.legendItem}>
                  <i style={{ backgroundColor: "#ef4444" }} />
                  <p>Out {stock.pctOut}%</p>
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHead}>
                <h1>Stock by Category</h1>
                <p>Units on hand</p>
              </div>
              {stock.byCategory.length === 0 ? (
                <p className={styles.emptyText}>No products yet.</p>
              ) : (
                <RankList
                  items={stock.byCategory}
                  max={stock.byCategory[0].sold}
                  color={COLOR_MID}
                />
              )}
            </div>

            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHead}>
                <h1>Low Stock Alerts</h1>
                <p>Items about to run out</p>
              </div>
              {stock.alerts.length === 0 ? (
                <p className={styles.emptyText}>Nothing is running low.</p>
              ) : (
                <div className={styles.alertList}>
                  {stock.alerts.map((item) => {
                    const critical = item.stock / LOW_STOCK_THRESHOLD < 0.4;
                    return (
                      <div className={styles.alertRow} key={item.id}>
                        <div className={styles.alertInfo}>
                          <h1>{item.name}</h1>
                          <p>
                            {item.stock} left · min {LOW_STOCK_THRESHOLD}
                          </p>
                        </div>
                        <span
                          className={
                            critical ? styles.alertCritical : styles.alertLow
                          }
                        >
                          {critical ? "Critical" : "Low"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <NavBar></NavBar>
    </>
  );
}
