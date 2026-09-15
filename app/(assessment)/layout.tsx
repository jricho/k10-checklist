import { AssessmentProvider } from "../../components/checklist/assessment-provider";
import { AppChrome } from "../../components/checklist/app-chrome";

// Route group for the three views of one assessment: the checklist, the
// maturity detail, and the diagnostic captures.
//
// A group rather than the root layout because /legacy and /design must stay
// outside it — /legacy carries its own header and footer and would render two of
// each. Being a nested layout (the root layout still owns <html> and the fonts)
// also means moving between these routes is a client transition, so the
// provider below is not remounted and the session-only diagram survives.

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AssessmentProvider>
      <AppChrome>{children}</AppChrome>
    </AssessmentProvider>
  );
}
