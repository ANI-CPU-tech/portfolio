/**
 * AboutModal.ts
 * Manages the About Me modal UI and interactions
 */

export function setupAboutModal() {
  // ── Inject Stylized CSS for 3D Label and Modal ─────────────────────────────
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
      background: #1a1a1a;
      color: #f0f0f0;
      border: 6px solid #ffffff;
      border-radius: 12px;
      box-shadow: 15px 15px 0px rgba(0,0,0,0.9);
      width: 95%;
      max-width: 1050px;
      height: auto;
      max-height: 85vh;
      padding: 40px;
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
      background: #ffffff;
      color: #1a1a1a;
      border: 5px solid #1a1a1a;
      box-shadow: 5px 5px 0px rgba(0,0,0,0.6);
      width: 60px;
      height: 60px;
      font-family: 'Impact', sans-serif;
      font-size: 28px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .about-close:active {
      transform: translate(5px, 5px);
      box-shadow: 0px 0px 0px rgba(0,0,0,0.6);
    }
    .about-img {
      width: 280px;
      height: 280px;
      background: #2a2a2a;
      border: 6px solid #ffffff;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 8px;
      box-shadow: 8px 8px 0px rgba(0,0,0,0.5);
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
      color: #ffffff;
      text-shadow: 4px 4px 0px #000;
    }
    .about-content h3 {
      color: #a3a3a3;
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
      color: #d1d1d1;
    }
  `;
  document.head.appendChild(style);

  // ── Create About Me Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'about-overlay';
  modalOverlay.id = 'about-modal-overlay';
  modalOverlay.innerHTML = `
    <div class="about-modal">
      <div class="about-close" id="about-close-btn">X</div>
      <img src="/models/profile.jpg" alt="Profile" class="about-img" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMyYTJhMmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjI4MHgyODA8L3RleHQ+PC9zdmc+'" />
      <div class="about-content" style="flex-grow: 1; overflow-y: auto; padding-right: 15px;">
        <h1 style="font-family: 'Impact', sans-serif; font-size: 56px; margin: 0 0 5px 0; letter-spacing: 2px; text-transform: uppercase; color: #ffffff; text-shadow: 4px 4px 0px #000;">Anirudh Rao B</h1>
        <h3 style="color: #a3a3a3; margin: 0 0 25px 0; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Code, systems, and a bit of controlled chaos.</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px;">
          <!-- Column 1: About Me -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">About Me :</h4>
            <p style="color: #d1d1d1; line-height: 1.7; font-size: 15px; margin: 0;">I'm a Computer Science Engineering student who enjoys building scalable software, AI-powered applications, and modern web experiences. I love exploring cloud technologies, DevOps, backend architecture, and 3D development while constantly learning new tools and frameworks.</p>
          </div>
          <!-- Column 2: Experience & Background -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">Experience :</h4>
            <p style="color: #d1d1d1; line-height: 1.7; font-size: 15px; margin: 0;">Engineering student with hands-on experience developing full-stack applications, AI solutions, and cloud-native projects. </p>
          </div>
          <!-- Column 3: Core Skills & Tools -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">Core Skills & Tools</h4>
            <ul style="color: #d1d1d1; line-height: 1.8; font-size: 15px; margin: 0; padding-left: 20px;">
              <li>Python & Django</li>
              <li>Docker & Containerization</li>
              <li>PostgreSQL & TimescaleDB</li>
              <li>React & Next.js</li>
              <li>Git & GitHub</li>
              <li>Machine Learning (scikit-learn)</li>
            </ul>
          </div>
          <!-- Column 4: Interests & Hobbies -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">Interests & Hobbies</h4>
            <ul style="color: #d1d1d1; line-height: 1.8; font-size: 15px; margin: 0; padding-left: 20px;">
              <li>AI & Machine Learning</li>
              <li>Open Source Development</li>
              <li>Hackathons</li>
              <li>3D Modeling & Animation</li>
              <li>Cloud Computing</li>
              <li>Gaming</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // ── Modal State and Controls ───────────────────────────────────────────────
  let isOpen = false;
  const overlay = document.getElementById('about-modal-overlay');
  const closeBtn = document.getElementById('about-close-btn');

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
