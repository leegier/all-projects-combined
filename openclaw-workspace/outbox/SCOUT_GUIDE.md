# UE5 Blueprint Best Practices Guide
**For the CLAWED Development Team**  
*Prepared by SCOUT*  
*Date: March 2026*

---

## Introduction

This guide establishes professional-grade Blueprint development standards for CLAWED — a production-ready UE5 third-person action RPG. The goal: scalable, performant, maintainable systems that ship.

### Core Principle: Hybrid Architecture

Epic's production games (Fortnite, Lyra) use a **C++ foundation with Blueprint extension** pattern:

- **C++**: Core systems, performance-critical code, low-level engine interaction (5x–20x faster execution)
- **Blueprint**: Rapid iteration, designer workflows, content-specific logic, data-driven behaviors

Never build entirely in one or the other. The hybrid approach gives you both performance and agility.

---

## 1. Blueprint Types & When to Use Them

### Blueprint Classes (Primary Building Block)
**Use for**: Reusable actors, characters, weapons, gameplay objects.

- Support inheritance, components, polymorphism
- Instantiable across levels
- Accessible project-wide
- **Ideal for**: Most gameplay entities

### Data-Only Blueprints (Configuration)
**Use for**: Variants of existing logic with different data.

- Inherit behavior from parent; no new logic nodes
- Load faster, clearer intent
- **Ideal for**: Enemy variants, weapon definitions, difficulty presets, stat variations

### Blueprint Interfaces (Scalability Secret)
**Use for**: Polymorphic communication without hard references.

- Function signatures only, no implementation
- Multiple Blueprints can implement the same interface
- No casting overhead; avoids memory bloat
- **Ideal for**: Interactable systems, damage handlers, event listeners

> **Rule**: Choose Interfaces over Casting when building systems that need to scale. The upfront cost pays off massively in maintainability.

### Level Blueprints (Avoid for Production)
**Use for**: Quick prototyping only, or truly level-unique logic that will never be reused.

**Why avoid**:
- Non-reusable (tied to level)
- Version control nightmares (binary merge conflicts)
- Untestable
- Scalability disaster

> **Industry consensus**: Reserve Level Blueprints for throwaway prototypes. All production logic belongs in Blueprint Actor classes, Components, or Function Libraries.

### Blueprint Function Libraries (Utility Toolbox)
**Use for**: Static utility functions accessible anywhere.

- Mathematical helpers
- String/formatters
- Shared conversion logic
- **Ideal for**: General-purpose functions that don't need object state

### Blueprint Components (Modular Behavior)
**Use for**: Reusable functionality that can be attached to any Actor.

- Health components, inventory components, AI behavior components
- Encapsulate logic + data
- Mix-and-match via Actor composition

> **Pattern**: Build components first, then compose Actors from them. This beats deep inheritance hierarchies.

---

## 2. Blueprint vs C++: Decision Framework

### Choose Blueprint When...
- Event-driven gameplay (button press, damage taken, door opened)
- High-level system orchestration (quest flow, game mode logic)
- UI/HUD implementation (menus, health bars, inventory)
- Rapid prototyping and iteration (test mechanics before C++ commit)
- Designer-accessible functionality (designers tweak without recompile)
- Level-specific scripting (but still in Actor Blueprints, not Level BP)

### Choose C++ When...
- Code executes every frame with complex math (physics, AI tick logic)
- Performance-critical systems identified by profiling (bottlenecks)
- Low-level engine interaction (custom collision, rendering mods)
- Network replication logic (complex multiplayer sync)
- Large-scale data processing (batch operations on thousands of entries)
- Third-party library integration

### Hybrid Workflow (Professional Standard)
1. Prototype in Blueprint to discover mechanics
2. Profile to identify Blueprint hot paths
3. Move critical systems to C++ selectively
4. Expose C++ functions/events to Blueprint for designer iteration
5. Keep Blueprint interfaces stable; iterate implementation in C++

> **Note**: Epic's own Lyra and Fortnite follow this pattern. Engineers build frameworks in C++; designers extend in Blueprint. Profile-driven optimization converts only measured problems.

---

## 3. Performance Best Practices

### Event-Driven Over Tick
Blueprints excel at discrete events, not continuous polling.

- **Avoid**: Event Tick for logic that can be event-driven
- **Prefer**: Timers, overlap events, input actions, custom events
- **Impact**: Migrating from Tick to event-driven can yield **20–30%** performance gains

**Example**: Instead of polling for key collection every tick, use an overlap event.

### Pure Function Traps in Loops
Pure functions execute once per connection without caching. In a `ForEach` loop with 8 elements, a pure function input can execute **17 times** instead of once.

- **Solution**: Cache pure function results in a variable before the loop

### Blueprint Nativization (Production)
Enable for performance-critical Blueprints:
- Project Settings > Packaging > Blueprint Nativization
- Converts Blueprint bytecode to C++ at packaging
- Gives C++ speeds while keeping Blueprint workflow
- **Use selectively**: Not all Blueprints need nativization

### Object Pooling
Never Spawn/Destroy in tight loops or Tick.

- Pre-create pool of objects
- Reuse via Activate/Deactivate
- Dramatically reduces GC pressure and hitching

### Tick Optimization
If an Actor must tick:
- Set `PrimaryActorTick.bCanEverTick = false` by default
- Enable only when needed
- Use `AddTickPrerequisiteActor` to control order
- Consider `TickInterval` for less frequent updates

### Caching Components
Don't call `GetComponent` every tick.

```blueprint
BeginPlay → Cache reference to Camera, Mesh, Movement component in variables
```

### Profiling Tools
- `stat fps` – frame rate
- `stat unit` – main thread stats
- `stat game` – gameplay timings
- Blueprint Profiler (Window > Developer Tools > Blueprint Profiler)
- Unreal Insights (full system trace)

> **Profile regularly**. Identify hot Blueprints and optimize or convert to C++.

---

## 4. UI & Interaction Best Practices

### Widget Blueprint Architecture
- **Widget Components** for in-world UI (nameplates, interact prompts)
- **UMG** for screen-space UI (menus, HUD, inventory)
- Use **Binder** patterns for data binding (not built-in; implement via event dispatchers)

### Input Handling
Use **Enhanced Input System** (UE5.3+):

1. Create Input Actions (IA_Jump, IA_Fire)
2. Create Input Mapping Context (IMC_Default)
3. Bind in C++ or Blueprint via Enhanced Input Component

**Benefits**: Rebindable, modifier keys (Shift/Ctrl), gamepad support, better organization than legacy Axis/Action events.

### Interaction Patterns
- Use **Blueprint Interfaces** for interactable objects (Bpi_Interactable)
- Player uses `LineTrace` to find interactable; calls `Interact` interface method
- No casting, no hard references; Door, Chest, NPC all implement same interface
- UI shows context-sensitive prompts via `GetInteractionPrompt` interface method

---

## 5. Gameplay Logic Patterns

### Component-Based Composition > Inheritance
Build Actors from specialized components instead of deep hierarchies.

**Good**:
```
Character (base actor)
├── HealthComponent
├── InventoryComponent
├── StaminaComponent
└── CombatComponent
```

**Bad**:
```
Character
└── CombatCharacter
    └── RangedCombatCharacter
        └── MagicCombatCharacter
```

Composition is flexible, testable, and avoids fragile base class problems.

### Event-Driven Systems
Use **Event Dispatchers** for decoupled communication.

Example: Player level up
```
OnPlayerLevelUp dispatcher bound by:
- UI System (update level display)
- Audio System (play sound)
- Particle System (visual effect)
- Statistics System (recalculate stats)
```

No direct references; systems subscribe/unsubscribe as needed.

### Data-Driven Design
Separate configuration from logic:

- **Data Assets** (`UDataAsset`) for designer-editable tables (weapon stats, item definitions)
- **Data Tables** (`UDataTable`) for CSV-like data (enemy spawns, drop lists)
- Balance without code changes; designers iterate independently

**Pattern**: C++ defines the data structure (e.g., `FWeaponStats` struct), designers fill Data Assets in Editor.

---

## 6. Debugging & Profiling

### Blueprint Debugging
- **Breakpoints**: Right-click node > Add Breakpoint
- **Watch Values**: Hover variables during debugger pause
- **Print String**: Temporary debugging (remove before commit)
- **Blueprint Visual Debugger**: Window > Developer Tools > Blueprint Debugger (shows execution flow)

### C++ Debugging
- `UE_LOG` with custom log category
```cpp
DECLARE_LOG_CATEGORY_EXTERN(LogMyGame, Log, All);
DEFINE_LOG_CATEGORY(LogMyGame);
UE_LOG(LogMyGame, Warning, TEXT("Health: %f"), Health);
```

- **Visual Logger** (`UE_VLOG_*`) for in-viewer debug drawing
```cpp
#include "VisualLogger/VisualLogger.h"
UE_VLOG_LOCATION(this, LogTemp, Log, TargetLocation, 50.f, FColor::Green, TEXT("Target"));
```

### Profiling Hotspots
1. Run game in standalone (not PIE) for accurate numbers
2. Use `stat unit` to find main thread bottlenecks
3. Blueprint Profiler to see which Blueprints consume most time
4. Unreal Insights for frame-by-frame analysis

**Typical Blueprint bottlenecks**: Tick-heavy actors, pure functions in loops, frequent SpawnActor, excessive string operations.

---

## 7. Recommended Hybrid Project Structure

```
Source/
├── YourGame.Target.cs
├── YourGame.Build.cs
├── Private/
│   ├── GameMode.cpp/h
│   ├── Character.cpp/h
│   ├── Components/
│   │   ├── HealthComponent.cpp/h
│   │   ├── InventoryComponent.cpp/h
│   │   └── CombatComponent.cpp/h
│   ├── Systems/
│   │   ├── DamageSystem.cpp/h
│   │   └── InteractionSystem.cpp/h
│   └── Interfaces/
│       ├── Bpi_Interactable.h (generated by UnrealHeaderTool)
│       └── Bpi_Damageable.h
├── Public/
│   ├── GameMode.h
│   ├── Character.h
│   ├── Components/ (component headers)
│   ├── Systems/ (system headers)
│   └── Interfaces/ (interface headers)
└── YourGame.cpp

Content/
├── Blueprints/
│   ├── Characters/
│   │   ├── BP_PlayerCharacter (Blueprint Class, parent: C++ Character)
│   │   └── BP_Enemy_Grunt (Data-Only Blueprint, parent: BP_EnemyBase)
│   ├── Components/
│   │   ├── BP_HealthComponent (Blueprint Component)
│   │   └── BP_CombatComponent
│   ├── UI/
│   │   ├── WBP_HUD.umg
│   │   ├── WBP_HealthBar.umg
│   │   └── WBP_Inventory.umg
│   ├── WidgetComponents/
│   │   └── WC_InteractPrompt.uasset
│   └── Actors/
│       ├── BP_Door.umg (implements Bpi_Interactable)
│       └── BP_Chest.umg (implements Bpi_Interactable)
├── Data/
│   ├── DataAssets/
│   │   ├── DA_Weapon_AssaultRifle.uasset
│   │   └── DA_Enemy_GruntStats.uasset
│   └── DataTables/
│       └── DT_EnemySpawns.csv
└── Materials/, Meshes/, Animations/ (standard content)
```

**Key points**:
- C++ base classes live in `Source/`
- Blueprint children live in `Content/Blueprints/`
- Data assets in `Content/Data/`
- Use **Data-Only Blueprints** for variants
- Never put gameplay logic in Level Blueprints

---

## 8. Common Pitfalls & Solutions

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| **Heavy Event Tick usage** | Low FPS, high CPU | Convert to event-driven; use timers or collision events |
| **Pure function in loops** | Excessive node executions | Cache result to variable before loop |
| **Hard reference cascades** | Long load times, memory bloat | Use soft references, interfaces, component architecture |
| **Large Blueprint functions (>50 nodes)** | Spaghetti, unreadable | Break into smaller functions; use reroute nodes, comment boxes |
| **Level Blueprint logic** | Unreusable, merge conflicts | Move to Actor Blueprint or Component |
| **Spawn/Destroy in loops** | Hitching, GC spikes | Implement object pooling |
| **Casting everywhere** | Tight coupling, brittle | Replace with Blueprint Interfaces |
| **No profiling** | Performance surprises | Profile early and often; stat fps, Blueprint Profiler |

### The 50-Node Rule
Any Blueprint function exceeding 50 nodes should be refactored. Visual organization is as important as code organization. Use comment boxes, reroute nodes, and collapse logic into custom events or functions.

---

## 9. Exposing C++ to Blueprint

### UPROPERTY Specifiers
```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
float Damage;

UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Health")
float CurrentHealth;

UPROPERTY(Replicated, BlueprintReadOnly, Category = "Network")
int32 Health;
```

### UFUNCTION Specifiers
```cpp
// Callable from Blueprint
UFUNCTION(BlueprintCallable, Category = "Combat")
void TakeDamage(float Damage);

// Implementable in Blueprint (C++ provides optional default)
UFUNCTION(BlueprintNativeEvent, Category = "Combat")
void OnDeath();
// Implementation: void OnDeath_Implementation();

// Overridable in Blueprint (no C++ default)
UFUNCTION(BlueprintImplementableEvent, Category = "Combat")
void OnKill();

// Pure function (no exec pin, just return value)
UFUNCTION(BlueprintPure, Category = "Math")
float GetHealthPercent() const { return CurrentHealth / MaxHealth; }
```

### Replication
```cpp
UPROPERTY(Replicated)
int32 Health;

void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override {
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ACharacter, Health);
}
```

---

## 10. Implementation Checklist

Before considering a Blueprint system "done":

- [ ] **Profiled** with `stat fps` and Blueprint Profiler
- [ ] **Event-driven**: No unnecessary Tick usage
- [ ] **Component-composed**: Not deep inheritance
- [ ] **Interface-driven**: No casting chains
- [ ] **Data-driven**: Config lives in Data Assets/Tables, not hardcoded
- [ ] **Nativized** (if performance-critical)
- [ ] **Object pooling** used for frequent spawn/destroy
- [ ] **Pure functions** not in loops (or cached)
- [ ] **Level Blueprint** avoided (logic in reusable classes)
- [ ] **Documented**: Comments on complex nodes, function descriptions
- [ ] **Named clearly**: Follows naming conventions (BP_, WBP_, DA_, etc.)
- [ ] **Organized**: Placed in proper Content subfolders
- [ ] **Tested**: Works in standalone (not just PIE)

---

## Conclusion

CLAWED demands production-quality systems. Adopt these practices from day one:

1. **Hybrid architecture**: C++ core, Blueprint extension
2. **Event-driven**, not Tick-driven
3. **Component composition** over inheritance
4. **Interfaces** for decoupling
5. **Data-driven** configuration
6. **Profile early**, optimize deliberately

When in doubt, ask: "Will this scale to a 100-hour RPG with hundreds of interacting systems?" If not, refactor now.

---

**References**:
- Epic Games: Best Practices for Blueprints and C++
- UE5.7 Current Best Practices (GitHub)
- Outscal: Clean and Reusable Blueprint Scripts
- Mohsen Sadeghi: Mastering UE5 Blueprints
- Lyra Sample Project (Epic)

---

*End of Guide*