---
name: problem-solving
version: 1.0.0
description: "Structured problem diagnosis and resolution methodology. Use when: (1) a problem's cause is unclear and requires investigation, (2) a previous fix attempt failed, (3) the issue involves multiple components interacting, (4) modifications carry risk or side effects, (5) user explicitly asks to analyze before fixing. NOT for: obvious one-liner fixes, clear error messages with known solutions, or when user says 'just fix it' for simple issues."
---

# Structured Problem Solving

## When to Use This vs. Direct Fix

**Direct fix (skip this skill)**:
- Error message points to exact cause
- One-line config/code fix
- You've seen this exact problem before

**Use this skill**:
- You'd need to say "可能是..." to explain the cause
- 2+ components involved
- You already tried a fix that didn't work
- Wrong fix could cause data loss, privacy leak, or downtime

## The Process

### Step 1: Define the Problem

Turn vague "something's wrong" into a precise statement.

```
问题：[一句话]
现象：[具体发生了什么]
预期：[应该是什么样]
影响：[谁受影响，严重程度]
可复现：[是/否，触发条件]
```

**Rules**:
- Describe what you observe, not what you think caused it
- "webchat replies appear in DingTalk group" = problem ✅
- "origin got polluted" = hypothesis, not problem ❌

### Step 2: Diagnose

**Do not skip to fixing.** Trace the data flow end-to-end first.

#### 2.1 Map the call chain
```
Input → Step A → Step B → Step C → Output
          ↓          ↓          ↓
        Check      Check      Check
```

#### 2.2 Verify each step
Read actual values (logs, state files, source code). Do not guess.

#### 2.3 Narrow down
Find the first step where output diverges from expected. That's where the bug is.

#### 2.4 Confirm root cause

Three questions before you declare root cause:
1. **Why?** — Explain the mechanism, not just the symptom
2. **Sufficient?** — If I fix this, will the problem definitely disappear?
3. **Unique?** — Is there another cause that could produce the same symptom?

All three must be answered. If not → keep diagnosing.

**Diagnostic tools (prefer in order)**:
1. Error messages / logs (fastest)
2. State inspection (config files, DB, session store)
3. Source code tracing (most reliable)
4. Minimal reproduction experiment

### Step 3: Design Solutions

Generate **at least 2** candidate solutions. Compare on:

| Dimension | Question |
|-----------|----------|
| Effectiveness | Fixes root cause or just symptom? |
| Risk | Could it break something else? |
| Complexity | How many components touched? |
| Reversibility | Can we roll back if wrong? |
| Durability | Survives restarts / updates? |
| Side effects | Impact on other features? |

Present as:
```
方案 A：[one line]
  ✅ [pros]  ⚠️ [risks]

方案 B：[one line]
  ✅ [pros]  ⚠️ [risks]

→ 推荐 A，因为 [reason]
```

Always include the "do nothing / workaround" option if viable.

### Step 4: Execute

Pre-flight checklist:
- [ ] Root cause confirmed (not guessed)
- [ ] Solution evaluated (not first idea)
- [ ] User confirmed (for risky changes)
- [ ] Rollback plan ready

**Rules**:
- Change one variable at a time
- Record what was changed and what it was before
- Minimize scope — don't "fix other things while you're at it"

### Step 5: Verify

Three levels of verification:

1. **Direct**: Reproduce original trigger → problem gone?
2. **Regression**: Related features still work?
3. **Durability**: Survives restart / next trigger?

Show evidence, don't say "应该好了".

### Step 6: Review

```
## 复盘：[问题名]
耗时：X 分钟（有效 Y / 弯路 Z）
根因：[一句话]
修复：[一句话]
弯路：[走了什么弯路]
教训：[提炼的规则]
```

Write lessons to `.learnings/` if reusable.

## Anti-patterns

| Pattern | What it looks like | Fix |
|---------|-------------------|-----|
| Guess-and-fix | See symptom → hypothesize → change immediately | Map call chain first |
| One-end-only | Check only input or output | Trace full data flow |
| Surface fix | Change the bad value without asking why it's bad | Ask "why did it become this value?" |
| Multi-change | Change 3 things at once | One variable at a time |
| Premature victory | "Should be fixed now" without checking | Show evidence |
| No rollback | Forget to record original values | Backup before modify |

## Communication During Problem-Solving

- **Define**: Confirm understanding ("你说的问题是 X 对吗？")
- **Diagnose**: Share progress, don't go silent ("在查 Y 环节，发现了 Z")
- **Design**: Give choices, not just one option
- **Execute**: Confirm before risky operations
- **Verify**: Ask user to check on their end
- **Throughout**: Say "I'm not sure yet" over false confidence
