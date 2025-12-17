# Walkthrough: Help Stamp Feature

## Overview
Phase 3-5 implemented the "Help Stamp" feature.
- **Goal**: Encourage kids to help out 5 times to get +1 Santa Stamp (equivalent to 1 step in Sugoroku).
- **UI**: A "+1" button, a gauge (5 dots), and a bonus counter.
- **Logic**:
  - `helpTotal` increments on button click.
  - `helpBonus = floor(helpTotal / 5)`.
  - Sugoroku progress = `totalBase (Good days)` + `totalBonus (Perfect days)` + `helpBonus`.

## Test Results (Phase 6 Final QA)

Date: 2025-12-18
Tester: Antigravity Subagent (Automated Browser Session)

| Test ID | Scenario | Expected | Result |
|---|---|---|---|
| **T1** | Click Help Button (1st time) | Gauge moves to 1/5, "Remaining: 4" | PASS |
| **T2** | Click Help Button (5th time) | Bonus becomes 1, Sugoroku advances +1 | PASS |
| **T3** | Page Reload | `helpTotal` and progress persist | PASS |
| **T4** | Reset Data | `helpTotal` -> 0, Sugoroku reverts | PASS |
| **T5** | Regular Stamp | Points add up correctly | PASS |
| **T6** | Timer Function | Overlay works, no regression | PASS |

## Integration Notes
- The `helpBonus` is calculated dynamically (`Math.floor(headTotal/5)`) in `updatePoints()`.
- It does NOT overwrite `totalBase` or `totalBonus`, avoiding double counting.
- Updates happen instantly on button click.
