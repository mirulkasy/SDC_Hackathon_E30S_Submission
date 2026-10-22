// Constant compliance checklist for Malaysian SMEs.
// Lives here (not in the page file) because Next.js pages may only export
// the default component. Progress is stored per organization in
// organizations/{orgId}/checklist/{itemId}; this file only holds the template.
//
// frequency: "one-time" | "monthly" | "yearly" | "periodic"
export const CHECKLIST = [
  {
    id: "ssm",
    title: "SSM Registration",
    items: [
      {
        id: "ssm_registered",
        title: "SSM registered",
        description:
          "Register your business or company with the Companies Commission of Malaysia (SSM).",
        frequency: "one-time",
      },
      {
        id: "ssm_certificate_displayed",
        title: "Certificate displayed at premises",
        description:
          "Display your business registration certificate where customers can see it.",
        frequency: "one-time",
      },
      {
        id: "ssm_renewal",
        title: "Registration renewed",
        description:
          "Business registrations expire. Renew before the expiry date on your certificate.",
        frequency: "periodic",
      },
      {
        id: "ssm_annual_return",
        title: "Annual return filed (companies)",
        description:
          "Companies must file an annual return with SSM every year.",
        frequency: "yearly",
      },
      {
        id: "ssm_beneficial_ownership",
        title: "Beneficial ownership up to date",
        description:
          "Keep the details of the people who own or control the business current with SSM.",
        frequency: "periodic",
      },
    ],
  },
  {
    id: "tax",
    title: "Tax",
    items: [
      {
        id: "tax_tin",
        title: "Tax Identification Number (TIN)",
        description:
          "Register the business with LHDN and keep your TIN ready for filing and e-Invoice.",
        frequency: "one-time",
      },
      {
        id: "tax_return",
        title: "Annual income tax return filed",
        description:
          "File Form B (sole proprietor / partnership) or Form C (company) through MyTax.",
        frequency: "yearly",
      },
      {
        id: "tax_estimate",
        title: "Tax estimate submitted (companies)",
        description:
          "Companies submit an estimate of tax payable (CP204) and pay by instalments.",
        frequency: "yearly",
      },
      {
        id: "tax_sst",
        title: "SST registration checked",
        description:
          "Register for Sales and Service Tax if your taxable turnover passes the threshold, then file returns on time.",
        frequency: "periodic",
      },
      {
        id: "tax_einvoice",
        title: "e-Invoice (MyInvois) ready",
        description:
          "Confirm if your turnover requires e-Invoicing and set up your system to issue valid invoices.",
        frequency: "one-time",
      },
      {
        id: "tax_records",
        title: "Accounting records kept for 7 years",
        description:
          "Keep invoices, receipts and bank records in order for at least seven years.",
        frequency: "yearly",
      },
    ],
  },
  {
    id: "employment",
    title: "Employment & Payroll",
    items: [
      {
        id: "emp_epf",
        title: "EPF contributions paid",
        description:
          "Register as an employer with KWSP and pay monthly contributions for your employees.",
        frequency: "monthly",
      },
      {
        id: "emp_socso",
        title: "SOCSO contributions paid",
        description:
          "Register with PERKESO and pay monthly contributions to cover employees under SOCSO.",
        frequency: "monthly",
      },
      {
        id: "emp_eis",
        title: "EIS contributions paid",
        description:
          "Employment Insurance System contributions are paid together with SOCSO.",
        frequency: "monthly",
      },
      {
        id: "emp_pcb",
        title: "Monthly tax deduction (PCB) remitted",
        description: "Deduct PCB from salaries and remit it to LHDN.",
        frequency: "monthly",
      },
      {
        id: "emp_hrd",
        title: "HRD Corp levy checked",
        description:
          "Check if your business must register with HRD Corp and pay the monthly levy.",
        frequency: "monthly",
      },
      {
        id: "emp_minimum_wage",
        title: "Minimum wage met",
        description:
          "Make sure every employee is paid at least the current minimum wage.",
        frequency: "yearly",
      },
    ],
  },
  {
    id: "licence",
    title: "Licences & Permits",
    items: [
      {
        id: "lic_premise",
        title: "Business premise licence",
        description:
          "Get a trading licence from your local council (PBT) for your premises.",
        frequency: "yearly",
      },
      {
        id: "lic_signboard",
        title: "Signboard / advertisement permit",
        description:
          "Apply for a permit from your local council if you put up a signboard or advertisement.",
        frequency: "yearly",
      },
      {
        id: "lic_fire",
        title: "Fire safety certificate",
        description:
          "Check with BOMBA if your premises need a fire safety certificate.",
        frequency: "yearly",
      },
      {
        id: "lic_industry",
        title: "Industry permits",
        description:
          "Halal certification, food premise registration or other approvals required for your business type.",
        frequency: "periodic",
      },
    ],
  },
  {
    id: "protection",
    title: "Protection",
    items: [
      {
        id: "prot_insurance",
        title: "Business insurance in place",
        description:
          "Cover your premises, stock and liabilities against loss or damage.",
        frequency: "yearly",
      },
      {
        id: "prot_pdpa",
        title: "Customer data handled under PDPA",
        description:
          "Collect, store and use customer personal data in line with the Personal Data Protection Act.",
        frequency: "one-time",
      },
    ],
  },
];

export const CHECKLIST_TOTAL = CHECKLIST.reduce(
  (sum, group) => sum + group.items.length,
  0,
);
