import { AssessmentProvider } from "../../components/checklist/assessment-provider";
import { AppChrome } from "../../components/checklist/app-chrome";

// Route group for the three views of one assessment: the checklist, the
// maturity detail, and the diagnostic captures.
//
// A group rather than the root layout because /design must stay outside it: it
// is a token-comparison surface for maintainers, not part of the assessment, and
// should carry neither the chrome nor the provider. Being a nested layout (the
// root layout still owns <html> and the fonts)
// also means moving between these routes is a client transition, so the
// provider below is not remounted and the session-only diagram survives.

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AssessmentProvider>
      <AppChrome>{children}</AppChrome>
    </AssessmentProvider>
  );
}
