// Available SME financial aid in Malaysia.
// Lives here (not in the page file) because Next.js pages may only export
// the default component. Consumed by /aid (and potentially the chat AI).
//
// Links point to official portals where possible. Schemes open, close and
// change criteria with each Budget cycle, so treat this as a directory
// and always confirm the current intake on the provider's site.
//
// type: "loan" | "grant" | "guarantee"

export const SME_AID = [
  {
    id: "bnm_sme_srf",
    title: "SME Stabilisation Relief Facility (SME SRF)",
    provider: "Bank Negara Malaysia",
    type: "loan",
    description:
      "Working capital up to RM750,000 at a maximum 3.75% p.a. for viable SMEs affected by economic shocks, channelled through participating banks.",
    link: "https://www.bnm.gov.my/sme-financing",
  },
  {
    id: "bnm_adf",
    title: "Automation & Digitalisation Facility (ADF)",
    provider: "Bank Negara Malaysia",
    type: "loan",
    description:
      "Financing up to RM5 million per SME at up to 3.75% p.a. (incl. guarantee fee) for automation, digitalisation and technology upgrading.",
    link: "https://www.bnm.gov.my/funds4sme",
  },
  {
    id: "bnm_cgc_guarantee",
    title: "BNM-CGC Guarantee Scheme",
    provider: "Credit Guarantee Corporation (CGC)",
    type: "guarantee",
    description:
      "Up to RM10 billion in guaranteed financing to improve access for unserved and underserved SMEs, including microenterprises.",
    link: "https://www.cgc.com.my",
  },
  {
    id: "sjpp_ggsm4",
    title: "Government Guarantee Scheme (GGSM4)",
    provider: "Syarikat Jaminan Pembiayaan Perniagaan (SJPP)",
    type: "guarantee",
    description:
      "RM30 billion government guarantee covering up to 80% of MSME bank financing (up to RM20 million) for working capital and capex.",
    link: "https://www.sjpp.com.my",
  },
  {
    id: "tekun_niaga",
    title: "TEKUN Niaga Financing",
    provider: "TEKUN Nasional",
    type: "loan",
    description:
      "Islamic microfinancing from RM1,000 to RM100,000 at ~4% p.a. for Bumiputera entrepreneurs, tenures up to 10 years.",
    link: "https://www.tekun.gov.my",
  },
  {
    id: "bsn_micro",
    title: "BSN Micro/i & Mikro-i Madani",
    provider: "Bank Simpanan Nasional (BSN)",
    type: "loan",
    description:
      "Micro loans from RM5,000 to RM100,000 for working capital, renovations and capex, with Madani variants from 3.50% flat p.a.",
    link: "https://www.bsn.com.my",
  },
  {
    id: "mara",
    title: "MARA Entrepreneurship Financing",
    provider: "Majlis Amanah Rakyat (MARA)",
    type: "loan",
    description:
      "Financing and entrepreneurship programmes for Bumiputera SMEs across manufacturing, services, tourism and technology sectors.",
    link: "https://www.mara.gov.my",
  },
  {
    id: "aim",
    title: "AIM Microfinancing",
    provider: "Amanah Ikhtiar Malaysia (AIM)",
    type: "loan",
    description:
      "Shariah-compliant microfinancing for low-income households and micro-entrepreneurs to start or grow small businesses.",
    link: "https://www.aim.gov.my",
  },
  {
    id: "sme_corp_bap",
    title: "Business Accelerator Programme (BAP)",
    provider: "SME Corp Malaysia",
    type: "grant",
    description:
      "50% matching grant up to RM400,000 for machinery, ICT adoption, ESG, certification and marketing for certified SMEs.",
    link: "https://www.smecorp.gov.my",
  },
  {
    id: "mdec_sdmg",
    title: "SME Digitalisation Matching Grant",
    provider: "Malaysia Digital Economy Corporation (MDEC)",
    type: "grant",
    description:
      "Co-funds 50% of qualifying digital tools — accounting software, POS, e-commerce, CRM and cloud — for eligible SMEs.",
    link: "https://mdec.my",
  },
  {
    id: "matrade_mdg",
    title: "Market Development Grant (MDG)",
    provider: "MATRADE",
    type: "grant",
    description:
      "Reimburses eligible export promotion costs — trade fairs, market research and overseas marketing — for Malaysian exporters.",
    link: "https://www.matrade.gov.my",
  },
  {
    id: "cradle_cip",
    title: "CIP Sprint",
    provider: "Cradle Fund",
    type: "grant",
    description:
      "Conditional commercialisation grant of up to RM600,000 over 18 months for tech startups with early market traction.",
    link: "https://www.cradle.com.my",
  },
  {
    id: "sme_bank",
    title: "SME Bank Financing Programmes",
    provider: "SME Bank",
    type: "loan",
    description:
      "Soft financing for MSMEs incl. HalalBiz, Low Carbon Transition Facility, STTF and women entrepreneur financing (MySMELady).",
    link: "https://www.smebank.com.my",
  },
  {
    id: "midf",
    title: "MIDF Soft Loans",
    provider: "Malaysian Industrial Development Finance (MIDF)",
    type: "loan",
    description:
      "Soft financing for manufacturing and services SMEs — technology acquisition, green technology and automation upgrades.",
    link: "https://www.midf.com.my",
  },
  {
    id: "exim",
    title: "EXIM Bank Financing",
    provider: "Export-Import Bank of Malaysia (EXIM)",
    type: "loan",
    description:
      "Soft loans and export credit facilities for companies expanding overseas or affected by global trade tensions.",
    link: "https://www.exim.com.my",
  },
];

export const AID_TYPES = {
  loan: { label: "Loan / Financing", className: "typeLoan" },
  grant: { label: "Grant", className: "typeGrant" },
  guarantee: { label: "Guarantee Scheme", className: "typeGuarantee" },
};

export function getAidById(id) {
  return SME_AID.find((a) => a.id === id) ?? null;
}
