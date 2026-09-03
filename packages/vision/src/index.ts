// Hands: detection and the on-blast trigger.

// Body: pose landmarks and shoulder posture.
export { createMediaPipeBodyDetector } from "./body/mediapipeBodyDetector";
export type { PostureConfig, PostureMetrics } from "./body/posture";
export { DEFAULT_POSTURE, detectPosture, NO_POSTURE } from "./body/posture";
export type { BodyDetector, BodyFrame, BodyLandmark } from "./body/types";
export type { DrawHandOptions } from "./hands/landmarks";
export { drawHand, HAND_CONNECTIONS, palmSpan } from "./hands/landmarks";
export { createMediaPipeHandDetector } from "./hands/mediapipeDetector";
export type { OnBlastConfig, OnBlastMetrics } from "./hands/onBlast";
export { DEFAULT_ON_BLAST, detectOnBlast, NO_ON_BLAST, OPEN_PALM } from "./hands/onBlast";
export type { Hand, HandDetector, HandFrame, HandLandmark } from "./hands/types";
export type { Stamped } from "./util/history";
// Timing primitives. Only vision consumes these today; they would justify
// their own package once something else does.
export { History } from "./util/history";
export type { HoldState } from "./util/holdTrigger";
export { HoldTrigger } from "./util/holdTrigger";
