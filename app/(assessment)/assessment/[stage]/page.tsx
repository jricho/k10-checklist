import { notFound } from "next/navigation";
import { StageChecklist } from "../../../../components/checklist/stage-checklist";
import { STAGE_SLUGS, stageIdFromSlug } from "../../../../lib/routes";

// A stage of the assessment, at its own URL.
//
// Server component so the four stages can be prerendered and an unknown slug can
// 404 before any client code runs; the checklist itself is the client component
// underneath. `params` is a promise in this version of Next — awaiting it is not
// optional.

export function generateStaticParams() {
  return STAGE_SLUGS.map(stage => ({ stage }));
}

export default async function StagePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  const stageId = stageIdFromSlug(stage);
  if (!stageId) notFound();

  return <StageChecklist stageId={stageId} />;
}
