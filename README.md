# Gemini-hackaton

## Antigravity Project Prompt: "Void Marauder – AI Voice Commander"
Project Vision:
Develop a fast-paced, 2D top-down space combat simulation where the player acts as the Pilot-Commander. The core gameplay loop focuses on high-adrenaline dogfights where physical maneuvering is split from tactical systems management. Moving the ship is reactive (keyboard), while commanding systems is strategic (voice).

## Core Gameplay Mechanics:

### Hybrid Control Scheme (The Twist):

Movement (WSAD): The player controls the ship's thrusters (Forward, Backward, Strafe Left/Right) and rotation (Mouse Aim) using traditional keyboard and mouse inputs for precise positioning.

Tactical Systems (Voice Commands): All other ship functions are triggered exclusively by natural language voice commands processed by Gemini Live API.

### Voice Command System (Examples):

"Fire!" / "Engage targets!" -> Triggers primary weapon discharge.

"Refuel now!" / "Energy transfer!" -> Initiates a resource management action (e.g., converting battery to thruster fuel).

"Jazda z frajerami!" (and other aggressive slang) -> Triggers "Overdrive Mode" (temporary speed/damage boost) or releases a barrage of missiles. The AI must interpret the intent and emotion, not just static keywords.

### The Radar (Tactical Display): A central UI element rendering the local battlespace. It displays:

Player Ship (centered).

Enemy Ships (red dots).

Incoming Missiles (fast-moving projectiles with trail effects).

AI System (Gemini Live API): The AI acts as the Ship's Computer. It must:

Maintain a continuous, low-latency WebSocket connection for voice input.

Interpret player intent from unstructured voice commands (supporting multi-language/slang).

Return structured JSON data to the game engine to trigger specific game events (e.g., { "action": "fire_weapons", "type": "primary" }).

## Technical Stack Integration:

Engine/Platform: TypeScript, Vite (Vanilla TS template) for a browser-based Single Page Application (SPA). NO BACKEND.

Physics & Entities (Antigravity): Handle ship movement physics, collision detection (player vs. missiles/enemies), and entity management (spawning/destroying projectiles and ships).

Voice Integration (Gemini Live API): Manage the microphone stream and WebSocket connection for real-time natural language processing and intent extraction.

Audio Streaming (Fishjam): Handle the low-latency audio capture and transmission to ensure the AI responds instantly to commands.

Visuals & Radar (TypeGPU): Render the high-performance tactical radar display and weapon effects (laser beams, missile trails, explosions) using WebGPU shaders for maximum visual flair with zero CPU overhead.

## MVP Goal (6 Hours):
A playable scenario where the player can steer the ship with WSAD on a clear radar display and successfully use at least three distinct voice commands (Fire, Boost, Refuel) to survive waves of incoming enemy entities.
