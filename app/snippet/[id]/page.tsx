import { permanentRedirect } from "next/navigation";

export default async function SnippetRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  permanentRedirect(`/code?v=${params.id}`);
}