/**
 * ControlsModal.ts
 * Manages the Controls modal UI and interactions
 */

export function setupControlsModal() {
  // ── Inject Stylized CSS for 3D Label ───────────────────────────────────────
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
    .controls-overlay {
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
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);

  // ── Create Controls Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'controls-overlay';
  modalOverlay.id = 'controls-modal-overlay';
  
  // Create the modal element with vertical portrait layout and unroll animation
  const controlsModal = document.createElement('div');
  controlsModal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 480px; min-height: 70vh; background: transparent url("/improved-bg.png") no-repeat center center !important; background-size: 100% 100% !important; filter: drop-shadow(8px 12px 20px rgba(0, 0, 0, 0.7)); padding: 70px 50px; display: flex; flex-direction: column; align-items: center; z-index: 4000; border: none !important; border-radius: 0 !important; box-shadow: none !important; animation: unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; perspective: 1000px; pointer-events: auto !important;';
  controlsModal.id = 'controls-modal';
  
  controlsModal.innerHTML = `
    <style>
      @keyframes unfurlScroll {
        0% { 
          clip-path: inset(50% 0 50% 0); 
          transform: translate(-50%, -50%) scale(0.8) rotateX(15deg); 
          opacity: 0; 
        }
        100% { 
          clip-path: inset(0 0 0 0); 
          transform: translate(-50%, -50%) scale(1) rotateX(0deg); 
          opacity: 1; 
        }
      }
      .ctrl-row {
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        width: 100%; 
        margin-bottom: 18px; 
        border-bottom: 1px dashed rgba(44, 27, 24, 0.2); 
        padding-bottom: 12px;
      }
      .ctrl-keys {
        display: flex; 
        gap: 8px;
      }
      .keycap {
        background-color: #2c1b18; 
        color: #ebd8b7; 
        padding: 6px 12px; 
        border: 2px solid #5d4037; 
        border-radius: 6px; 
        font-family: 'Courier New', monospace; 
        font-weight: bold; 
        font-size: 16px; 
        box-shadow: 2px 3px 0px rgba(0,0,0,0.3); 
        text-align: center; 
        min-width: 36px;
      }
      .ctrl-desc {
        font-family: 'Georgia', serif; 
        font-size: 16px; 
        font-weight: 600; 
        color: #2c1b18; 
        text-transform: uppercase; 
        letter-spacing: 1px;
      }
    </style>
    
    <button id="close-controls-btn" style="position: absolute; top: 25px; right: 25px; width: 45px; height: 45px; background-color: #2c1b18; color: #ebd8b7; border: 2px solid #5d4037; border-radius: 50%; font-size: 20px; font-weight: bold; cursor: pointer !important; pointer-events: auto !important; z-index: 10001 !important; box-shadow: 2px 4px 10px rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; font-family: 'Courier New', monospace; transition: transform 0.2s ease;">X</button>
    
    <h1 style="font-family: 'Georgia', serif; font-size: 34px; font-weight: 900; color: #2c1b18; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 3px; text-align: center;">Controls</h1>
    
    <h2 style="font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #5d4037; margin: 0 0 40px 0; letter-spacing: 2px; text-transform: uppercase; text-align: center;">How to navigate</h2>
    
    <div style="width: 100%; padding: 0 10px;">
      <div class="ctrl-row">
        <div class="ctrl-keys">
          <span class="keycap">W</span>
          <span class="keycap">A</span>
          <span class="keycap">S</span>
          <span class="keycap">D</span>
        </div>
        <span class="ctrl-desc">Movement</span>
      </div>
      
      <div class="ctrl-row">
        <div class="ctrl-keys">
          <span class="keycap" style="font-size: 12px; min-width: 80px;">ARROWS</span>
        </div>
        <span class="ctrl-desc">Alt Movement</span>
      </div>
      
      <div class="ctrl-row">
        <div class="ctrl-keys">
          <span class="keycap" style="font-size: 12px; min-width: 80px;">MOUSE</span>
        </div>
        <span class="ctrl-desc">Look Around</span>
      </div>
      
      <div class="ctrl-row" style="border-bottom: none;">
        <div class="ctrl-keys">
          <span class="keycap">E</span>
        </div>
        <span class="ctrl-desc">Interact</span>
      </div>
    </div>
  `;
  
  modalOverlay.appendChild(controlsModal);
  document.body.appendChild(modalOverlay);
  
  // ── Modal State and Controls ───────────────────────────────────────────────
  let isOpen = false;

  const open = () => {
    if (modalOverlay) {
      modalOverlay.style.display = 'flex';
      // Retrigger animation by removing and re-adding it
      controlsModal.style.animation = 'none';
      setTimeout(() => {
        controlsModal.style.animation = 'unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      }, 10);
    }
    isOpen = true;
  };

  const close = () => {
    if (modalOverlay) modalOverlay.style.display = 'none';
    isOpen = false;
  };
  
  // Setup close button interactions AFTER modal is added to DOM
  const closeBtn = controlsModal.querySelector('#close-controls-btn') as HTMLButtonElement;
  if (closeBtn) {
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.transform = 'scale(1.15) rotate(90deg)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.transform = 'scale(1) rotate(0deg)';
    });
    closeBtn.addEventListener('click', () => {
      close();
    });
  }

  // ── Global Event Delegation for Close Button (Foolproof) ──────────────────
  // This ensures clicks are always caught, even if innerHTML is updated
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Check if the clicked element or its parent is the close button
    if (target && (target.id === 'close-controls-btn' || target.closest('#close-controls-btn'))) {
      console.log('❌ Controls modal close button clicked!');
      close();
      e.stopPropagation();
    }
  });

  return {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    get isOpen() {
      return isOpen;
    },
  };
}
