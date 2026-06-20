//! Linux accessibility signals — stub.
//! No reliable system-wide Reduce Motion signal on Linux.

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;

pub struct LinuxAccessibilitySignals;

impl AccessibilitySignals for LinuxAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        false
    }
    fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        Ok(HookHandle::new(Box::new(())))
    }
}
