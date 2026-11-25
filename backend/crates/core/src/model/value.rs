//! Decoded values.
//!
//! [`Value`] is how the backend represents a piece of data once it has been
//! decoded, regardless of what it looked like on the wire. Even though the
//! ADJ defines several numeric wire types (`uint8`, `float32`...), once a
//! number is decoded it is always stored as an `f64`: what matters from
//! here on is the number itself, not how many bytes it took on the wire.
//! The wire type only matters while decoding, and lives in `NumericKind`
//! instead.

/// A single decoded value, of whichever shape the measurement defines.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    /// A numeric measurement, regardless of its original wire type.
    Number(f64),
    /// A boolean measurement.
    Bool(bool),
    /// The selected variant of an enum measurement, e.g. `"Operational"`.
    Enum(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_numbers_with_the_same_value_are_equal() {
        assert_eq!(Value::Number(1.5), Value::Number(1.5));
    }

    #[test]
    fn different_variants_are_never_equal_even_with_similar_data() {
        assert_ne!(Value::Bool(true), Value::Enum("true".to_string()));
    }
}
