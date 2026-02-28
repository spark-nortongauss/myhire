import { createClient } from "@/lib/supabase/server";
import { MyFilesManager } from "@/components/files/my-files-manager";

export default async function FilesPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return <MyFilesManager userId={user!.id} />;
}
