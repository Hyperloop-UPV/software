use crate::adj::{ValueType, Variable};
use anyhow::Result;
use rand::Rng;

#[derive(Clone)]
pub struct RandomValueGenerator;

impl RandomValueGenerator {
    pub fn new() -> Self {
        Self
    }

    pub fn generate_for_variable(&self, variable: &Variable) -> Result<f64> {
        let mut rng = rand::thread_rng();

        // Check if we have warning ranges
        if let Some(warning_range) = &variable.warning_range {
            if let (Some(min), Some(max)) = (warning_range[0], warning_range[1]) {
                // Ensure the range is valid
                if min < max {
                    // Clamp to type bounds
                    let type_min = variable.value_type.min_value();
                    let type_max = variable.value_type.max_value();
                    let clamped_min = min.max(type_min);
                    let clamped_max = max.min(type_max);

                    // 90% chance to be within warning range
                    if rng.gen_bool(0.9) {
                        return Ok(rng.gen_range(clamped_min..=clamped_max));
                    } else {
                        // 10% chance to be slightly outside (but still within type bounds)
                        let range = clamped_max - clamped_min;
                        let extended_min = (clamped_min - range * 0.1).max(type_min);
                        let extended_max = (clamped_max + range * 0.1).min(type_max);
                        return Ok(rng.gen_range(extended_min..=extended_max));
                    }
                }
            }
        }

        // Check safe range
        if let Some(safe_range) = &variable.safe_range {
            if let (Some(min), Some(max)) = (safe_range[0], safe_range[1]) {
                if min < max {
                    let type_min = variable.value_type.min_value();
                    let type_max = variable.value_type.max_value();
                    let clamped_min = min.max(type_min);
                    let clamped_max = max.min(type_max);
                    return Ok(rng.gen_range(clamped_min..=clamped_max));
                }
            }
        }

        // Fallback to type-based generation with reasonable defaults
        self.generate_for_type(&variable.value_type)
    }

    pub fn generate_for_type(&self, value_type: &ValueType) -> Result<f64> {
        let mut rng = rand::thread_rng();
        let value = match value_type {
            ValueType::Bool => {
                if rng.gen_bool(0.5) {
                    1.0
                } else {
                    0.0
                }
            }
            ValueType::Enum(variants) => {
                if variants.is_empty() {
                    0.0
                } else {
                    rng.gen_range(0..variants.len()) as f64
                }
            }
            _ => {
                // For numeric types, generate reasonable values
                let min = value_type.min_value();
                let max = value_type.max_value();

                // For integer types, generate values in a reasonable range
                match value_type {
                    ValueType::UInt8 | ValueType::UInt16 | ValueType::UInt32 => {
                        // Generate values between 0 and 1000 or type max, whichever is smaller
                        let reasonable_max = max.min(1000.0);
                        rng.gen_range(0.0..=reasonable_max)
                    }
                    ValueType::Int8 | ValueType::Int16 | ValueType::Int32 => {
                        // Generate values between -500 and 500 or type bounds
                        let reasonable_min = min.max(-500.0);
                        let reasonable_max = max.min(500.0);
                        rng.gen_range(reasonable_min..=reasonable_max)
                    }
                    ValueType::Float32 | ValueType::Float64 => {
                        // Generate reasonable float values between -1000 and 1000
                        rng.gen_range(-1000.0..=1000.0)
                    }
                    _ => {
                        // For large integer types, use a smaller range
                        rng.gen_range(0.0..=10000.0)
                    }
                }
            }
        };

        Ok(value)
    }

    pub fn generate_fault_value(&self) -> f64 {
        // Generate values that are likely to trigger faults
        if rand::thread_rng().gen_bool(0.5) {
            // Very high value
            f64::MAX * 0.9
        } else {
            // Very low value (potentially negative for signed types)
            -f64::MAX * 0.9
        }
    }
}
