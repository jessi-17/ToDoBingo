import NotebookFrame from "@/components/notebook-frame";
import Workspace from "@/components/workspace";

export default function Home() {
  return (
    <main className="h-dvh">
      <NotebookFrame>
        <Workspace />
      </NotebookFrame>
    </main>
  );
}
