"use client";

import { useState } from "react";
import styles from "./summary.module.css";
import NavBar from "@/components/layout/NavBar";

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
const pct = (current, previous) =>
  previous === 0 ? 0 : ((current - previous) / previous) * 100;
const formatRM = (value) => `RM ${Math.round(value).toLocaleString("en-MY")}`;

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
  const up = change >= 0;
  const good = inverse ? !up : up;
  return (
    <p className={good ? styles.trendUp : styles.trendDown}>
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% {suffix}
    </p>
  );
}

function Badge({ change }) {
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
  const [filter, setFilter] = useState("monthly");
  const current = SUMMARY_DATA[filter];

  const salesTotal = sum(current.sales);
  const grossTotal = sum(current.gross);
  const netTotal = sum(current.net);
  const prevNetTotal = sum(current.prevNet);
  const spendingTotal = salesTotal - netTotal;
  const cashNet = sum(current.cashIn) - sum(current.cashOut);
  const profitChange = pct(netTotal, prevNetTotal);

  const grossMargin = (grossTotal / salesTotal) * 100;
  const netMargin = (netTotal / salesTotal) * 100;

  const kpis = [
    {
      label: "Sales",
      value: formatRM(salesTotal),
      change: current.change.sales,
    },
    { label: "Profit", value: formatRM(netTotal), change: profitChange },
    {
      label: "Spending",
      value: formatRM(spendingTotal),
      change: current.change.spending,
      inverse: true,
    },
    {
      label: "Cash Flow",
      value: formatRM(cashNet),
      change: current.change.cash,
    },
  ];

  const inventoryTotal = INVENTORY.inStock + INVENTORY.low + INVENTORY.out;
  const bestMax = BEST_SELLERS[0].sold * current.rankScale;
  const scaleRank = (list) =>
    list.map((item) => ({
      ...item,
      sold: Math.max(Math.round(item.sold * current.rankScale), 1),
    }));

  return (
    <>
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
                <p>Where the money is lost</p>
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
                  <span>vs {formatRM(prevNetTotal)}</span>
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
                <Badge change={current.change.cash} />
              </div>
              <BarChart
                labels={current.labels}
                series={[
                  { name: "Cash in", color: COLOR_MID, values: current.cashIn },
                  {
                    name: "Cash out",
                    color: COLOR_YELLOW,
                    values: current.cashOut,
                  },
                ]}
              />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Spending Breakdown</h1>
                <p>By category</p>
              </div>
              <div className={styles.donutWrapper}>
                <DonutChart items={SPENDING_BREAKDOWN} total={spendingTotal} />
                <div className={styles.donutList}>
                  {SPENDING_BREAKDOWN.map((item) => (
                    <div className={styles.donutRow} key={item.name}>
                      <i style={{ backgroundColor: item.color }} />
                      <p>{item.name}</p>
                      <span>{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.sectionHead}>
            <h1>Stock</h1>
            <p>Inventory health and product ranking</p>
          </div>
          <div className={styles.cardGrid}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Avg Stock</h1>
                <p>Average units on hand</p>
              </div>
              <div className={styles.bigValue}>
                <h1>{current.avgStock.toLocaleString("en-MY")}</h1>
                <span>units</span>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h1>Inventory</h1>
                <p>Total stock value</p>
              </div>
              <div className={styles.bigValue}>
                <h1>{formatRM(INVENTORY.value)}</h1>
              </div>
              <div className={styles.stackBar}>
                <div
                  style={{
                    width: `${(INVENTORY.inStock / inventoryTotal) * 100}%`,
                    backgroundColor: COLOR_MID,
                  }}
                />
                <div
                  style={{
                    width: `${(INVENTORY.low / inventoryTotal) * 100}%`,
                    backgroundColor: COLOR_YELLOW,
                  }}
                />
                <div
                  style={{
                    width: `${(INVENTORY.out / inventoryTotal) * 100}%`,
                    backgroundColor: "#ef4444",
                  }}
                />
              </div>
              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <i style={{ backgroundColor: COLOR_MID }} />
                  <p>In stock {INVENTORY.inStock}%</p>
                </div>
                <div className={styles.legendItem}>
                  <i style={{ backgroundColor: COLOR_YELLOW }} />
                  <p>Low {INVENTORY.low}%</p>
                </div>
                <div className={styles.legendItem}>
                  <i style={{ backgroundColor: "#ef4444" }} />
                  <p>Out {INVENTORY.out}%</p>
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHead}>
                <h1>Stock Ranking</h1>
                <p>Units sold, best sellers and slow movers</p>
              </div>
              <div className={styles.rankWrapper}>
                <div className={styles.rankColumn}>
                  <h2>Best sellers</h2>
                  <RankList
                    items={scaleRank(BEST_SELLERS)}
                    max={bestMax}
                    color={COLOR_MID}
                  />
                </div>
                <div className={styles.rankColumn}>
                  <h2>Slow movers</h2>
                  <RankList
                    items={scaleRank(SLOW_MOVERS)}
                    max={bestMax}
                    color={COLOR_GRAY}
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHead}>
                <h1>Low Stock Alerts</h1>
                <p>Items about to run out</p>
              </div>
              <div className={styles.alertList}>
                {LOW_STOCK.map((item) => {
                  const critical = item.left / item.min < 0.4;
                  return (
                    <div className={styles.alertRow} key={item.name}>
                      <div className={styles.alertInfo}>
                        <h1>{item.name}</h1>
                        <p>
                          {item.left} left · min {item.min}
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
            </div>
          </div>
        </section>
      </main>

      <NavBar></NavBar>
    </>
  );
}
