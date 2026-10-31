import { getResource, getTask, listCategories } from "@/lib/db";
import { ResourceForm } from "@/components/resource-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: { params: { id: string } }) {
  const [resource, task, categories] = await Promise.all([getResource(params.id), getTask(params.id), listCategories()]);
  if (!resource) notFound();
  return <ResourceForm resource={resource} task={task} categories={categories} isNew={false} />;
}
