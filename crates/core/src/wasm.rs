//! WASM-friendly engine wrapper. Mirrors the native API but takes settings
//! as JSON strings to avoid binding the full `EffectiveSettings` shape over
//! the JS/Rust boundary. The frontend reuses its existing `AppSettings` JSON.

#![cfg(all(target_arch = "wasm32", feature = "wasm"))]

use crate::engine::{EngineOutput, SmoothScrollEngine};
use crate::input_source::InputSource;
use crate::settings::{AppSettings, EffectiveSettings};
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
        self.engine
            .on_wheel_with_source(delta, now_ms as u64, InputSource::Wheel, &self.eff);
    }

    pub fn on_hwheel(&mut self, delta: i32, now_ms: f64) {
        self.engine
            .on_hwheel_with_source(delta, now_ms as u64, InputSource::Wheel, &self.eff);
    }

    /// Step the engine. Returns `[vertical, horizontal]` pulses.
    pub fn step(&mut self, dt_ms: f64) -> Box<[i32]> {
        let EngineOutput {
            vertical,
            horizontal,
        } = self.engine.step(dt_ms, &self.eff);
        Box::new([vertical, horizontal])
    }

    pub fn has_pending_work(&self) -> bool {
        self.engine.has_pending_work()
    }

    pub fn reset(&mut self) {
        self.engine.reset_axes();
    }
}
