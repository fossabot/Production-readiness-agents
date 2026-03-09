// Release Gate types (data-model.md §3, §4)

export type ReleaseGateStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

export type ReleaseGateCheckStage =
  | 'root-static'
  | 'root-tests'
  | 'desktop-static'
  | 'desktop-tests'
  | 'desktop-build'
  | 'package'
  | 'smoke'
  | 'performance'
  | 'docs';

export type ReleaseGateCheckStatus = 'passed' | 'failed' | 'skipped';

export interface ReleaseGateCheck {
  readonly checkId: string;
  readonly gateRunId: string;
  readonly stage: ReleaseGateCheckStage;
  readonly label: string;
  readonly command: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly status: ReleaseGateCheckStatus;
  readonly required: boolean;
  readonly evidencePath: string | null;
  readonly details: string | null;
}

export interface ReleaseGateResult {
  readonly gateRunId: string;
  readonly candidateId: string;
  readonly startedAt: string;
  finishedAt: string | null;
  status: ReleaseGateStatus;
  readonly platform: 'win' | 'mac' | 'linux' | 'current';
  readonly summary: string;
  readonly blockingReasons: string[];
  readonly checkIds: string[];
  readonly runtimeSessionIds: string[];
  readonly generatedFiles: string[];
}

// Release Candidate types (data-model.md §6)

export type CandidateStatus =
  | 'staged'
  | 'packaged'
  | 'smoke-validated'
  | 'approved'
  | 'rejected';

export interface ReleaseCandidateArtifact {
  readonly candidateId: string;
  readonly version: string;
  readonly platform: 'win' | 'mac' | 'linux';
  readonly createdAt: string;
  status: CandidateStatus;
  readonly artifactPath: string;
  readonly unpackedPath: string | null;
  readonly checksum: string | null;
  readonly runtimeAssetManifestId: string;
  readonly releaseGateRunId: string | null;
  readonly smokeRecordIds: string[];
}

// Smoke Validation types (data-model.md §7)

export type SmokeValidationStatus = 'passed' | 'failed';

export interface SmokeValidationRecord {
  readonly smokeId: string;
  readonly candidateId: string;
  readonly platform: 'win' | 'mac' | 'linux' | 'current';
  readonly recordedAt: string;
  readonly status: SmokeValidationStatus;
  readonly launched: boolean;
  readonly settingsLoaded: boolean;
  readonly policyViewOpened: boolean;
  readonly runStartedOrBlocked: boolean;
  readonly reportOrHistoryVisible: boolean;
  readonly issues: string[];
  readonly evidencePath: string;
}

// Release Sign-off types (data-model.md §8)

export type SignOffStatus = 'draft' | 'approved' | 'rejected';

export interface ReleaseSignOffChecklist {
  readonly signOffId: string;
  readonly candidateId: string;
  readonly releaseGateRunId: string;
  readonly operator: string;
  readonly reviewedAt: string;
  status: SignOffStatus;
  readonly checklistVersion: string;
  readonly docsVersion: string;
  readonly unresolvedItems: string[];
  readonly notes: string | null;
}

// Runtime Asset Manifest types (data-model.md §5)

export interface RuntimeAssetManifest {
  readonly manifestId: string;
  readonly candidateId: string | null;
  readonly generatedAt: string;
  readonly libraryEntryPath: string;
  readonly workerEntryPath: string;
  readonly packaged: boolean;
  readonly sourceDistVersion: string;
  readonly copiedFiles: string[];
}
