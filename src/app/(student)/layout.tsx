import { Footer } from "@/components/Footer";
import { SessionPing } from "@/components/Track";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionPing />
      {children}
      <Footer />
    </>
  );
}
