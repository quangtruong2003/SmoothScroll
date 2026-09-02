//! Wheel emitter using `SendInput` for vertical and zoom, and `PostMessageW`
//! for horizontal. PostMessageW is used for horizontal because apps like
//! Figma/Pencil listen for WM_MOUSEWHEEL with MK_SHIFT instead of
//! MOUSEEVENTF_HWHEEL.
//!
//! Zoom uses SendInput rather than PostMessageW: WM_MOUSEWHEEL only bubbles
//! from child to parent, so posting to GA_ROOT never reaches apps whose
//! scroll target is a child window (Word's `_WwG` under `OpusApp`).

#![cfg(windows)]

use super::horizontal_scroll::HorizontalScrollDispatcher;
use crate::traits::{EmissionContext, SemanticWheelEmitter};
use crate::types::{
    PlatformError, Result, SemanticPulse, WheelAxis, WheelSequence, WheelTransport,
};
use smoothscroll_core::constants::{EMIT_UNIT, PULSE_CLAMP_MAX, WHEEL_DELTA};
use smoothscroll_core::wheel::{ModifierKeys, SmoothingStrategy};
use std::mem;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYEVENTF_KEYUP, MOUSEEVENTF_HWHEEL, MOUSEEVENTF_WHEEL, MOUSEINPUT, VK_CONTROL, VK_MENU,
    VK_SHIFT,
};

const MAX_WHEEL_CHUNK_UNITS: i32 = PULSE_CLAMP_MAX * EMIT_UNIT;

fn wheel_chunks(mut units: i32) -> Vec<i32> {
    let mut chunks = Vec::new();
    while units != 0 {
        let chunk = units.clamp(-MAX_WHEEL_CHUNK_UNITS, MAX_WHEEL_CHUNK_UNITS);
        chunks.push(chunk);
        units -= chunk;
    }
    chunks
}

pub struct WindowsWheelEmitter;

/// Errors returned while planning a semantic pulse injection batch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanError {
    /// The user pressed an extra physical modifier during an existing tail; the
    /// pulse must be cancelled rather than emitted under a different shortcut.
    ExtraPhysicalModifiers,
    /// A discrete pulse did not split into whole `WHEEL_DELTA` records.
    NotchRemainder,
}

/// Test-observable record of one planned `SendInput` operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedInput {
    KeyDown(u16),
    Wheel {
        flags: u32,
        units: i32,
        marker: usize,
    },
    KeyUp(u16),
}

const MAX_PLAN_LEN: usize = 3 + 1 + 3;

fn key_down(key: u16) -> PlannedInput {
    PlannedInput::KeyDown(key)
}

fn key_up(key: u16) -> PlannedInput {
    PlannedInput::KeyUp(key)
}

/// Plan one atomic native injection batch for a semantic pulse.
///
/// `physical` is the exact Shift/Ctrl/Alt state sampled at emission time. Extra
/// physical modifiers cancel the tail; only captured-but-released modifiers are
/// synthesized around the wheel record(s), each carrying the SmoothScroll
/// marker so the hook can ignore our own feedback.
pub(crate) fn plan_native_inputs(
    pulse: &SemanticPulse,
    physical: ModifierKeys,
) -> std::result::Result<Vec<PlannedInput>, PlanError> {
    if pulse.units == 0 {
        return Ok(Vec::new());
    }
    let captured = pulse.sequence.semantic.modifiers.without_cmd();
    let extra = ModifierKeys {
        shift: physical.shift && !captured.shift,
        ctrl: physical.ctrl && !captured.ctrl,
        alt: physical.alt && !captured.alt,
        cmd: false,
    };
    if extra.shift || extra.ctrl || extra.alt {
        return Err(PlanError::ExtraPhysicalModifiers);
    }

    let flags = match pulse.sequence.semantic.axis {
        WheelAxis::Vertical => MOUSEEVENTF_WHEEL,
        WheelAxis::Horizontal => MOUSEEVENTF_HWHEEL,
    };

    let wheel_records: Vec<i32> = match pulse.sequence.strategy {
        SmoothingStrategy::DiscreteNotchPreserving => {
            if pulse.units % WHEEL_DELTA != 0 {
                return Err(PlanError::NotchRemainder);
            }
            let notches = pulse.units / WHEEL_DELTA;
            (0..notches.unsigned_abs())
                .map(|_| notches.signum() * WHEEL_DELTA)
                .collect()
        }
        SmoothingStrategy::Continuous => wheel_chunks(pulse.units),
    };

    // Key-downs in a fixed order so the atomic batch is deterministic; the
    // key-ups mirror it in reverse so nesting never interleaves wrongly.
    let missing_ctrl = captured.ctrl && !physical.ctrl;
    let missing_shift = captured.shift && !physical.shift;
    let missing_alt = captured.alt && !physical.alt;

    let mut plan = Vec::with_capacity(wheel_records.len() + 3);
    if missing_ctrl {
        plan.push(key_down(VK_CONTROL));
    }
    if missing_shift {
        plan.push(key_down(VK_SHIFT));
    }
    if missing_alt {
        plan.push(key_down(VK_MENU));
    }
    for units in wheel_records {
        plan.push(PlannedInput::Wheel {
            flags,
            units,
            marker: super::SMOOTHSCROLL_INPUT_MARKER,
        });
    }
    if missing_alt {
        plan.push(key_up(VK_MENU));
    }
    if missing_shift {
        plan.push(key_up(VK_SHIFT));
    }
    if missing_ctrl {
        plan.push(key_up(VK_CONTROL));
    }
    Ok(plan)
}

impl SemanticWheelEmitter for WindowsWheelEmitter {
    fn prepare(&self, sequence: WheelSequence) -> Result<()> {
        match sequence.transport {
            WheelTransport::Native => Ok(()),
            WheelTransport::CompatibilityHorizontal => {
                if sequence.semantic.axis != WheelAxis::Horizontal {
                    return Err(PlatformError::Os(
                        "compatibility transport requires horizontal output".into(),
                    ));
                }
                Ok(())
            }
        }
    }

    fn emit_semantic(&self, pulse: SemanticPulse, context: EmissionContext) -> Result<()> {
        if !context.is_current() {
            return Err(PlatformError::StaleEmission);
        }
        if pulse.units == 0 {
            return Ok(());
        }
        match pulse.sequence.transport {
            WheelTransport::CompatibilityHorizontal => {
                if pulse.sequence.semantic.axis != WheelAxis::Horizontal {
                    return Err(PlatformError::Os(
                        "compatibility transport requires horizontal output".into(),
                    ));
                }
                HorizontalScrollDispatcher::dispatch_semantic(pulse.units, context)
            }
            WheelTransport::Native => {
                let plan = plan_native_inputs(&pulse, physical_modifiers())
                    .map_err(|error| PlatformError::Os(format!("semantic plan: {error:?}")))?;
                send_planned_inputs(&plan)
            }
        }
    }
}

/// Exact Shift/Ctrl/Alt state at emission time (three bounded reads).
fn physical_modifiers() -> ModifierKeys {
    ModifierKeys {
        shift: key_is_down(VK_SHIFT),
        ctrl: key_is_down(VK_CONTROL),
        alt: key_is_down(VK_MENU),
        cmd: false,
    }
}

fn key_is_down(key: u16) -> bool {
    (unsafe { GetAsyncKeyState(key as i32) } as u16 & 0x8000) != 0
}

/// Convert a planned batch into one `SendInput` call. A partial send is an
/// error; never retry and never fall back to a bare wheel event.
fn send_planned_inputs(plan: &[PlannedInput]) -> Result<()> {
    if plan.is_empty() {
        return Ok(());
    }

    // The common animated case fits a stack buffer (three key-downs, one wheel
    // record, three key-ups). Oversized instant/discrete output builds one
    // exact-capacity Vec on the engine thread — outside the low-level hook.
    let zero_mouse = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: 0,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let mut stack: [INPUT; MAX_PLAN_LEN] = [zero_mouse; MAX_PLAN_LEN];
    let heap;
    let inputs: &[INPUT] = if plan.len() <= MAX_PLAN_LEN {
        for (slot, planned) in stack.iter_mut().zip(plan) {
            *slot = planned_input_to_input(planned);
        }
        &stack[..plan.len()]
    } else {
        heap = plan.iter().map(planned_input_to_input).collect::<Vec<_>>();
        &heap
    };

    let cb = mem::size_of::<INPUT>() as i32;
    let expected = inputs.len() as u32;
    let sent = unsafe { SendInput(expected, inputs.as_ptr(), cb) };
    if sent != expected {
        return Err(PlatformError::Os(format!(
            "SendInput injected {sent}/{expected} semantic events"
        )));
    }
    Ok(())
}

fn planned_input_to_input(planned: &PlannedInput) -> INPUT {
    match planned {
        PlannedInput::KeyDown(key) => INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: *key,
                    wScan: 0,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: super::SMOOTHSCROLL_INPUT_MARKER,
                },
            },
        },
        PlannedInput::Wheel {
            flags,
            units,
            marker,
        } => INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: *units as u32,
                    dwFlags: *flags,
                    time: 0,
                    dwExtraInfo: *marker,
                },
            },
        },
        PlannedInput::KeyUp(key) => INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: *key,
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: super::SMOOTHSCROLL_INPUT_MARKER,
                },
            },
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use smoothscroll_core::wheel::{DeltaTransform, WheelAxis, WheelSemantic, WheelSequence};

    fn sequence(
        axis: WheelAxis,
        modifiers: smoothscroll_core::wheel::ModifierKeys,
        strategy: SmoothingStrategy,
    ) -> WheelSequence {
        WheelSequence {
            semantic: WheelSemantic { axis, modifiers },
            transport: WheelTransport::Native,
            strategy,
            delta_transform: DeltaTransform::Generic { sign: 1 },
        }
    }

    fn pulse(sequence: WheelSequence, units: i32) -> SemanticPulse {
        SemanticPulse { units, sequence }
    }

    fn vertical_ctrl() -> WheelSequence {
        sequence(
            WheelAxis::Vertical,
            ModifierKeys {
                ctrl: true,
                ..ModifierKeys::default()
            },
            SmoothingStrategy::Continuous,
        )
    }

    fn horizontal_none() -> WheelSequence {
        sequence(
            WheelAxis::Horizontal,
            ModifierKeys::default(),
            SmoothingStrategy::Continuous,
        )
    }

    #[test]
    fn released_ctrl_is_wrapped_atomically() {
        let plan =
            plan_native_inputs(&pulse(vertical_ctrl(), 120), ModifierKeys::default()).unwrap();
        assert_eq!(
            plan,
            vec![
                PlannedInput::KeyDown(VK_CONTROL),
                PlannedInput::Wheel {
                    flags: MOUSEEVENTF_WHEEL,
                    units: 120,
                    marker: super::super::SMOOTHSCROLL_INPUT_MARKER
                },
                PlannedInput::KeyUp(VK_CONTROL),
            ]
        );
    }

    #[test]
    fn held_ctrl_and_missing_alt_synthesizes_only_alt() {
        let captured = ModifierKeys {
            ctrl: true,
            alt: true,
            ..ModifierKeys::default()
        };
        let physical = ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        };
        let sequence = sequence(WheelAxis::Vertical, captured, SmoothingStrategy::Continuous);
        let plan = plan_native_inputs(&pulse(sequence, 120), physical).unwrap();
        assert_eq!(plan.first(), Some(&PlannedInput::KeyDown(VK_MENU)));
        assert_eq!(plan.last(), Some(&PlannedInput::KeyUp(VK_MENU)));
        assert!(!plan.contains(&PlannedInput::KeyUp(VK_CONTROL)));
    }

    #[test]
    fn native_horizontal_uses_hwheel_without_shift_translation() {
        let plan =
            plan_native_inputs(&pulse(horizontal_none(), 120), ModifierKeys::default()).unwrap();
        assert!(plan.iter().any(|op| matches!(
            op,
            PlannedInput::Wheel {
                flags: MOUSEEVENTF_HWHEEL,
                ..
            }
        )));
        assert!(!plan.iter().any(|op| matches!(
            op,
            PlannedInput::KeyDown(VK_SHIFT) | PlannedInput::KeyUp(VK_SHIFT)
        )));
    }

    #[test]
    fn prepare_rejects_compatibility_transport_with_vertical_axis() {
        let mismatch = WheelSequence {
            semantic: WheelSemantic {
                axis: WheelAxis::Vertical,
                modifiers: ModifierKeys::default(),
            },
            transport: WheelTransport::CompatibilityHorizontal,
            strategy: SmoothingStrategy::Continuous,
            delta_transform: DeltaTransform::Generic { sign: 1 },
        };
        assert!(<WindowsWheelEmitter as SemanticWheelEmitter>::prepare(
            &WindowsWheelEmitter,
            mismatch
        )
        .is_err());

        let compatible = WheelSequence {
            semantic: WheelSemantic {
                axis: WheelAxis::Horizontal,
                modifiers: ModifierKeys::default(),
            },
            transport: WheelTransport::CompatibilityHorizontal,
            strategy: SmoothingStrategy::Continuous,
            delta_transform: DeltaTransform::Generic { sign: 1 },
        };
        assert!(<WindowsWheelEmitter as SemanticWheelEmitter>::prepare(
            &WindowsWheelEmitter,
            compatible
        )
        .is_ok());
    }

    #[test]
    fn extra_physical_modifier_cancels_tail() {
        let result = plan_native_inputs(
            &pulse(vertical_ctrl(), 120),
            ModifierKeys {
                ctrl: true,
                alt: true,
                ..ModifierKeys::default()
            },
        );
        assert_eq!(result, Err(PlanError::ExtraPhysicalModifiers));
    }

    #[test]
    fn shift_and_alt_wrappers_are_atomic_and_reversed() {
        let captured = ModifierKeys {
            shift: true,
            alt: true,
            ..ModifierKeys::default()
        };
        let sequence = sequence(WheelAxis::Vertical, captured, SmoothingStrategy::Continuous);
        let plan = plan_native_inputs(&pulse(sequence, 120), ModifierKeys::default()).unwrap();
        assert_eq!(
            plan,
            vec![
                PlannedInput::KeyDown(VK_SHIFT),
                PlannedInput::KeyDown(VK_MENU),
                PlannedInput::Wheel {
                    flags: MOUSEEVENTF_WHEEL,
                    units: 120,
                    marker: super::super::SMOOTHSCROLL_INPUT_MARKER
                },
                PlannedInput::KeyUp(VK_MENU),
                PlannedInput::KeyUp(VK_SHIFT),
            ]
        );
    }

    #[test]
    fn no_key_up_without_matching_key_down() {
        let physical_all = ModifierKeys {
            shift: true,
            ctrl: true,
            alt: true,
            ..ModifierKeys::default()
        };
        let captured_all = physical_all;
        let sequence = sequence(
            WheelAxis::Vertical,
            captured_all,
            SmoothingStrategy::Continuous,
        );
        let plan = plan_native_inputs(&pulse(sequence, 120), physical_all).unwrap();
        assert!(plan
            .iter()
            .all(|op| matches!(op, PlannedInput::Wheel { .. })));
    }

    #[test]
    fn oversized_wheel_units_split_without_losing_distance() {
        let sequence = sequence(
            WheelAxis::Vertical,
            ModifierKeys::default(),
            SmoothingStrategy::Continuous,
        );
        let plan = plan_native_inputs(&pulse(sequence, 1_440), ModifierKeys::default()).unwrap();
        let total: i32 = plan
            .iter()
            .map(|op| match op {
                PlannedInput::Wheel { units, .. } => *units,
                _ => 0,
            })
            .sum();
        assert_eq!(total, 1_440);
        assert!(plan.len() > 1);
    }

    #[test]
    fn discrete_pulse_expands_to_exact_signed_notch_records() {
        let discrete = sequence(
            WheelAxis::Vertical,
            ModifierKeys::default(),
            SmoothingStrategy::DiscreteNotchPreserving,
        );
        let plan = plan_native_inputs(&pulse(discrete, 360), ModifierKeys::default()).unwrap();
        assert_eq!(
            plan,
            vec![
                PlannedInput::Wheel {
                    flags: MOUSEEVENTF_WHEEL,
                    units: 120,
                    marker: super::super::SMOOTHSCROLL_INPUT_MARKER
                },
                PlannedInput::Wheel {
                    flags: MOUSEEVENTF_WHEEL,
                    units: 120,
                    marker: super::super::SMOOTHSCROLL_INPUT_MARKER
                },
                PlannedInput::Wheel {
                    flags: MOUSEEVENTF_WHEEL,
                    units: 120,
                    marker: super::super::SMOOTHSCROLL_INPUT_MARKER
                },
            ]
        );

        let negative = plan_native_inputs(&pulse(discrete, -240), ModifierKeys::default()).unwrap();
        assert!(negative
            .iter()
            .all(|op| matches!(op, PlannedInput::Wheel { units: -120, .. })));
    }

    #[test]
    fn discrete_remainder_is_rejected() {
        let discrete = sequence(
            WheelAxis::Vertical,
            ModifierKeys::default(),
            SmoothingStrategy::DiscreteNotchPreserving,
        );
        assert_eq!(
            plan_native_inputs(&pulse(discrete, 130), ModifierKeys::default()),
            Err(PlanError::NotchRemainder)
        );
    }

    #[test]
    fn every_wheel_record_carries_marker() {
        let captured = ModifierKeys {
            ctrl: true,
            shift: true,
            ..ModifierKeys::default()
        };
        let sequence = sequence(WheelAxis::Vertical, captured, SmoothingStrategy::Continuous);
        let plan = plan_native_inputs(&pulse(sequence, 1_000), ModifierKeys::default()).unwrap();
        assert!(plan.iter().all(|op| match op {
            PlannedInput::Wheel { marker, .. } =>
                *marker == super::super::SMOOTHSCROLL_INPUT_MARKER,
            PlannedInput::KeyDown(_) | PlannedInput::KeyUp(_) => true,
        }));
    }

    #[test]
    fn ctrl_alt_partial_state_synthesizes_only_missing_modifier() {
        let captured = ModifierKeys {
            ctrl: true,
            alt: true,
            ..ModifierKeys::default()
        };
        let physical = ModifierKeys {
            ctrl: true,
            alt: true,
            shift: false,
            cmd: false,
        };
        let sequence = sequence(WheelAxis::Vertical, captured, SmoothingStrategy::Continuous);
        let plan = plan_native_inputs(&pulse(sequence, 120), physical).unwrap();
        assert!(plan
            .iter()
            .all(|op| matches!(op, PlannedInput::Wheel { .. })));
    }

    #[test]
    fn zero_units_produce_empty_plan() {
        assert!(
            plan_native_inputs(&pulse(vertical_ctrl(), 0), ModifierKeys::default())
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn wheel_chunks_split_without_losing_distance() {
        assert_eq!(wheel_chunks(1_440), vec![480, 480, 480]);
        assert_eq!(wheel_chunks(500), vec![480, 20]);
        assert_eq!(wheel_chunks(-1_440), vec![-480, -480, -480]);
        assert_eq!(wheel_chunks(-500), vec![-480, -20]);
    }

    #[test]
    fn zero_wheel_units_produce_no_chunks() {
        assert!(wheel_chunks(0).is_empty());
    }
}
