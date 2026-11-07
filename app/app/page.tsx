import { DialApp } from "@/components/dial-app";

// Static shell. All data is fetched client-side from /api/data so the first
// paint can come from the local cache and fresh data merges in silently.
export default function AppPage() {
  return <DialApp />;
}
