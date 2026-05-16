import type { Report } from "@/lib/types";

const studyCharRows: string[][] = [
  ["Romero Milà et al., 2025", "Observational cohort study", "15", "Electroencephalography (EEG) functional connectivity", "Evolution from infantile epileptic spasms syndrome (IESS) to Lennox-Gastaut syndrome (LGS), treatment response", "No"],
  ["Kobayashi et al., 2009", "Observational (cross-sectional)", "20", "EEG gamma rhythms", "Pathophysiology of tonic seizures", "No"],
  ["Bare et al., 1998", "Observational (cross-sectional)", "38", "EEG (video monitoring)", "Identification of atypical absence seizures", "No"],
  ["Hödl et al., 2021", "Observational (cross-sectional)", "7", "Heart rate variability (HRV)", "Autonomic imbalance, vagus nerve stimulation (VNS) response", "No"],
  ["Deering et al., 2024", "Retrospective observational cohort", "33", "EEG slow spike-wave (SSW), clinical markers", "Seizure-free periods, SSW as early biomarker", "No"],
  ["Dalic et al., 2022a", "Randomized controlled trial", "17", "EEG generalized paroxysmal fast activity (GPFA), electrographic seizures", "Deep brain stimulation (DBS) response, seizure frequency", "No"],
  ["Cho et al., 2025", "Observational (cohort)", "14", "SEEG indices (EI, CEI, spikes, HFOs)", "Epileptogenic zone network (EZN) mapping, surgical outcome", "No"],
  ["Zhou et al., 2025", "Observational (retrospective)", "Not reported in abstract", "EEG GPFA, mutual information (MI)", "Steroid response, network topology", "No"],
  ["Bullinger et al., 2025", "Experimental (clinical trial)", "Not reported in abstract", "Thalamic EEG (ictal/interictal)", "Ictal/interictal patterns, closed-loop stimulation", "No"],
  ["Yagi, 2015", "Observational (retrospective cohort)", "Not reported in abstract", "EEG (polysomnography)", "Seizure types, sleep effects, pathophysiology", "No"],
];

const eegRows: string[][] = [
  ["Romero Milà et al., 2025", "Functional connectivity", "Cross-correlation EEG", "Correlates with LGS evolution, treatment response", "Moderate"],
  ["Kobayashi et al., 2009", "Gamma rhythms", "Spectral EEG", "Pathophysiology of tonic seizures", "Moderate"],
  ["Bare et al., 1998", "Atypical absence, SSW", "Video EEG", "Diagnostic accuracy", "High"],
  ["Deering et al., 2024", "SSW", "EEG", "Early biomarker, predictive", "High"],
  ["Dalic et al., 2022a", "GPFA, electrographic seizures", "Sleep EEG", "DBS response prediction", "High"],
  ["Cho et al., 2025", "EI, CEI, spikes, HFOs", "SEEG", "EZN mapping, surgical outcome", "Moderate"],
  ["Zhou et al., 2025", "GPFA, MI", "Scalp EEG", "Steroid response prediction", "Moderate"],
  ["Bullinger et al., 2025", "Ictal/interictal patterns", "Thalamic EEG", "Closed-loop stimulation", "Moderate"],
  ["Yagi, 2015", "SSW, fast rhythms", "Polysomnography", "Seizure type, sleep effects", "High"],
  ["Dalic et al., 2022b", "GPFA", "EEG", "DBS response", "High"],
];

const neuroRows: string[][] = [
  ["Hödl et al., 2021", "Heart rate variability (high-frequency power)", "Video-EEG, HRV analysis", "Autonomic imbalance, SUDEP risk", "Low"],
  ["Bullinger et al., 2025", "Thalamic EEG patterns", "Intracranial EEG", "Closed-loop stimulation", "Moderate"],
  ["Badawy et al., 2012", "Cortical excitability", "Transcranial magnetic stimulation (TMS)", "Pathophysiology", "Low"],
  ["Warren et al., 2024a", "Thalamocortical activity", "Intracranial EEG", "Network mapping", "Moderate"],
  ["Warren et al., 2024b", "Thalamocortical activity", "Intracranial EEG", "Network mapping", "Moderate"],
];

const molecularRows: string[][] = [
  ["Cherkezzade et al., 2024", "GFAP, HMGB1, CHI3L1, sCD163, TREM2", "Serum ELISA", "Neuroinflammation, prognosis", "Low"],
  ["Kumar et al., 2015", "P-glycoprotein", "PBMC assay", "Drug resistance", "Low"],
  ["Espinosa Zacarías et al., 2002", "CSF immunoglobulin G (IgG)", "CSF analysis", "IVIG response", "Low"],
  ["Widdess-Walsh et al., 2013", "De novo mutations, chromosome analysis", "Blood, exome sequencing", "Genetic etiology", "Low"],
  ["Ennaim et al., 2013", "Brain atrophy (voxel-based morphometry)", "MRI", "Network mapping", "Moderate"],
  ["Balfroid et al., 2023", "FDG-PET hypometabolism", "PET", "Network mapping, cognitive status", "Moderate"],
  ["Alanazi et al., 2022", "Centromedian nucleus activity, MRI", "Imaging, EEG", "DBS targeting", "Moderate"],
  ["Micheu et al., 2012", "CT, MRI, US", "Imaging", "Early diagnosis", "Low"],
  ["Pedersen et al., 2015", "fMRI network properties", "fMRI", "Network mapping", "Low"],
];

const references = [
  { id: "ref-1", title: "Paroxysmal fast activity is a biomarker of treatment response in deep brain stimulation for Lennox–Gastaut syndrome", authors: ["Linda J. Dalic", "Aaron E. L. Warren", "Chloe Spiegel", "W. Thevathasan", "A. Roten", "+2"], year: 2022, journal: "Epilepsia", fullTextAvailable: true },
  { id: "ref-2", title: "The Association Between Serum Levels of Glial Biomarkers, Clinical Severity and EEG Features in Idiopathic West and Lennox-Gastaut Syndromes", authors: ["Minara Cherkezzade", "Selen Soylu", "E. Tüzün", "V. Yılmaz", "Mine Sezgin", "+3"], year: 2024, journal: "Nöropsikiyatri arşivi", fullTextAvailable: true },
  { id: "ref-3", title: "A systematic review of electroencephalographic findings in Lennox-Gastaut syndrome", authors: ["Firoz M. Nizami", "Sweety Trivedi", "J. Kalita"], year: 2024, journal: "Epilepsy Research", fullTextAvailable: true },
  { id: "ref-4", title: "Role of P-Glycoprotein in Refractoriness of Seizures to Antiepileptic Drugs in Lennox-Gastaut Syndrome", authors: ["Achal Kumar", "D. Tripathi", "V. Paliwal", "Z. Neyaz", "V. Agarwal"], year: 2015, journal: "Journal of Child Neurology", fullTextAvailable: true },
  { id: "ref-5", title: "Discovering EEG biomarkers of Lennox–Gastaut syndrome through unsupervised time-frequency analysis", authors: ["Derek K Hu", "M. Pinto-Orellana", "Mandeep Rana", "Linda Do", "David J Adams", "+3"], year: 2024, journal: "Epilepsia", fullTextAvailable: true },
  { id: "ref-6", title: "Brain regions with abnormal network properties in severe epilepsy of Lennox-Gastaut phenotype", authors: ["M. Pedersen", "E. Curwood", "J. Archer", "D. Abbott", "G. Jackson"], year: 2015, journal: "Epilepsia", fullTextAvailable: true },
  { id: "ref-7", title: "Automatic detection of generalized paroxysmal fast activity in Lennox-Gastaut syndrome using a bi-modal EEG time-frequency feature", authors: ["Amir H. Omidvarnia", "Aaron E. L. Warren", "Linda J. Dalic", "M. Pedersen", "J. Archer", "+1"], year: 2020, fullTextAvailable: false },
  { id: "ref-8", title: "Automatic detection of generalized paroxysmal fast activity in interictal EEG using time-frequency analysis", authors: ["Amir H. Omidvarnia", "Aaron E. L. Warren", "Linda J. Dalic", "M. Pedersen", "G. Jackson"], year: 2021, journal: "Computers in Biology and Medicine", fullTextAvailable: false },
  { id: "ref-9", title: "Management of Lennox-Gastaut syndrome with deep brain stimulation: A systematic literature review", authors: ["Rahaf F Alanazi", "A. Alkhani"], year: 2022, journal: "Neurosciences", fullTextAvailable: true },
  { id: "ref-10", title: "Lennox-Gastaut syndrome and phenotype: Secondary network epilepsies", authors: ["J. Archer", "Aaron E. L. Warren", "Monique R. Stagnitti", "R. Masterton", "D. Abbott", "+1"], year: 2014, journal: "Epilepsia", fullTextAvailable: true },
].map((r) => ({ ...r, fullTextAvailable: r.fullTextAvailable }));

const report: Report = {
  id: "lennox-gastaut",
  question: "Which biomarkers are most commonly used for seizures associated with Lennox-Gastaut syndrome?",
  tldr: "The most frequent biomarkers for Lennox-Gastaut syndrome seizures are electroencephalographic measurements, specifically SSW and GPFA patterns.",
  date: "August 16, 2025",
  visibility: "public",
  initialView: "report",
  status: {
    gather: { done: true, sourcesFound: 998 },
    screen: { done: true, sourcesIncluded: 34 },
    extract: { done: true, dataPointsExtracted: 170 },
    generate: { done: true },
  },
  methods:
    "We analyzed 34 sources from an initial pool of 998, using 6 screening criteria. Each paper was reviewed for 5 key aspects that mattered most to the research question.",
  report: [
    { kind: "sectionLabel", text: "Abstract" },
    {
      kind: "paragraph",
      text: "Electroencephalography metrics appear most frequently for seizures in Lennox-Gastaut syndrome. Ten studies report slow spike-wave (SSW) patterns, and seven document generalized paroxysmal fast activity (GPFA); other EEG features (such as gamma rhythms, paroxysmal fast activity, and network indices) also support diagnosis and treatment assessment. Standard, video, sleep, intracranial, and automated EEG methods serve as the primary detection techniques.",
      cites: 3,
    },
    {
      kind: "paragraph",
      text: "Imaging biomarkers (MRI, fMRI, PET), serum and cerebrospinal fluid markers, and measures of autonomic or cortical excitability are used less often. Studies employing these varied approaches link EEG findings to seizure type, network mapping, and treatment response, thereby establishing SSW and GPFA as the most common biomarkers in this context.",
      cites: 2,
    },

    { kind: "sectionLabel", text: "Results" },
    { kind: "heading", level: 3, text: "Characteristics of Included Studies" },
    {
      kind: "table",
      columns: ["Study", "Study Design", "Population Size", "Biomarker Types Studied", "Primary Outcomes", "Full text retrieved"],
      rows: studyCharRows,
      viewMore: 24,
    },
    {
      kind: "notes",
      title: "Notes",
      items: [
        { text: '"Full text retrieved": Yes = full text was available for data extraction; No = only abstract was available.' },
      ],
    },
    {
      kind: "notes",
      title: "Summary of Study Characteristics",
      items: [
        {
          text: "Study design:",
          children: [
            { text: "25 studies were observational (cohort, cross-sectional, case-control, retrospective, longitudinal)" },
            { text: "4 studies were interventional (randomized controlled trial, clinical trial, DBS trial, interventional case series)" },
            { text: "2 studies were systematic reviews" },
            { text: "3 studies did not clearly specify study design" },
          ],
        },
        {
          text: "Biomarker types studied (some studies used more than one type):",
          children: [
            { text: "26 studies: EEG-based biomarkers (including scalp EEG, SEEG, intracranial EEG, EEG-fMRI, and related indices)" },
            { text: "8 studies: Imaging-based biomarkers (MRI, fMRI, PET, CT, US)" },
            { text: "3 studies: Blood/serum/CSF-based biomarkers (serum glial markers, P-glycoprotein, CSF IgG)" },
            { text: "1 study: Genetic biomarkers (exome sequencing)" },
            { text: "1 study: Heart rate variability/autonomic biomarkers" },
            { text: "1 study: TMS (cortical excitability) as a biomarker" },
          ],
        },
        {
          text: "Primary outcomes (some studies had multiple outcomes):",
          children: [
            { text: "12 studies: Treatment response (surgical, DBS, VNS, steroid, IVIG, drug resistance)" },
            { text: "12 studies: Network mapping or EEG-imaging correlation" },
            { text: "11 studies: Seizure types, features, or phenotyping" },
            { text: "6 studies: Biomarker validation or method development" },
            { text: "5 studies: Pathophysiology or mechanism" },
            { text: "2 studies: Prognosis or cluster analysis" },
          ],
        },
      ],
    },

    { kind: "heading", level: 3, text: "Primary Biomarker Categories" },
    { kind: "heading", level: 4, text: "EEG-Based Biomarkers" },
    {
      kind: "table",
      columns: ["Study", "Biomarker Pattern", "Detection Method", "Clinical Validation Status", "Frequency of Use"],
      rows: eegRows,
      viewMore: 13,
    },
    {
      kind: "notes",
      title: "Key findings",
      items: [
        { text: "Most frequently reported patterns: SSW (10 studies). GPFA (7 studies). PFA (4 studies). Other patterns 1–2 studies each." },
        { text: "Detection methods: Standard EEG most common (9 studies); 11+ other EEG modalities documented." },
        { text: "Frequency of use: 11 studies High, 10 Moderate, 2 Low." },
      ],
    },

    { kind: "heading", level: 4, text: "Neurophysiological Biomarkers" },
    {
      kind: "table",
      columns: ["Study", "Biomarker", "Detection Method", "Clinical Context", "Frequency of Use"],
      rows: neuroRows,
    },

    { kind: "heading", level: 4, text: "Molecular and Other Biomarkers" },
    {
      kind: "table",
      columns: ["Study", "Biomarker", "Detection Method", "Clinical Purpose", "Frequency of Use"],
      rows: molecularRows,
    },

    { kind: "heading", level: 3, text: "Summary" },
    {
      kind: "paragraph",
      text: "EEG-based biomarkers (SSW and GPFA) were the most commonly reported and validated biomarkers for LGS in the included studies, forming the foundation for diagnosis and monitoring.",
      cites: 2,
    },
    {
      kind: "paragraph",
      text: "Imaging and molecular biomarkers are emerging as important adjuncts, especially for network mapping and understanding mechanisms, but require further validation for routine clinical use.",
      cites: 1,
    },
  ],
  references,
};

export default report;
