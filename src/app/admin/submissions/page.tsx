import { listSubmissions } from "@/lib/db";
import { SubmissionsList } from "@/components/admin-submissions";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function AdminSubmissionsPage() {
  const submissions = await listSubmissions();
  return <SubmissionsList initial={submissions} />;
}
