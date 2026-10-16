import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-muted">This costing, drawing or item does not exist, or was deleted.</p>
      <ButtonLink href="/" className="mt-4">Back to costings</ButtonLink>
    </div>
  );
}
