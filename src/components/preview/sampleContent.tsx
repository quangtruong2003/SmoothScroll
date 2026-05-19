export function SamplePreviewContent() {
  return (
    <div className="px-3 py-2 text-sm leading-relaxed">
      {Array.from({ length: 60 }).map((_, i) => (
        <p key={i} className="mb-3">
          {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
          do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
          enim ad minim veniam, quis nostrud exercitation ullamco laboris.
        </p>
      ))}
    </div>
  );
}
