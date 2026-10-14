//! Protection declarations.
//!
//! A [`Protection`] is a bound checked against a measurement's decoded
//! value, as declared for that measurement in the ADJ (see
//! `<PLACA>_measurements.json`, `protections` array). This describes the
//! *declaration*: what to watch for and how
//! severe it is. It is not the packet actually received over the wire when
//! a protection triggers; that belongs with the rest of the wire packets,
//! once `packet` exists.
//!
//! In ADJv2, a protection was just a `message` with a specific kind.
//! ADJv3 splits them into two unrelated wire formats, so from here on
//! `Protection` and a future `Message` type are not related at all.

use crate::model::AdjId;
use std::time::Duration;

/// What a protection checks, and the bound(s) it needs.
///
/// Modeled as data-carrying variants instead of a flat `value: Vec<f64>`
/// plus a `range: bool` flag (as the ADJ JSON represents it), so a
/// protection with the wrong number of bounds for its kind — e.g. an
/// `Above` with two values, or a `Range` with only one — cannot be
/// represented at all.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProtectionKind {
    /// Triggers when the value goes above `limit`.
    Above {
        /// The upper limit.
        limit: f64,
    },
    /// Triggers when the value goes below `limit`.
    Below {
        /// The lower limit.
        limit: f64,
    },
    /// Triggers when the value equals `target`.
    Equal {
        /// The value that must not occur.
        target: f64,
    },
    /// Triggers when the value is different from `target`.
    NotEqual {
        /// The value that is expected.
        target: f64,
    },
    /// Triggers when the value leaves the `[min, max]` interval.
    ///
    /// Unlike [`super::Range`], both bounds are mandatory here: the ADJ
    /// always provides exactly two values for a `Range` protection, so
    /// there is no "open-ended" case to represent.
    Range {
        /// The lower bound of the interval.
        min: f64,
        /// The upper bound of the interval.
        max: f64,
    },
}

/// How severe a triggered protection is.
///
/// Only two values, unlike a message's severity: a protection is either a
/// [`Severity::Fault`], which stops the vehicle, or a [`Severity::Warning`],
/// which does not.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Severity {
    /// Stops the vehicle automatically.
    Fault,
    /// Flags the value as unexpected, without stopping the vehicle.
    Warning,
}

/// A single protection watching a measurement, as declared in the ADJ.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Protection {
    /// This protection's position within its measurement's `protections`
    /// list, encoded as an [`AdjId`] in the 1–7 range.
    ///
    /// This is *not* an independently assigned id from the global ADJ id
    /// space (`[0, 8191]`): a protection is only ever
    /// addressed relative to the measurement that owns it. On the wire,
    /// this position becomes the 3-bit `pos` field that, combined with the
    /// owning measurement's 13-bit id, forms the compound id — that
    /// combination is `protocol`'s job, not this type's.
    pub id: AdjId,
    /// What this protection checks and its bound(s).
    pub kind: ProtectionKind,
    /// How severe it is once triggered.
    pub severity: Severity,
    /// How long the value must stay out of bounds before this protection
    /// triggers. `Duration::ZERO` (the ADJ's default) means it triggers
    /// immediately.
    pub time: Duration,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_range_protection_always_carries_both_bounds() {
        let protection = Protection {
            id: AdjId(1),
            kind: ProtectionKind::Range {
                min: 0.0,
                max: 48.0,
            },
            severity: Severity::Fault,
            time: Duration::ZERO,
        };

        let ProtectionKind::Range { min, max } = protection.kind else {
            unreachable!("protection was just constructed as Range above");
        };

        assert_eq!(min, 0.0);
        assert_eq!(max, 48.0);
    }

    #[test]
    fn two_protections_with_the_same_data_are_equal() {
        let a = Protection {
            id: AdjId(2),
            kind: ProtectionKind::Above { limit: 100.0 },
            severity: Severity::Warning,
            time: Duration::from_millis(500),
        };
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn zero_time_means_it_triggers_immediately() {
        let protection = Protection {
            id: AdjId(3),
            kind: ProtectionKind::Equal { target: 0.0 },
            severity: Severity::Fault,
            time: Duration::ZERO,
        };

        assert_eq!(protection.time, Duration::ZERO);
    }

    #[test]
    fn a_protections_id_is_its_position_not_a_global_id() {
        // Two different measurements can each have a protection at
        // position 1 — they are unrelated protections that happen to
        // share the same "slot" id, disambiguated by their measurement.
        let first_measurement_protection = Protection {
            id: AdjId(1),
            kind: ProtectionKind::Below { limit: -10.0 },
            severity: Severity::Warning,
            time: Duration::ZERO,
        };
        let second_measurement_protection = Protection {
            id: AdjId(1),
            kind: ProtectionKind::Above { limit: 90.0 },
            severity: Severity::Fault,
            time: Duration::ZERO,
        };

        assert_eq!(
            first_measurement_protection.id,
            second_measurement_protection.id
        );
        assert_ne!(
            first_measurement_protection.kind,
            second_measurement_protection.kind
        );
    }
}
