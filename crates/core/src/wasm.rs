//! WASM-friendly engine wrapper. Mirrors the native API but takes settings
//! as JSON strings to avoid binding the full `EffectiveSettings` shape over
//! the JS/Rust boundary. The frontend reuses its existing `AppSettings` JSON.

#![cfg(all(target_arch = "wasm32", feature = "wasm"))]

use crate::engine::{EngineOutput, SmoothScrollEngine};
use crate::input_source::InputSource;
use crate::settings::{AppSettings, EffectiveSettings};
use crate::wheel::{
    DeltaTransform, ModifierKeys, SmoothingStrategy, WheelAxis, WheelInputEvent, WheelSemantic,
    WheelSequence, WheelTransport,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmEngine {
    engine: SmoothScrollEngine,
    eff: EffectiveSettings,
}

#[wasm_bindgen]
impl WasmEngine {
    /// Build from a JSON-serialized AppSettings.
    #[wasm_bindgen(constructor)]
    pub fn new(json_settings: &str) -> Result<WasmEngine, JsError> {
        let s: AppSettings = serde_json::from_str(json_settings)
            .map_err(|e| JsError::new(&format!("settings parse: {e}")))?;
        let eff = EffectiveSettings::from_settings(&s);
        Ok(WasmEngine {
            engine: SmoothScrollEngine::new(),
            eff,
        })
    }

    /// Hot-swap settings without rebuilding the engine state.
    pub fn update_settings(&mut self, json_settings: &str) -> Result<(), JsError> {
        let s: AppSettings = serde_json::from_str(json_settings)
            .map_err(|e| JsError::new(&format!("settings parse: {e}")))?;
        self.eff = EffectiveSettings::from_settings(&s);
        Ok(())
    }

    /// Inject a wheel event. `now_ms` is a JS-supplied monotonic timestamp.
    pub fn on_wheel(&mut self, delta: i32, now_ms: f64) {
        self.register(delta, WheelAxis::Vertical, now_ms);
    }

    pub fn on_hwheel(&mut self, delta: i32, now_ms: f64) {
        self.register(delta, WheelAxis::Horizontal, now_ms);
    }

    /// Step the engine. Returns `[vertical, horizontal]` pulses.
    pub fn step(&mut self, dt_ms: f64) -> Box<[i32]> {
        let EngineOutput {
            vertical,
            horizontal,
        } = self.engine.step(dt_ms, &self.eff);
        let vertical = vertical.map_or(0, |pulse| {
            self.engine
                .finish_axis_pulse(WheelAxis::Vertical, pulse.sequence);
            pulse.units
        });
        let horizontal = horizontal.map_or(0, |pulse| {
            self.engine
                .finish_axis_pulse(WheelAxis::Horizontal, pulse.sequence);
            pulse.units
        });
        Box::new([vertical, horizontal])
    }

    pub fn has_pending_work(&self) -> bool {
        self.engine.has_pending_work()
    }

    pub fn reset(&mut self) {
        self.engine.reset_axes();
    }

    fn register(&mut self, delta: i32, axis: WheelAxis, now_ms: f64) {
        let semantic = WheelSemantic {
            axis,
            modifiers: ModifierKeys::default(),
        };
        self.engine.register(
            WheelInputEvent {
                delta,
                semantic,
                source: InputSource::Wheel,
            },
            WheelSequence {
                semantic,
                transport: WheelTransport::Native,
                strategy: SmoothingStrategy::Continuous,
                delta_transform: DeltaTransform::Generic {
                    sign: if self.eff.reverse_wheel_direction {
                        -1
                    } else {
                        1
                    },
                },
            },
            now_ms as u64,
            &self.eff,
        );
    }
}
