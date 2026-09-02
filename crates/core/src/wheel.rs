use crate::input_source::InputSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ModifierKeys {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub cmd: bool,
}

impl ModifierKeys {
    pub fn is_ctrl_only(self) -> bool {
        self.ctrl && !self.shift && !self.alt && !self.cmd
    }

    pub fn without_cmd(self) -> Self {
        Self { cmd: false, ..self }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WheelAxis {
    Vertical,
    Horizontal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct WheelSemantic {
    pub axis: WheelAxis,
    pub modifiers: ModifierKeys,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WheelInputEvent {
    pub delta: i32,
    pub semantic: WheelSemantic,
    pub source: InputSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WheelTransport {
    Native,
    CompatibilityHorizontal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SmoothingStrategy {
    #[default]
    Continuous,
    DiscreteNotchPreserving,
}

#[derive(Debug, Clone, Copy)]
pub enum DeltaTransform {
    Generic { sign: i8 },
    CtrlZoom { sensitivity: f64, sign: i8 },
}

impl PartialEq for DeltaTransform {
    fn eq(&self, other: &Self) -> bool {
        match (*self, *other) {
            (Self::Generic { sign: left }, Self::Generic { sign: right }) => left == right,
            (
                Self::CtrlZoom {
                    sensitivity: left,
                    sign: left_sign,
                },
                Self::CtrlZoom {
                    sensitivity: right,
                    sign: right_sign,
                },
            ) => left.to_bits() == right.to_bits() && left_sign == right_sign,
            _ => false,
        }
    }
}

impl Eq for DeltaTransform {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WheelSequence {
    pub semantic: WheelSemantic,
    pub transport: WheelTransport,
    pub strategy: SmoothingStrategy,
    pub delta_transform: DeltaTransform,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SemanticPulse {
    pub units: i32,
    pub sequence: WheelSequence,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::input_source::InputSource;

    #[test]
    fn shift_vertical_remains_vertical() {
        let event = WheelInputEvent {
            delta: 120,
            semantic: WheelSemantic {
                axis: WheelAxis::Vertical,
                modifiers: ModifierKeys {
                    shift: true,
                    ..ModifierKeys::default()
                },
            },
            source: InputSource::Wheel,
        };
        assert_eq!(event.semantic.axis, WheelAxis::Vertical);
        assert!(event.semantic.modifiers.shift);
    }

    #[test]
    fn ctrl_only_rejects_multi_modifier_combinations() {
        assert!(ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        }
        .is_ctrl_only());
        assert!(!ModifierKeys {
            ctrl: true,
            shift: true,
            ..ModifierKeys::default()
        }
        .is_ctrl_only());
        assert!(!ModifierKeys {
            ctrl: true,
            alt: true,
            ..ModifierKeys::default()
        }
        .is_ctrl_only());
    }

    #[test]
    fn sequence_identity_uses_all_semantic_policy_fields() {
        let base = WheelSequence {
            semantic: WheelSemantic {
                axis: WheelAxis::Vertical,
                modifiers: ModifierKeys::default(),
            },
            transport: WheelTransport::Native,
            strategy: SmoothingStrategy::Continuous,
            delta_transform: DeltaTransform::Generic { sign: 1 },
        };
        assert_ne!(
            base,
            WheelSequence {
                semantic: WheelSemantic {
                    modifiers: ModifierKeys {
                        alt: true,
                        ..ModifierKeys::default()
                    },
                    ..base.semantic
                },
                ..base
            }
        );
        assert_ne!(
            base,
            WheelSequence {
                transport: WheelTransport::CompatibilityHorizontal,
                ..base
            }
        );
        assert_ne!(
            base,
            WheelSequence {
                strategy: SmoothingStrategy::DiscreteNotchPreserving,
                ..base
            }
        );
        assert_ne!(
            base,
            WheelSequence {
                delta_transform: DeltaTransform::Generic { sign: -1 },
                ..base
            }
        );
    }

    #[test]
    fn zoom_sensitivity_identity_is_bitwise() {
        let zoom = |sensitivity| DeltaTransform::CtrlZoom {
            sensitivity,
            sign: 1,
        };
        assert_eq!(zoom(1.0), zoom(1.0));
        assert_ne!(zoom(0.0), zoom(-0.0));
    }
}
