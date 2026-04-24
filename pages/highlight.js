const ACCENT = "#00C47A";

export class HighlightBox {
  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = "position:fixed;inset:0;background:transparent;z-index:9998;pointer-events:none;";
    this.box = document.createElement("div");
    this.box.style.cssText = [
      "position:fixed",
      "z-index:9999",
      "border:2px solid " + ACCENT,
      "border-radius:14px",
      "box-shadow:0 0 20px rgba(0,242,255,.65)",
      "transition:all 380ms cubic-bezier(.22,.61,.36,1)",
      "pointer-events:none",
    ].join(";");
  }

  mount() {
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.box);
  }

  moveTo(target) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    this.box.style.left = `${Math.max(8, rect.left - 6)}px`;
    this.box.style.top = `${Math.max(8, rect.top - 6)}px`;
    this.box.style.width = `${Math.max(60, rect.width + 12)}px`;
    this.box.style.height = `${Math.max(40, rect.height + 12)}px`;
  }

  unmount() {
    this.overlay.remove();
    this.box.remove();
  }
}
