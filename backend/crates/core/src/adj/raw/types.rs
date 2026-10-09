//! Raw ADJ JSON shapes and their conversion into `model` types.
//!
//! These shapes mirror the JSON exactly — including the fields this crate
//! intentionally doesn't model yet (`sockets`, `period`, `period_type`,
//! `socket`, `units`, `podUnits`), which are simply absent from these
//! structs and therefore ignored by serde, not rejected.

use crate::adj::error::{LoadError, MeasurementError, ProtectionError};
use crate::adj::info::{AdjInfo, ProtectionTypeInfo};
use crate::model::{
    AdjId, Measurement, MeasurementKind, NumericKind, Port, Protection, ProtectionKind, Severity,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct RawGeneralInfo {
    pub(crate) ports: HashMap<String, u16>,
    pub(crate) addresses: HashMap<String, String>,
    #[serde(rename = "protectionTypes", default)]
    pub(crate) protection_types: HashMap<String, RawProtectionType>,
    pub(crate) message_ids: HashMap<String, u16>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct RawProtectionType {
    #[serde(default)]
    pub(crate) range: bool,
    pub(crate) text: String,
    #[serde(default, rename = "textTime")]
    pub(crate) text_time: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct RawBoard {
    pub(crate) board_id: u16,
    #[serde(default)]
    pub(crate) mac: Option<String>,
    pub(crate) board_ip: String,
    #[serde(default)]
    pub(crate) measurements: Vec<String>,
    #[serde(default)]
    pub(crate) packets: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct RawMeasurement {
    pub(crate) id: u16,
    pub(crate) alias: String,
    pub(crate) name: String,
    #[serde(rename = "type")]
    pub(crate) kind: String,
    #[serde(default, rename = "displayUnits")]
    pub(crate) display_units: String,
    #[serde(default, rename = "enumValues")]
    pub(crate) enum_values: Vec<String>,
    #[serde(default)]
    pub(crate) protections: Vec<RawProtection>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct RawProtection {
    #[serde(rename = "type")]
    pub(crate) kind: String,
    pub(crate) value: Vec<f64>,
    #[serde(default = "default_fault")]
    pub(crate) fault: bool,
    #[serde(default)]
    pub(crate) time: Option<String>,
}

fn default_fault() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct RawPacket {
    pub(crate) id: u16,
    #[serde(rename = "type")]
    pub(crate) kind: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) variables: Vec<String>,
}

impl TryFrom<RawGeneralInfo> for AdjInfo {
    type Error = LoadError;

    fn try_from(raw: RawGeneralInfo) -> Result<Self, Self::Error> {
        let mut addresses = HashMap::with_capacity(raw.addresses.len());
        for (name, raw_addr) in raw.addresses {
            let addr = raw_addr
                .parse()
                .map_err(|source| LoadError::InvalidAddress {
                    name: name.clone(),
                    raw: raw_addr,
                    source,
                })?;
            addresses.insert(name, addr);
        }

        Ok(AdjInfo {
            ports: raw
                .ports
                .into_iter()
                .map(|(name, port)| (name, Port(port)))
                .collect(),
            addresses,
            message_ids: raw
                .message_ids
                .into_iter()
                .map(|(name, id)| (name, AdjId(id)))
                .collect(),
            protection_types: raw
                .protection_types
                .into_iter()
                .map(|(name, kind)| {
                    (
                        name,
                        ProtectionTypeInfo {
                            is_range: kind.range,
                            text: kind.text,
                            text_time: kind.text_time,
                        },
                    )
                })
                .collect(),
        })
    }
}

impl TryFrom<RawMeasurement> for Measurement {
    type Error = MeasurementError;

    fn try_from(raw: RawMeasurement) -> Result<Self, Self::Error> {
        if raw.protections.len() > 7 {
            return Err(MeasurementError::TooManyProtections {
                count: raw.protections.len(),
            });
        }

        let kind = parse_measurement_kind(&raw.kind, raw.enum_values)?;

        let mut protections = Vec::with_capacity(raw.protections.len());
        for (zero_based, raw_protection) in raw.protections.into_iter().enumerate() {
            let position = (zero_based + 1) as u16;
            let protection =
                Protection::try_from((raw_protection, position)).map_err(|source| {
                    MeasurementError::Protection {
                        index: position as usize,
                        source,
                    }
                })?;
            protections.push(protection);
        }

        Ok(Measurement {
            id: AdjId(raw.id),
            alias: raw.alias,
            name: raw.name,
            display_units: raw.display_units,
            kind,
            protections,
        })
    }
}

impl TryFrom<(RawProtection, u16)> for Protection {
    type Error = ProtectionError;

    fn try_from((raw, position): (RawProtection, u16)) -> Result<Self, Self::Error> {
        let kind = parse_protection_kind(&raw.kind, &raw.value)?;
        let time = match &raw.time {
            Some(text) => parse_duration(text)?,
            None => Duration::ZERO,
        };

        Ok(Protection {
            id: AdjId(position),
            kind,
            severity: if raw.fault {
                Severity::Fault
            } else {
                Severity::Warning
            },
            time,
        })
    }
}

fn parse_measurement_kind(
    kind: &str,
    enum_values: Vec<String>,
) -> Result<MeasurementKind, MeasurementError> {
    let numeric = |wire_type| MeasurementKind::Numeric { wire_type };

    match kind {
        "uint8" => Ok(numeric(NumericKind::U8)),
        "uint16" => Ok(numeric(NumericKind::U16)),
        "uint32" => Ok(numeric(NumericKind::U32)),
        "uint64" => Ok(numeric(NumericKind::U64)),
        "int8" => Ok(numeric(NumericKind::I8)),
        "int16" => Ok(numeric(NumericKind::I16)),
        "int32" => Ok(numeric(NumericKind::I32)),
        "int64" => Ok(numeric(NumericKind::I64)),
        "float32" => Ok(numeric(NumericKind::F32)),
        "float64" => Ok(numeric(NumericKind::F64)),
        "bool" => Ok(MeasurementKind::Boolean),
        "enum" if !enum_values.is_empty() => Ok(MeasurementKind::Enum {
            options: enum_values,
        }),
        "enum" => Err(MeasurementError::MissingEnumValues),
        other => Err(MeasurementError::UnknownType(other.to_string())),
    }
}

fn parse_protection_kind(kind: &str, value: &[f64]) -> Result<ProtectionKind, ProtectionError> {
    fn one(kind: &str, value: &[f64]) -> Result<f64, ProtectionError> {
        match value {
            [bound] => Ok(*bound),
            other => Err(ProtectionError::WrongBoundCount {
                kind: kind.to_string(),
                expected: 1,
                got: other.len(),
            }),
        }
    }

    fn two(kind: &str, value: &[f64]) -> Result<(f64, f64), ProtectionError> {
        match value {
            [min, max] => Ok((*min, *max)),
            other => Err(ProtectionError::WrongBoundCount {
                kind: kind.to_string(),
                expected: 2,
                got: other.len(),
            }),
        }
    }

    match kind {
        "Above" => Ok(ProtectionKind::Above {
            limit: one(kind, value)?,
        }),
        "Below" => Ok(ProtectionKind::Below {
            limit: one(kind, value)?,
        }),
        "Equal" => Ok(ProtectionKind::Equal {
            target: one(kind, value)?,
        }),
        "NotEqual" => Ok(ProtectionKind::NotEqual {
            target: one(kind, value)?,
        }),
        "Range" => {
            let (min, max) = two(kind, value)?;
            Ok(ProtectionKind::Range { min, max })
        }
        other => Err(ProtectionError::UnknownType(other.to_string())),
    }
}

/// Parses a duration string like `"500ms"`, `"3s"` or `"10us"`.
///
/// Rejects non-finite or negative numbers explicitly before handing them to
/// [`Duration::from_secs_f64`], which panics on either — this reads
/// externally-authored ADJ text, so a malformed `"time"` (e.g. `"-5ms"`)
/// must become an error, not a panic.
fn parse_duration(text: &str) -> Result<Duration, ProtectionError> {
    let Some(split_at) = text.find(|c: char| c.is_ascii_alphabetic()) else {
        return Err(ProtectionError::InvalidTime(text.to_string()));
    };
    let (number, unit) = text.split_at(split_at);

    let value: f64 = number
        .parse()
        .map_err(|_| ProtectionError::InvalidTime(text.to_string()))?;

    if !value.is_finite() || value < 0.0 {
        return Err(ProtectionError::InvalidTime(text.to_string()));
    }

    let seconds = match unit {
        "s" => value,
        "ms" => value / 1_000.0,
        "us" => value / 1_000_000.0,
        _ => return Err(ProtectionError::InvalidTime(text.to_string())),
    };

    Ok(Duration::from_secs_f64(seconds))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adj::raw::loader::load_board;
    use crate::model::PacketKind;
    use std::net::IpAddr;

    fn raw_protection(
        kind: &str,
        value: Vec<f64>,
        fault: bool,
        time: Option<&str>,
    ) -> RawProtection {
        RawProtection {
            kind: kind.to_string(),
            value,
            fault,
            time: time.map(str::to_string),
        }
    }

    fn must_build_protection(raw: RawProtection, position: u16) -> Protection {
        let Ok(protection) = Protection::try_from((raw, position)) else {
            unreachable!("valid protection should convert cleanly");
        };
        protection
    }

    #[test]
    fn numeric_measurement_types_map_to_their_numeric_kind() {
        let cases = [
            ("uint8", NumericKind::U8),
            ("uint16", NumericKind::U16),
            ("uint32", NumericKind::U32),
            ("uint64", NumericKind::U64),
            ("int8", NumericKind::I8),
            ("int16", NumericKind::I16),
            ("int32", NumericKind::I32),
            ("int64", NumericKind::I64),
            ("float32", NumericKind::F32),
            ("float64", NumericKind::F64),
        ];

        for (type_name, expected) in cases {
            assert!(matches!(
                parse_measurement_kind(type_name, vec![]),
                Ok(MeasurementKind::Numeric { wire_type }) if wire_type == expected
            ));
        }
    }

    #[test]
    fn bool_type_maps_to_boolean() {
        assert!(matches!(
            parse_measurement_kind("bool", vec![]),
            Ok(MeasurementKind::Boolean)
        ));
    }

    #[test]
    fn enum_type_with_values_keeps_their_order() {
        let options = vec!["Idle".to_string(), "Fault".to_string()];
        assert!(matches!(
            parse_measurement_kind("enum", options.clone()),
            Ok(MeasurementKind::Enum { options: got }) if got == options
        ));
    }

    #[test]
    fn enum_type_without_values_is_an_error() {
        assert!(matches!(
            parse_measurement_kind("enum", vec![]),
            Err(MeasurementError::MissingEnumValues)
        ));
    }

    #[test]
    fn unknown_measurement_type_is_an_error() {
        assert!(matches!(
            parse_measurement_kind("potato", vec![]),
            Err(MeasurementError::UnknownType(t)) if t == "potato"
        ));
    }

    #[test]
    fn one_bound_protection_kinds_take_a_single_value() {
        assert!(matches!(
            parse_protection_kind("Above", &[1.0]),
            Ok(ProtectionKind::Above { limit }) if limit == 1.0
        ));
        assert!(matches!(
            parse_protection_kind("Below", &[2.0]),
            Ok(ProtectionKind::Below { limit }) if limit == 2.0
        ));
        assert!(matches!(
            parse_protection_kind("Equal", &[3.0]),
            Ok(ProtectionKind::Equal { target }) if target == 3.0
        ));
        assert!(matches!(
            parse_protection_kind("NotEqual", &[4.0]),
            Ok(ProtectionKind::NotEqual { target }) if target == 4.0
        ));
    }

    #[test]
    fn range_protection_takes_two_values() {
        assert!(matches!(
            parse_protection_kind("Range", &[0.0, 48.0]),
            Ok(ProtectionKind::Range { min, max }) if min == 0.0 && max == 48.0
        ));
    }

    #[test]
    fn wrong_bound_count_is_an_error() {
        assert!(matches!(
            parse_protection_kind("Above", &[1.0, 2.0]),
            Err(ProtectionError::WrongBoundCount {
                expected: 1,
                got: 2,
                ..
            })
        ));
        assert!(matches!(
            parse_protection_kind("Range", &[1.0]),
            Err(ProtectionError::WrongBoundCount {
                expected: 2,
                got: 1,
                ..
            })
        ));
    }

    #[test]
    fn unknown_protection_type_is_an_error() {
        assert!(matches!(
            parse_protection_kind("Potato", &[1.0]),
            Err(ProtectionError::UnknownType(t)) if t == "Potato"
        ));
    }

    #[test]
    fn fault_flag_selects_severity_default_true() {
        let protection = must_build_protection(raw_protection("Equal", vec![1.0], true, None), 1);
        assert_eq!(protection.severity, Severity::Fault);

        let protection = must_build_protection(raw_protection("Equal", vec![1.0], false, None), 1);
        assert_eq!(protection.severity, Severity::Warning);
    }

    #[test]
    fn protection_id_is_its_position_not_a_global_id() {
        let protection = must_build_protection(raw_protection("Equal", vec![1.0], true, None), 3);
        assert_eq!(protection.id, AdjId(3));
    }

    #[test]
    fn missing_time_defaults_to_zero() {
        let protection = must_build_protection(raw_protection("Equal", vec![1.0], true, None), 1);
        assert_eq!(protection.time, Duration::ZERO);
    }

    #[test]
    fn duration_strings_parse_with_their_unit() {
        assert!(matches!(parse_duration("500ms"), Ok(d) if d == Duration::from_millis(500)));
        assert!(matches!(parse_duration("3s"), Ok(d) if d == Duration::from_secs(3)));
        assert!(matches!(parse_duration("10us"), Ok(d) if d == Duration::from_micros(10)));
    }

    #[test]
    fn invalid_duration_strings_are_rejected() {
        assert!(matches!(
            parse_duration("banana"),
            Err(ProtectionError::InvalidTime(_))
        ));
        assert!(matches!(
            parse_duration("-5ms"),
            Err(ProtectionError::InvalidTime(_))
        ));
        assert!(matches!(
            parse_duration("5"),
            Err(ProtectionError::InvalidTime(_))
        ));
    }

    #[test]
    fn general_info_converts_into_adj_info() {
        let mut protection_types = HashMap::new();
        protection_types.insert(
            "Range".to_string(),
            RawProtectionType {
                range: true,
                text: "Value out of range {} (measured: %)".to_string(),
                text_time: None,
            },
        );
        let raw = RawGeneralInfo {
            ports: HashMap::from([("TCP_SERVER".to_string(), 50500u16)]),
            addresses: HashMap::from([("backend".to_string(), "192.168.0.9".to_string())]),
            protection_types,
            message_ids: HashMap::from([("fault".to_string(), 2u16)]),
        };

        let Ok(info) = AdjInfo::try_from(raw) else {
            unreachable!("a well-formed RawGeneralInfo should convert cleanly");
        };

        assert_eq!(info.ports["TCP_SERVER"], Port(50500));
        assert_eq!(info.addresses["backend"], IpAddr::from([192, 168, 0, 9]));
        assert_eq!(info.message_ids["fault"], AdjId(2));
        assert!(info.protection_types["Range"].is_range);
    }

    #[test]
    fn general_info_rejects_an_invalid_address() {
        let raw = RawGeneralInfo {
            ports: HashMap::new(),
            addresses: HashMap::from([("backend".to_string(), "not-an-ip".to_string())]),
            protection_types: HashMap::new(),
            message_ids: HashMap::new(),
        };

        assert!(matches!(
            AdjInfo::try_from(raw),
            Err(LoadError::InvalidAddress { .. })
        ));
    }

    #[test]
    fn measurement_with_too_many_protections() {
        let mut raw = RawMeasurement {
            id: 100,
            alias: "too_many".to_string(),
            name: "Too Many Protections".to_string(),
            kind: "float32".to_string(),
            display_units: "V".to_string(),
            enum_values: vec![],
            protections: vec![],
        };

        for _ in 0..8 {
            raw.protections
                .push(raw_protection("Equal", vec![1.0], true, None));
        }

        assert!(matches!(
            Measurement::try_from(raw),
            Err(MeasurementError::TooManyProtections { count: 8 })
        ))
    }

    #[test]
    fn board_incorporates_synthetic_protection_packets() {
        // A scratch directory, unique per test invocation (pid + a counter)
        // so parallel test runs never collide on the same path.
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "software_core_adj_test_{}_{unique}",
            std::process::id()
        ));

        if std::fs::create_dir_all(&dir).is_err() {
            unreachable!("should be able to create a scratch test directory");
        }

        let board_json = r#"{
            "board_id": 99,
            "mac": "aa:bb:cc:dd:ee:ff",
            "board_ip": "127.0.0.1",
            "measurements": ["measurements.json"],
            "packets": ["packets.json"]
        }"#;
        let measurements_json = r#"[
            {
                "id": 100,
                "alias": "mock_alias",
                "name": "Mock Measurement",
                "type": "float32",
                "protections": [
                    { "type": "Equal", "value": [1.0], "fault": true },
                    { "type": "Equal", "value": [2.0], "fault": true }
                ]
            }
        ]"#;

        if std::fs::write(dir.join("test_board.json"), board_json).is_err() {
            unreachable!("should be able to write the mock board file");
        }
        if std::fs::write(dir.join("measurements.json"), measurements_json).is_err() {
            unreachable!("should be able to write the mock measurements file");
        }
        if std::fs::write(dir.join("packets.json"), "[]").is_err() {
            unreachable!("should be able to write the mock packets file");
        }

        let board_name = "H12_Test_Board";
        let result = load_board(&dir, board_name, "test_board.json");
        let _ = std::fs::remove_dir_all(&dir);

        let board = match result {
            Ok(board) => board,
            Err(err) => unreachable!("board loading should succeed: {err}"),
        };

        // We provided 0 standard packets and 2 protections, so the total
        // synthetic packets injected into the board must equal 2.
        let protection_count = board
            .packets
            .values()
            .filter(|p| matches!(p.kind, PacketKind::Protection(_)))
            .count();
        assert_eq!(
            protection_count, 2,
            "board should contain exactly 2 protection packets"
        );

        // For protection index 0 (pos = 1): (1 << 13) | 100 = 8192 | 100 = 8292
        let Some(first) = board.packets.get(&AdjId(8292)) else {
            unreachable!("first synthetic protection packet should be at id 8292");
        };
        assert_eq!(first.board, board.id);
        assert_eq!(first.name, format!("{board_name}_mock_alias_protection_1"));

        // For protection index 1 (pos = 2): (2 << 13) | 100 = 16384 | 100 = 16484
        let Some(second) = board.packets.get(&AdjId(16484)) else {
            unreachable!("second synthetic protection packet should be at id 16484");
        };
        assert_eq!(second.name, format!("{board_name}_mock_alias_protection_2"));
    }
}
