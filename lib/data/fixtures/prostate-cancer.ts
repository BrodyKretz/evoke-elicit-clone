import type { Paper, Report } from "@/lib/types";

const sources: Paper[] = [
  {
    id: "pc-1",
    title: "Targeting Neuroendocrine Prostate Cancer: Molecular and Clinical Perspectives",
    authors: ["P. Vlachostergios", "C. Papandreou"],
    year: 2015,
    journal: "Frontiers in Oncology",
    citations: 61,
    fullTextAvailable: true,
    abstract:
      "Neuroendocrine prostate carcinoma, either co-present with the local adenocarcinoma disease or as a result of transdifferentiation later in time, was described as one major process of emerging resistance to androgen deprivation therapies, and at the clinical level it is consistent with the development of rapidly progressive visceral disease, often in the absence of elevated serum prostate-specific antigen level. Until present, platinum-based chemotherapy has been the only treatment modality, able to produce a fair amount of responses but of short duration. Recently, several efforts for molecular characterization of this lethal phenotype have resulted in identification of novel signaling factors involved in microenvironment interactions, mitosis, and neural reprograming as potential therapeutic targets.",
  },
  {
    id: "pc-2",
    title: "Clinical and molecular features of treatment-related neuroendocrine prostate cancer",
    authors: ["H. Beltran", "D. Rickman", "K. Park", "S. Chae"],
    year: 2011,
    journal: "Cancer Discovery",
    citations: 412,
    fullTextAvailable: true,
    abstract:
      "Treatment-related neuroendocrine prostate cancer is an aggressive variant of prostate cancer arising in the context of androgen deprivation therapy. Molecular profiling reveals frequent alterations in TP53, RB1, and amplification of N-Myc, alongside epigenetic reprogramming through EZH2 overexpression. These findings nominate AURKA/N-Myc and EZH2 as candidate therapeutic targets, with early-phase clinical investigations now underway.",
  },
  {
    id: "pc-3",
    title: "P450-dependent enzymes as targets for prostate cancer therapy",
    authors: ["R. Coster", "Walter Wouters", "J. Bruynseels"],
    year: 1996,
    journal: "Journal of Steroid Biochemistry and Molecular Biology",
    citations: 78,
    fullTextAvailable: false,
    abstract:
      "Cytochrome P450-dependent enzymes (17,20-lyase, aromatase) are implicated in steroid and retinoic acid metabolism. Inhibitors including ketoconazole and liarozole fumarate (LIA) target these enzymes to achieve maximal androgen ablation and enhance retinoid-mimetic effects in metastatic prostate adenocarcinoma after relapse from castration.",
  },
  {
    id: "pc-4",
    title: "Feasibility of targeted therapy based on immunohistochemical expression analysis in androgen-independent prostate cancer",
    authors: ["C. Ohlmann", "E. Markert", "M. Gerharz"],
    year: 2008,
    journal: "Der Urologe",
    citations: 24,
    fullTextAvailable: false,
    abstract:
      "Immunohistochemical analysis of 51 androgen-independent prostate cancer specimens identified EGFR positivity in 61.2% of patients. Other receptor tyrosine kinases including PDGFR-β were also expressed, suggesting these targets could direct individualized therapy in late-stage disease.",
  },
];

const extractionColumns = [
  "Paper",
  "Study Design",
  "Participant/Sample Characteristics",
  "Molecular Targets Investigated",
];

const extractionRows = [
  {
    paper: sources[2],
    cells: [
      "Preclinical (in vitro, animal model), Clinical trial",
      "- Type of cancer samples: Metastatic prostate adenocarcinoma\n- Number of samples/patients: Insufficient data\n- Stage of cancer: Metastatic\n- Prior treatment history: Relapse after surgical or medical castration\n- Molecular characteristics: Insufficient data",
      "- Molecular Targets: Cytochrome P450-dependent enzymes (17,20-lyase, aromatase)\n- Method of Investigation: Inhibitors (ketoconazole, newly synthesized steroidal 17,20-lyase inhibitors), liarozole fumarate (LIA)\n- Rationale for Targeting: Achieving maximal androgen ablation, enhancing retinoid-mimetic effects\n- Specific Molecular Characteristics: Involvement in steroid and retinoic acid metabolism",
    ],
  },
  {
    paper: sources[3],
    cells: [
      "Molecular characterization study, Clinical trial (phase II)",
      "- Type of cancer samples: Androgen-independent prostate cancer (AIPC)\n- Number of samples/patients: 51\n- Stage of cancer: Progressive AIPC\n- Prior treatment history: 43 (84.3%) had prior taxane chemotherapy",
      "- EGFR: Method - Immunohistochemical analysis; Rationale - Potential role in cancer progression; Characteristics - Positive staining in 61.2% of patients\n- PDGFR-β: Method - IHC; Rationale - Tumor stroma signaling; Characteristics - Strong cytoplasmic staining in 38% of samples",
    ],
  },
  {
    paper: sources[0],
    cells: [
      "Review (narrative)",
      "- Patient population: Patients with metastatic neuroendocrine prostate cancer who failed androgen deprivation\n- Sample size: Variable across cited studies\n- Stage: Metastatic, visceral disease",
      "- Targets: AURKA, N-Myc, PEG10, EZH2, FOXA1\n- Method: Pharmacologic inhibition (alisertib, GSK126), expression analysis\n- Rationale: Drivers of neuroendocrine transdifferentiation",
    ],
  },
  {
    paper: sources[1],
    cells: [
      "Translational profiling + early-phase clinical trial",
      "- Cohort: 30 patients with t-NEPC vs. 30 with castration-resistant adenocarcinoma\n- Tumor source: Biopsy + circulating tumor cells",
      "- Targets: AURKA/N-Myc axis, EZH2, TP53/RB1 loss-of-function pathways\n- Method: Whole-exome sequencing, IHC, AURKA inhibitor trial\n- Rationale: Selective vulnerability of t-NEPC to AURKA inhibition",
    ],
  },
];

const report: Report = {
  id: "prostate-cancer",
  question:
    "What are the most effective molecular targets for treatment of metastatic neuroendocrine prostate cancer in patients who have failed standard androgen deprivation therapy?",
  tldr:
    "Evoke is building and refining understanding of the research. Report will become available once all steps are complete.",
  date: "May 11, 2026",
  visibility: "private",
  initialView: "gather",
  status: {
    gather: { done: true, sourcesFound: 998 },
    screen: { done: false },
    extract: { done: false },
    generate: { done: false },
  },
  gatheredSources: sources,
  extraction: {
    columns: extractionColumns,
    rows: extractionRows,
  },
};

export default report;
