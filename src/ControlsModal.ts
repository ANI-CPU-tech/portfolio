/**
 * ControlsModal.ts
 * Manages the Controls modal UI and interactions
 */

export function setupControlsModal() {
  // ── Inject Stylized CSS for 3D Label and Modal ─────────────────────────────
  // Note: Reusing the same CSS classes as AboutModal for consistent styling
  const style = document.createElement('style');
  style.innerHTML = `
    .bruno-label-container {
      /* Three.js controls this wrapper's transform. Do NOT put scales/rotations here. */
      pointer-events: none;
    }
    .bruno-label-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1a1a1a;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: 'Impact', 'Arial Black', sans-serif;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 3px solid #ffffff;
      box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
      transform: scale(0) translateY(20px);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
    }
    .bruno-label-container.visible .bruno-label-inner {
      transform: scale(1) translateY(0px);
      opacity: 1;
    }
    .key-indicator {
      background: #ffffff;
      color: #1a1a1a;
      padding: 2px 8px;
      border-radius: 2px;
      font-weight: bold;
      transform: rotate(5deg);
    }
    .about-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: transparent;
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      pointer-events: none;
    }
    .about-modal {
      background-color: transparent !important;
      background-image: url('/paper-bg.png');
      background-size: 100% 100%;
      background-position: center;
      background-repeat: no-repeat;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      filter: drop-shadow(8px 12px 20px rgba(0, 0, 0, 0.6));
      width: 95%;
      max-width: 1050px;
      height: auto;
      max-height: 85vh;
      padding: 60px 50px;
      position: relative;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      gap: 50px;
      align-items: center;
      pointer-events: auto;
      overflow-y: auto;
    }
    .about-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: transparent;
      color: #2c1b18;
      border: 3px solid #2c1b18;
      box-shadow: none;
      width: 50px;
      height: 50px;
      font-family: 'Impact', sans-serif;
      font-size: 28px;
      font-weight: bold;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: transform 0.2s, background-color 0.2s;
      border-radius: 50%;
    }
    .about-close:hover {
      background: rgba(44, 27, 24, 0.1);
    }
    .about-close:active {
      transform: scale(0.95);
    }
    .about-img {
      width: 280px;
      height: 280px;
      background: #f5f1e8;
      border: 4px solid #2c1b18;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 4px;
      box-shadow: 3px 3px 8px rgba(0,0,0,0.3);
    }
    .about-content {
      flex-grow: 1;
    }
    .about-content h1 {
      font-family: 'Impact', sans-serif;
      font-size: 56px;
      margin: 0 0 5px 0;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #2c1b18;
      text-shadow: none;
    }
    .about-content h3 {
      color: #5d4037;
      margin: 0 0 25px 0;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
    }
    .about-content p.bio {
      line-height: 1.7;
      font-size: 18px;
      margin-bottom: 25px;
      color: #2c1b18;
    }
  `;
  document.head.appendChild(style);

  // ── Create Controls Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'about-overlay';
  modalOverlay.id = 'controls-modal-overlay';
  modalOverlay.innerHTML = `
    <div class="about-modal" style="max-width: 400px; width: 90%; flex-direction: column; text-align: center;">
      <div class="about-close" id="controls-close-btn">X</div>
      <div class="about-content" style="width: 100%;">
        <h1 style="font-family: 'Impact', sans-serif; font-size: 56px; margin: 35px 0 5px 0; letter-spacing: 2px; text-transform: uppercase; color: #2c1b18; text-shadow: none;">CONTROLS</h1>
        <h3 style="color: #5d4037; margin: 0 0 25px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">How to navigate</h3>
        <ul style="color: #2c1b18; line-height: 2.2; font-size: 18px; margin: 0 auto; padding: 0; list-style: none; display: inline-block; text-align: left;">
          <li><strong style="color: #2c1b18; width: 30px; display: inline-block;">W</strong> - Move Forwards</li>
          <li><strong style="color: #2c1b18; width: 30px; display: inline-block;">A</strong> - Move Left</li>
          <li><strong style="color: #2c1b18; width: 30px; display: inline-block;">S</strong> - Move Backwards</li>
          <li><strong style="color: #2c1b18; width: 30px; display: inline-block;">D</strong> - Move Right</li>
          <li style="margin-top: 15px;"><strong style="color: #2c1b18;">Arrow Keys</strong> - Alternative Movement</li>
          <li style="margin-top: 15px;"><strong style="color: #2c1b18;">Mouse</strong> - Rotate Camera</li>
          <li><strong style="color: #2c1b18;">E</strong> - Interact with Objects</li>
        </ul>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // ── Modal State and Controls ───────────────────────────────────────────────
  let isOpen = false;
  const overlay = document.getElementById('controls-modal-overlay');
  const closeBtn = document.getElementById('controls-close-btn');

  const open = () => {
    if (overlay) overlay.style.display = 'flex';
    isOpen = true;
  };

  const close = () => {
    if (overlay) overlay.style.display = 'none';
    isOpen = false;
  };

  if (closeBtn) closeBtn.addEventListener('click', close);

  return {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    get isOpen() {
      return isOpen;
    },
  };
}
