import Link from "next/link";
import { getWorkspace } from "@/lib/workspace/data";
import { Stories } from "@/components/workspace/stories";
export default async function PreparationPage() {
  const workspace = await getWorkspace();
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Preparação</h1>
          <p className="page-subtitle">
            Transforme sua experiência em respostas claras.
          </p>
        </div>
        <Link className="secondary-link" href="/interview-prep">
          Simulações de entrevista →
        </Link>
      </div>
      <Stories items={workspace.stories} />
    </div>
  );
}
