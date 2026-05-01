import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function useKeyboardSelection(
  ids: number[],
  selectedId: number | null,
  onSelect: (id: number) => void
) {
  useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key.toLowerCase() !== "j" && event.key.toLowerCase() !== "k") {
        return;
      }

      event.preventDefault();

      const currentIndex = selectedId ? ids.indexOf(selectedId) : -1;
      const moveForward = event.key === "ArrowDown" || event.key.toLowerCase() === "j";
      const moveBackward = event.key === "ArrowUp" || event.key.toLowerCase() === "k";

      if (moveForward) {
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, ids.length - 1);
        onSelect(ids[nextIndex]);
      }

      if (moveBackward) {
        const nextIndex = currentIndex < 0 ? ids.length - 1 : Math.max(currentIndex - 1, 0);
        onSelect(ids[nextIndex]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ids, onSelect, selectedId]);
}
