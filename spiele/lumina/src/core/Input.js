/* ==========================================================================
   LUMINA INPUT SYSTEM - Keyboard, Mobile Touch & Gamepad Controller Support
   ========================================================================== */

class LuminaInput {
  constructor() {
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      dash: false
    };

    this.pressed = {
      jump: false,
      dash: false,
      down: false,
      pause: false
    };

    this.released = {
      jump: false
    };

    this.gamepadConnected = false;
    this.lastGamepadButtons = {};
    
    this.keyMap = {
      KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
      KeyW: "up", ArrowUp: "up",
      KeyS: "down", ArrowDown: "down",
      Space: "jump",
      ShiftLeft: "dash", ShiftRight: "dash", KeyJ: "dash", KeyX: "dash",
      KeyK: "down"
    };

    this.initKeyboard();
    this.initTouch();
    this.initGamepad();
  }

  initKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        this.pressed.pause = true;
        e.preventDefault();
        return;
      }

      const action = this.keyMap[e.code];
      if (action) {
        if (action === "jump" && !this.keys.jump) this.pressed.jump = true;
        if (action === "dash" && !this.keys.dash) this.pressed.dash = true;
        if (action === "down" && !this.keys.down) this.pressed.down = true;
        
        this.keys[action] = true;
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      const action = this.keyMap[e.code];
      if (action) {
        if (action === "jump") this.released.jump = true;
        this.keys[action] = false;
        e.preventDefault();
      }
    });

    window.addEventListener("blur", () => {
      Object.keys(this.keys).forEach(k => this.keys[k] = false);
    });
  }

  initTouch() {
    const touchButtons = document.querySelectorAll(".touch-btn");
    touchButtons.forEach(btn => {
      const action = btn.dataset.action;
      if (!action) return;

      const handlePress = (e) => {
        e.preventDefault();
        btn.classList.add("active");
        if (action === "jump" && !this.keys.jump) this.pressed.jump = true;
        if (action === "dash" && !this.keys.dash) this.pressed.dash = true;
        if (action === "down" && !this.keys.down) this.pressed.down = true;
        this.keys[action] = true;
      };

      const handleRelease = (e) => {
        e.preventDefault();
        btn.classList.remove("active");
        if (action === "jump") this.released.jump = true;
        this.keys[action] = false;
      };

      btn.addEventListener("pointerdown", handlePress);
      btn.addEventListener("pointerup", handleRelease);
      btn.addEventListener("pointercancel", handleRelease);
      btn.addEventListener("pointerleave", handleRelease);
    });
  }

  initGamepad() {
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepadConnected = true;
      console.log(`[Lumina] Gamepad connected: ${e.gamepad.id}`);
    });
    window.addEventListener("gamepaddisconnected", () => {
      this.gamepadConnected = false;
    });
  }

  // Poll Gamepad state on each frame
  pollGamepad() {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    if (!gamepads || !gamepads[0]) return;
    const gp = gamepads[0];

    const dpadLeft = gp.buttons[14] ? gp.buttons[14].pressed : false;
    const dpadRight = gp.buttons[15] ? gp.buttons[15].pressed : false;
    const dpadDown = gp.buttons[13] ? gp.buttons[13].pressed : false;
    const stickX = gp.axes[0] || 0;
    const stickY = gp.axes[1] || 0;

    const left = dpadLeft || stickX < -0.3;
    const right = dpadRight || stickX > 0.3;
    const down = dpadDown || stickY > 0.5;

    // A/Cross = Jump (Button 0)
    const btnJump = gp.buttons[0] ? gp.buttons[0].pressed : false;
    // X/Square or RB = Dash (Button 2 or Button 5)
    const btnDash = (gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[5] && gp.buttons[5].pressed);
    // Start / Options = Pause (Button 9)
    const btnPause = gp.buttons[9] ? gp.buttons[9].pressed : false;

    if (btnJump && !this.lastGamepadButtons.jump) this.pressed.jump = true;
    if (!btnJump && this.lastGamepadButtons.jump) this.released.jump = true;
    if (btnDash && !this.lastGamepadButtons.dash) this.pressed.dash = true;
    if (down && !this.lastGamepadButtons.down) this.pressed.down = true;
    if (btnPause && !this.lastGamepadButtons.pause) this.pressed.pause = true;

    if (left) this.keys.left = true;
    if (right) this.keys.right = true;
    if (down) this.keys.down = true;
    if (btnJump) this.keys.jump = true;
    if (btnDash) this.keys.dash = true;

    this.lastGamepadButtons = { jump: btnJump, dash: btnDash, down, pause: btnPause };
  }

  // Trigger tactile rumble / haptics if gamepad supports it
  vibrate(duration = 100, weak = 0.4, strong = 0.6) {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    if (gamepads && gamepads[0] && gamepads[0].vibrationActuator) {
      gamepads[0].vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: duration,
        weakMagnitude: weak,
        strongMagnitude: strong
      }).catch(() => {});
    }
  }

  // Clear single-frame edge triggers at end of tick
  clearFrame() {
    this.pressed.jump = false;
    this.pressed.dash = false;
    this.pressed.down = false;
    this.pressed.pause = false;
    this.released.jump = false;
  }
}

// Global Export
window.LuminaInput = LuminaInput;
