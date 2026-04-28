export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(247,242,234,0.94)_42%,_rgba(236,227,213,0.98))] text-[#201d17]">
      {children}
    </div>
  );
}
