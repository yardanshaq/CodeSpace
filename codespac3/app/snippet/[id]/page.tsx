import { permanentRedirect } from "next/navigation";

export default function SnippetRedirect({ params }: { params: { id: string } }) {
  permanentRedirect(`/code?v=${params.id}`);
}