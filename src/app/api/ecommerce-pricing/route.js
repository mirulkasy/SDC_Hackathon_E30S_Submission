import { NextResponse } from "next/server";

const PLATFORMS = [
  {
    id: "physical",
    name: "In-Person / Physical Stall (Walk-In / Cash)",
    short: "In-person",
    feePct: 0.0,
  },
  {
    id: "direct",
    name: "Social Media / Direct (WA/IG)",
    short: "WhatsApp / IG",
    feePct: 1.5,
  },
  { id: "tiktok", name: "TikTok Shop", short: "TikTok Shop", feePct: 6.66 },
  { id: "shopee", name: "Shopee", short: "Shopee", feePct: 8.16 },
  { id: "foodpanda", name: "Foodpanda", short: "Foodpanda", feePct: 30.0 },
  { id: "grab", name: "GrabFood", short: "GrabFood", feePct: 30.0 },
];

const r2 = (n) => Math.round(n * 100) / 100;

export async function POST(req) {
  try {
    const { productName, costPrice, targetMargin } = await req.json();

    const cost = parseFloat(costPrice) || 0;
    const marginPct = (parseFloat(targetMargin) || 0) / 100;

    const platformPrices = PLATFORMS.map((p) => {
      const feePct = p.feePct / 100;
      const keepPct = 1 - feePct - marginPct;

      const rawPrice = keepPct > 0 ? cost / keepPct : cost * 1.5;
      const suggestedPrice = Math.ceil(rawPrice * 10) / 10;
      const expectedProfit = r2(suggestedPrice * (1 - feePct) - cost);

      return {
        name: p.name,
        short: p.short,
        feePct: p.feePct,
        suggestedPrice,
        expectedProfit,
      };
    });

    return NextResponse.json({
      productName,
      costPrice,
      targetMargin,
      platformPrices,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to calculate pricing." },
      { status: 500 },
    );
  }
}
