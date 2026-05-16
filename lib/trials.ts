// ClinicalTrials.gov v2 API wrapper. No auth needed; rate limits are gentle.
// We project the wide CT.gov response down to a Trial record that's easy to
// render. Only the fields we actually surface in the UI are pulled out.

export type TrialPhase =
  | "EARLY_PHASE1"
  | "PHASE1"
  | "PHASE2"
  | "PHASE3"
  | "PHASE4"
  | "NA"
  | string;

export type TrialStatus =
  | "RECRUITING"
  | "ACTIVE_NOT_RECRUITING"
  | "COMPLETED"
  | "TERMINATED"
  | "WITHDRAWN"
  | "NOT_YET_RECRUITING"
  | "ENROLLING_BY_INVITATION"
  | "SUSPENDED"
  | "UNKNOWN"
  | string;

export type Trial = {
  nctId: string;
  title: string;
  status: TrialStatus;
  phases: TrialPhase[];
  conditions: string[];
  interventions: string[];
  sponsor?: string;
  enrollment?: number;
  startDate?: string;
  completionDate?: string;
  studyType?: string;
  url: string;
};

type CTStudy = {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      completionDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
    conditionsModule?: { conditions?: string[] };
    armsInterventionsModule?: {
      interventions?: Array<{ name?: string; type?: string }>;
    };
    designModule?: {
      phases?: string[];
      studyType?: string;
      enrollmentInfo?: { count?: number };
    };
  };
};

const ENDPOINT = "https://clinicaltrials.gov/api/v2/studies";

function projectStudy(s: CTStudy): Trial | null {
  const ps = s.protocolSection ?? {};
  const id = ps.identificationModule?.nctId;
  const title = ps.identificationModule?.briefTitle ?? ps.identificationModule?.officialTitle;
  if (!id || !title) return null;
  return {
    nctId: id,
    title,
    status: ps.statusModule?.overallStatus ?? "UNKNOWN",
    phases: ps.designModule?.phases ?? [],
    conditions: ps.conditionsModule?.conditions ?? [],
    interventions: (ps.armsInterventionsModule?.interventions ?? [])
      .map((i) => i.name)
      .filter((n): n is string => Boolean(n)),
    sponsor: ps.sponsorCollaboratorsModule?.leadSponsor?.name,
    enrollment: ps.designModule?.enrollmentInfo?.count,
    startDate: ps.statusModule?.startDateStruct?.date,
    completionDate: ps.statusModule?.completionDateStruct?.date,
    studyType: ps.designModule?.studyType,
    url: `https://clinicaltrials.gov/study/${id}`,
  };
}

export async function searchTrials(
  query: string,
  opts: { limit?: number; status?: TrialStatus } = {}
): Promise<{ trials: Trial[]; totalCount?: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const params = new URLSearchParams({
    "query.term": query,
    pageSize: String(limit),
    format: "json",
    countTotal: "true",
  });
  if (opts.status) {
    params.set("filter.overallStatus", opts.status);
  }

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ClinicalTrials.gov returned ${res.status}`);
  }
  const body = (await res.json()) as {
    studies?: CTStudy[];
    totalCount?: number;
  };
  const trials = (body.studies ?? [])
    .map(projectStudy)
    .filter((t): t is Trial => t !== null);
  return { trials, totalCount: body.totalCount };
}
