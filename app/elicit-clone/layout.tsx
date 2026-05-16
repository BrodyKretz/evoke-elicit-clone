// Wraps the Elicit-clone route in the Inter font variable per the design
// spec. The rest of Evoke continues to use Manrope/Fraunces.

export default function ElicitCloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      className="min-h-screen bg-white text-[#1F2937]"
    >
      {children}
    </div>
  );
}
