/* ==========================================================================
   LUMINA INPUT SYSTEM - Keyboard, Mobile Touch & Gamepad Controller Support
   ==========================================================================
   All input sources (keyboard codes, touch buttons, gamepad state) are tracked
   independently and merged once per frame in refresh(). This guarantees:
     - No stuck keys when multiple sources map to the same action
     - Correct press/release edges even across device boundaries
     - Releasing one key while another "jump" key is held does not cut the jump
   ========================================================================== */

class LuminaInput {
  constructor() {
    // Effective merged state, read by the game
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      dash: false
    };

    // Single-frame edge triggers, consumed by the fixed-step update
    this.pressed = {
      jump: false,
      dash: false,
      down: false,
      pause: false
    };

    this.released = {
      jump: false
    };

    // Per-source raw state
    this.codes = new Set(); // currently held keyboard codes
    this.touchState = { left: false, right: false, up: false, down: false, jump: false, dash: false };
    this.gpState = { left: false, right: false, up: false, down: false, jump: false, dash: false };

    this.gamepadConnected = false;
    this.gpPauseHeld = false;

    this.keyMap = {
      KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
      // W / ArrowUp act as jump (matching the on-screen control hints)
      KeyW: "jump", ArrowUp: "jump",
      KeyS: "down", ArrowDown: "down",
      Space: "jump",
      ShiftLeft: "dash", ShiftRight: "dash", KeyJ: "dash", KeyX: "dash",
      KeyK: "down"
    };

    this.initKeyboard();
    this.initTouch();
    this.initGamepad();
  }

  // True if any currently-held keyboard code maps to the given action
  kbDown(action) {
    for (const code of this.codes) {
      if (this.keyMap[code] === action) return true;
    }
    return false;
  }

  initKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        this.pressed.pause = true;
        e.preventDefault();
        return;
      }

      if (this.keyMap[e.code]) {
        this.codes.add(e.code);
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      if (this.keyMap[e.code]) {
        this.codes.delete(e.code);
        e.preventDefault();
      }
    });

    window.addEventListener("blur", () => {
      this.codes.clear();
      Object.keys(this.touchState).forEach(k => this.touchState[k] = false);
    });
  }

  initTouch() {
    const touchButtons = document.querySelectorAll(".touch-btn");
    touchButtons.forEach(btn => {
      const action = btn.dataset.action;
      if (!action || !(action in this.touchState)) return;

      const handlePress = (e) => {
        e.preventDefault();
        btn.classList.add("active");
        this.touchState[action] = true;
      };

      const handleRelease = (e) => {
        e.preventDefault();
        btn.classList.remove("active");
        this.touchState[action] = false;
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
      Object.keys(this.gpState).forEach(k => this.gpState[k] = false);
      this.gpPauseHeld = false;
    });
  }

  // Poll Gamepad + merge all sources. Called once per rendered frame.
  pollGamepad() {
    const gp = this.gpState;

    if (navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      const pad = gamepads && gamepads[0];

      if (pad) {
        const dpadLeft = pad.buttons[14] ? pad.buttons[14].pressed : false;
        const dpadRight = pad.buttons[15] ? pad.buttons[15].pressed : false;
        const dpadUp = pad.buttons[12] ? pad.buttons[12].pressed : false;
        const dpadDown = pad.buttons[13] ? pad.buttons[13].pressed : false;
        const stickX = pad.axes[0] || 0;
        const stickY = pad.axes[1] || 0;

        gp.left = dpadLeft || stickX < -0.3;
        gp.right = dpadRight || stickX > 0.3;
        gp.up = dpadUp || stickY < -0.5;
        gp.down = dpadDown || stickY > 0.5;
        // A/Cross = Jump (Button 0)
        gp.jump = (pad.buttons[0] && pad.buttons[0].pressed) || gp.up;
        // X/Square or RB = Dash (Button 2 or Button 5)
        gp.dash = (pad.buttons[2] && pad.buttons[2].pressed) || (pad.buttons[5] && pad.buttons[5].pressed);

        // Start / Options = Pause (Button 9), edge-triggered
        const pauseNow = pad.buttons[9] ? pad.buttons[9].pressed : false;
        if (pauseNow && !this.gpPauseHeld) this.pressed.pause = true;
        this.gpPauseHeld = pauseNow;
      } else {
        Object.keys(gp).forEach(k => gp[k] = false);
        this.gpPauseHeld = false;
      }
    }

    this.refresh();
  }

  // Merge keyboard + touch + gamepad into this.keys and derive edge triggers
  refresh() {
    const actions = ["left", "right", "up", "down", "jump", "dash"];
    for (const a of actions) {
      const wasDown = this.keys[a];
      const isDown = this.kbDown(a) || this.touchState[a] || this.gpState[a];

      if (isDown && !wasDown) {
        if (a === "jump" || a === "dash" || a === "down") this.pressed[a] = true;
      } else if (!isDown && wasDown) {
        if (a === "jump") this.released.jump = true;
      }

      this.keys[a] = isDown;
    }
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
