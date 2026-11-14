export function DragHandle() {
  return (
    <span
      className="drag-handle flex cursor-grab items-center text-zinc-600 transition-colors hover:text-zinc-300 active:cursor-grabbing"
      title="Drag to move"
    >
      <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="3" r="1.4" />
        <circle cx="9" cy="3" r="1.4" />
        <circle cx="3" cy="9" r="1.4" />
        <circle cx="9" cy="9" r="1.4" />
        <circle cx="3" cy="15" r="1.4" />
        <circle cx="9" cy="15" r="1.4" />
      </svg>
    </span>
  );
}
