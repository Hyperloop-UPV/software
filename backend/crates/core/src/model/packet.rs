//! Wire packets.
//!
//! A [`Packet`] is a single message actually sent or received over the
//! wire, once decoded. This is the *instance* — as opposed to
//! [`super::Measurement`] and [`super::Protection`], which describe what a
//! packet or a protection *can* look like, or [`super::PacketDef`], which
//! describes a whole packet.

use super::{AdjId, PacketType, Value};
use std::marker::PhantomData;

/// A short timestamp carrying only the time of day: hour, minute, second
/// and a sub-second fraction, each one byte.
///
/// Used by [`ProtectionPacket`] and [`MessagePacket`]. Unlike a full
/// calendar timestamp, this only records *when today* something happened;
/// the date is assumed to be the day the packet was received.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ShortTimestamp {
    /// The hour, 0–23.
    pub hour: u8,
    /// The minute, 0–59.
    pub minute: u8,
    /// The second, 0–59.
    pub second: u8,
    /// The sub-second fraction, as the raw byte on the wire.
    ///
    /// This byte was labeled `resv` ("reserved for alignment") at first,
    /// but it is in fact used for sub-second resolution. Its exact unit
    /// (e.g. milliseconds, or 1/256ths of a second) hasn't been confirmed
    /// yet, so it is kept as a raw `u8` here instead of converted to
    /// something like a `Duration` — convert it once the unit is settled.
    pub subsecond: u8,
}

/// Tags a [`DataOrderPacket`] as a board's periodic telemetry
/// ([`DataPacket`]) rather than a command sent to one.
///
/// Carries no data — see [`DataOrderPacket`] for why it exists at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Data;

/// Tags a [`DataOrderPacket`] as a command sent to a board
/// ([`OrderPacket`]) rather than telemetry received from one.
///
/// Carries no data — see [`DataOrderPacket`] for why it exists at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Order;

/// Bridges a [`DataOrderPacket`]'s phantom `Kind` to the runtime
/// [`PacketType`] variant it stands for.
///
/// `protocol::packet::data_order`'s `encode`/`decode` are generic over
/// `Kind`: they're written once and work for both [`Data`] and [`Order`],
/// instead of needing a near-identical copy per type. This trait is the
/// one yes/no question that generic code can't answer on its own —
/// "is this `PacketDef`'s type actually the one I was asked to
/// encode/decode?" — everything after that (pulling out the
/// measurements) is already handled by [`PacketType::measurements`],
/// type-agnostic, so there's no need to redo that here.
pub trait PacketTypeTag {
    /// Whether `packet_type` is the variant this `Kind` stands for.
    fn matches(packet_type: &PacketType) -> bool;
}

impl PacketTypeTag for Data {
    fn matches(packet_type: &PacketType) -> bool {
        matches!(packet_type, PacketType::Data(_))
    }
}

impl PacketTypeTag for Order {
    fn matches(packet_type: &PacketType) -> bool {
        matches!(packet_type, PacketType::Order(_))
    }
}

/// A Data/Order packet: the decoded values of the measurements a board just
/// sent, or that an order is about to send to one.
///
/// The wire protocol is positional: values are not individually tagged
/// with their measurement's id, just written back to back in the order
/// their [`super::Measurement`]s appear in this packet's
/// [`super::PacketType::Data`] list. `values[i]` is the decoded value of
/// that list's `i`-th measurement — matching them up by position is
/// `protocol`'s job, this type just holds the result in that same order.
///
/// `Kind` is a phantom type parameter (either [`Data`] or [`Order`], never
/// anything else — see [`DataPacket`]/[`OrderPacket`]): the struct stores
/// no `Kind` value, nothing to store (`Data`/`Order` carry no data), it
/// only exists so the compiler can tell a [`DataPacket`] apart from an
/// [`OrderPacket`], the same way [`super::AdjId`]/[`super::BoardId`]
/// (`id.rs`) are distinct types so the compiler won't let one be confused
/// with the other, even though both are just a `u16` underneath. Before
/// this, [`DataPacket`] and [`OrderPacket`] were both plain aliases for
/// the same concrete struct — nothing stopped a `DataPacket`, decoded off
/// the UDP socket, from being passed to [`crate::protocol::tcp::encode_order`]
/// by mistake; that mix-up is now a compile error:
///
/// ```compile_fail
/// use software_core::model::{AdjId, DataPacket, OrderPacket};
///
/// fn send_order(_order: OrderPacket) {}
///
/// let data = DataPacket::new(AdjId(1000), vec![]);
/// send_order(data); // doesn't compile: `DataPacket` isn't an `OrderPacket`
/// ```
#[derive(Debug, Clone, PartialEq)]
pub struct DataOrderPacket<Kind> {
    /// The packet's id.
    pub id: AdjId,
    /// Each measurement's decoded value, in the same order as the
    /// matching [`super::PacketType::Data`]/[`super::PacketType::Order`]
    /// list.
    pub values: Vec<Value>,
    _marker: PhantomData<Kind>,
}

impl<Kind> DataOrderPacket<Kind> {
    /// Builds a packet tagged as `Kind`, e.g. `DataPacket::new(id, values)`
    /// or `OrderPacket::new(id, values)`.
    pub fn new(id: AdjId, values: Vec<Value>) -> Self {
        Self {
            id,
            values,
            _marker: PhantomData,
        }
    }
}

/// An order sent from the backend to a board.
///
/// Positional, the same way [`DataPacket::values`] is: see its docs.
pub type OrderPacket = DataOrderPacket<Order>;
/// A set of measurements sent by a board.
///
/// Positional, the same way [`DataOrderPacket::values`] is: see its docs.
pub type DataPacket = DataOrderPacket<Data>;

/// A protection packet: sent by a board when one of its declared
/// [`super::Protection`]s triggers.
///
/// `id` is the compound wire id: [`AdjId::measurement_id`] gives the
/// watched measurement, [`AdjId::protection_position`] which of that
/// measurement's protections triggered (see [`super::Protection::id`]).
/// Kept as a single field rather than storing both halves separately —
/// they're never independent of each other, so there's nothing a second
/// field would add beyond a second place for them to disagree.
#[derive(Debug, Clone, PartialEq)]
pub struct ProtectionPacket {
    /// The compound id this protection triggered under.
    pub id: AdjId,
    /// When it triggered.
    pub timestamp: ShortTimestamp,
    /// The value that triggered it, decoded with the same wire type as the
    /// watched measurement.
    pub value: Value,
}

/// How severe a message is (reusing `general_info.json`'s `message_ids`).
///
/// Unlike [`super::Severity`], which only distinguishes fault from warning
/// for protections, a message has two extra levels: `messages` and
/// `protections` are unrelated wire formats as of ADJv3, so this is a
/// separate type on purpose, not a reuse of [`super::Severity`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MessageLevel {
    /// Stops the vehicle automatically.
    Fault,
    /// Flags something unexpected, without stopping the vehicle.
    Warning,
    /// Informational, no action implied.
    Info,
    /// An unrecoverable firmware error.
    Panic,
}

impl MessageLevel {
    /// All four severities, in no particular order — for code that needs
    /// to go through each one, e.g. building a lookup from a loaded
    /// ADJ's `general_info.json` `message_ids` (see [`MessageLevel::name`]).
    pub const ALL: [MessageLevel; 4] = [
        MessageLevel::Fault,
        MessageLevel::Warning,
        MessageLevel::Info,
        MessageLevel::Panic,
    ];

    /// This severity's key in `general_info.json`'s `message_ids` map
    /// (ADJv3: `"fault"`, `"warning"`, `"info"`, `"panic"`). That map
    /// only gives a severity's *name*, not which `MessageLevel` it is —
    /// this is the one place that association is spelled out, so
    /// nothing else has to hardcode these four strings again.
    pub fn name(self) -> &'static str {
        match self {
            MessageLevel::Fault => "fault",
            MessageLevel::Warning => "warning",
            MessageLevel::Info => "info",
            MessageLevel::Panic => "panic",
        }
    }

    /// The inverse of [`MessageLevel::name`]: the severity named `name`,
    /// or `None` if `name` isn't one of the four (e.g. `general_info.json`
    /// declares other, unrelated reserved names in that same map).
    pub fn from_name(name: &str) -> Option<MessageLevel> {
        MessageLevel::ALL
            .into_iter()
            .find(|level| level.name() == name)
    }
}

/// A free-text message sent by a board.
#[derive(Debug, Clone, PartialEq)]
pub struct MessagePacket {
    /// The wire id this message was sent under — one of the severities
    /// declared in `general_info.json`'s `message_ids`.
    ///
    /// Not a [`MessageLevel`] directly, the same way [`ProtectionPacket::id`]
    /// isn't a [`super::Protection`]: this is what was actually on the
    /// wire, and resolving it to a severity means looking it up (see
    /// [`PacketType::Message`]/[`crate::protocol::Index`]), not storing
    /// a second, redundant copy of it here.
    pub id: AdjId,
    /// When it was sent.
    pub timestamp: ShortTimestamp,
    /// Where it came from, e.g. a source file path.
    pub origin: String,
    /// The message's contents.
    pub message: String,
}

/// Any packet actually sent or received over the wire, once decoded.
#[derive(Debug, Clone, PartialEq)]
pub enum Packet {
    /// A set of measurements sent by a board.
    Data(DataPacket),
    /// An order sent to a board.
    Order(OrderPacket),
    /// A protection that triggered.
    Protection(ProtectionPacket),
    /// A free-text message sent by a board.
    Message(MessagePacket),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_timestamps_with_the_same_time_of_day_are_equal() {
        let a = ShortTimestamp {
            hour: 10,
            minute: 30,
            second: 0,
            subsecond: 0,
        };
        let b = ShortTimestamp {
            hour: 10,
            minute: 30,
            second: 0,
            subsecond: 0,
        };
        assert_eq!(a, b);
    }

    #[test]
    fn two_timestamps_that_only_differ_in_subsecond_are_not_equal() {
        let a = ShortTimestamp {
            hour: 10,
            minute: 30,
            second: 0,
            subsecond: 0,
        };
        let b = ShortTimestamp {
            hour: 10,
            minute: 30,
            second: 0,
            subsecond: 128,
        };
        assert_ne!(a, b);
    }

    #[test]
    fn a_protection_packets_id_splits_into_its_measurement_and_its_own_position() {
        // (1 << 13) | 3000 = 8192 | 3000 = 11192
        let packet = ProtectionPacket {
            id: AdjId((1u16 << 13) | 3000),
            timestamp: ShortTimestamp {
                hour: 12,
                minute: 0,
                second: 5,
                subsecond: 0,
            },
            value: Value::Number(53.2),
        };

        assert_eq!(packet.id.measurement_id(), AdjId(3000));
        assert_eq!(packet.id.protection_position(), 1);
    }

    #[test]
    fn message_level_has_four_distinct_values() {
        let levels = [
            MessageLevel::Fault,
            MessageLevel::Warning,
            MessageLevel::Info,
            MessageLevel::Panic,
        ];

        for (i, a) in levels.iter().enumerate() {
            for (j, b) in levels.iter().enumerate() {
                assert_eq!(a == b, i == j);
            }
        }
    }

    #[test]
    fn each_message_levels_name_matches_the_adj_and_is_distinct() {
        let names: Vec<&str> = MessageLevel::ALL.iter().map(|level| level.name()).collect();
        assert_eq!(names, vec!["fault", "warning", "info", "panic"]);
    }

    #[test]
    fn from_name_is_the_inverse_of_name() {
        for level in MessageLevel::ALL {
            assert_eq!(MessageLevel::from_name(level.name()), Some(level));
        }
        assert_eq!(MessageLevel::from_name("not_a_severity"), None);
    }

    #[test]
    fn data_packet_values_are_positional_not_tagged_with_an_id() {
        // values[0] is whatever measurements[0] is in this packet's
        // PacketDef — there is no id stored alongside each value here.
        let packet = DataPacket::new(AdjId(1000), vec![Value::Number(53.2), Value::Bool(true)]);

        assert_eq!(packet.values[0], Value::Number(53.2));
        assert_eq!(packet.values[1], Value::Bool(true));
    }

    #[test]
    fn packet_wraps_each_kind_without_mixing_them_up() {
        let data = Packet::Data(DataPacket::new(AdjId(1000), vec![]));
        let order = Packet::Order(OrderPacket::new(AdjId(2000), vec![]));

        assert_ne!(data, order);
        match data {
            Packet::Data(_) => {}
            _ => unreachable!("this is a Packet::Data"),
        }
    }

    #[test]
    fn two_data_packets_with_the_same_id_and_values_are_equal() {
        let a = DataPacket::new(AdjId(1000), vec![Value::Number(1.0)]);
        let b = DataPacket::new(AdjId(1000), vec![Value::Number(1.0)]);
        assert_eq!(a, b);
    }

    #[test]
    fn an_order_packet_and_a_data_packet_built_from_the_same_id_and_values_are_different_types() {
        // This is the whole point of tagging `DataOrderPacket` with a
        // phantom `Kind`: `DataPacket` and `OrderPacket` used to be plain
        // aliases for the same concrete struct, so nothing here would even
        // have been a type error before. There's no runtime assertion to
        // make for that — see this module's `compile_fail` doctest on
        // `DataOrderPacket`, which proves the mix-up doesn't compile.
        let data = DataPacket::new(AdjId(1000), vec![]);
        let order = OrderPacket::new(AdjId(1000), vec![]);
        assert_eq!(data.id, order.id);
        assert_eq!(data.values, order.values);
    }
}
