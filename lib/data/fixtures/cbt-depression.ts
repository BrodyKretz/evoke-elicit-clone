import type { Paper, Report } from "@/lib/types";

const papers: Paper[] = [
  {
    id: "cbt-1",
    title: "Internet-based versus face-to-face cognitive-behavioral intervention for depression: a randomized controlled non-inferiority trial.",
    authors: ["B. Wagner", "A. Horn", "A. Maercker"],
    year: 2014,
    journal: "Journal of Affective Disorders",
    citations: 306,
    doi: "10.1016/j.jad.2013.06.032",
    fullTextAvailable: true,
    summary:
      "Internet-based and face-to-face CBT are equally effective for depression; small sample size (n=62) limits evidence strength; randomized non-inferiority trial with intention-to-treat analysis.",
  },
  {
    id: "cbt-2",
    title: "Internet-supported versus face-to-face cognitive behavior therapy for depression",
    authors: ["G. Andersson", "Naira Topooco", "O. Havik", "T. Nordgreen"],
    year: 2016,
    journal: "Expert Review of Neurotherapeutics",
    citations: 113,
    doi: "10.1586/14737175.2016.1125783",
    fullTextAvailable: true,
    summary:
      "Guided ICBT has a small effect size advantage over face-to-face CBT for depression, but the difference is not clinically significant; based on a meta-analysis of five studies with 429 participants.",
  },
  {
    id: "cbt-3",
    title: "The Use of Computerized Self-Help Packages to Treat Adolescent Depression and Anxiety",
    authors: ["Suvena Sethi", "Andrew J. Campbell", "L. Ellis"],
    year: 2010,
    citations: 129,
    doi: "10.1080/15228835.2010.508317",
    fullTextAvailable: false,
    summary:
      "Combined face-to-face/online CBT is more effective than standalone online or face-to-face therapy for depression; N = 38 participants; random allocation to conditions.",
  },
  {
    id: "cbt-4",
    title: "A randomised controlled trial of face to face versus pure online self-help cognitive behavioural treatment for perfectionism.",
    authors: ["S. Egan", "Emily van Noort", "Abby Chee", "R. Kane", "Kimberley J. Hoiles", "+2"],
    year: 2014,
    journal: "Behaviour Research and Therapy",
    citations: 98,
    doi: "10.1016/j.brat.2014.10.009",
    fullTextAvailable: false,
    summary:
      "Face-to-face CBT is effective in reducing depression, but online self-help is not; small sample size (n=18 face-to-face, n=16 online), randomized controlled trial with 6-month follow-up.",
  },
  {
    id: "cbt-5",
    title: "A systematic review of digital and face-to-face cognitive behavioral therapy for depression",
    authors: ["L. Kambeitz-Ilankovic", "Uma Rzayeva", "Laura Völkel", "J. Wenzel", "J. Weiske", "+5"],
    year: 2022,
    journal: "npj Digital Medicine",
    citations: 55,
    doi: "10.1038/s41746-022-00677-8",
    fullTextAvailable: true,
    summary:
      "Face-to-face CBT initially shows superior effectiveness over digital CBT for depression symptoms and adherence, but after adjusting for differences, both approaches are similarly effective; based on a systematic review of 106 studies with 11,854 patients.",
  },
  {
    id: "cbt-6",
    title: "Therapist-supported Internet cognitive behavioural therapy for anxiety disorders in adults",
    authors: ["P. Carlbring", "G. Andersson", "P. Cuijpers", "H. Riper", "E. Hedman-Lagerlöf"],
    year: 2018,
    journal: "Cognitive Behaviour Therapy",
    citations: 422,
    doi: "10.1080/16506073.2017.1401115",
    fullTextAvailable: true,
    summary:
      "Therapist-supported ICBT yields equivalent outcomes to face-to-face CBT across anxiety and depression diagnoses; effect-size pooled g = 0.05 favoring ICBT; meta-analysis of 1418 participants.",
  },
  {
    id: "cbt-7",
    title: "Comparative effectiveness of guided internet-based vs. face-to-face cognitive behavior therapy: An individual participant data meta-analysis",
    authors: ["H. Lin", "P. Cuijpers", "G. Andersson", "E. Karyotaki"],
    year: 2021,
    journal: "JAMA Psychiatry",
    citations: 198,
    doi: "10.1001/jamapsychiatry.2020.4364",
    fullTextAvailable: true,
    summary:
      "Pooled IPD meta-analysis (n=2467) shows non-inferiority of guided ICBT to face-to-face CBT for depression; PHQ-9 reduction Δ = 0.7 points (95% CI -0.5 to 1.9).",
  },
];

const report: Report = {
  id: "cbt-depression",
  question: "How effective is online vs. face-to-face CBT for depression?",
  tldr:
    "Across randomized trials and meta-analyses, guided internet-based CBT shows non-inferiority to face-to-face CBT for depression. Differences in symptom reduction are typically small and not clinically significant.",
  date: "March 4, 2026",
  visibility: "private",
  initialView: "search",
  status: {
    gather: { done: true, sourcesFound: 412 },
    screen: { done: false },
    extract: { done: false },
    generate: { done: false },
  },
  searchResults: papers,
};

export default report;
