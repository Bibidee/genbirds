export default function Footer() {
  return (
    <footer className="px-4 pb-6 pt-10 text-center text-sm text-slate-700/80">
      <div className="mx-auto max-w-6xl panel px-4 py-3">
        Built on <span className="font-bold">GenLayer</span> · Original physics arcade · © {new Date().getFullYear()} GenBirds
      </div>
    </footer>
  );
}
