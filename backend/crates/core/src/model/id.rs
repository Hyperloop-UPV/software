//! Domain identifiers.
//!
//! Defined as their own types (wrapping a `u16`) instead of using a plain
//! `u16`, so the compiler won't let an [`AdjId`] be confused with a
//! [`BoardId`] by mistake, even though both are just numbers underneath.

/// Unique identifier of a packet, order or protection, defined by the ADJ.
/// Ranges
/// - `[0, 511]` | `[0x0000, 0x01FF]` for special range
/// - `[512, 8191]` | `[0x0200, 0x1FFF]` for packets, orders and measurements
/// - `[8192, 65535]` | `[0x2000, 0xFFFF]` for protections: each protection is associated with a measurement, so the low 13 bits of the compound id are the measurement id, and the high 3 bits are the protection's position for that measurement (1-7; 0 is reserved for a normal, non-protection id)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AdjId(pub u16);

impl AdjId {
    /// The high 3 bits: `0` for a normal `packet`/`order`/`measurement`
    /// id, `1`-`7` for which of the watched measurement's protections this
    /// is.
    pub fn protection_position(self) -> u8 {
        (self.0 >> 13) as u8
    }

    /// The watched measurement's id: this id with its high 3 bits (the
    /// protection's position) zeroed out.
    ///
    /// For a normal, non-protection id (`protection_position() == 0`),
    /// this is just the id itself.
    pub fn measurement_id(self) -> AdjId {
        AdjId(self.0 & 0x1FFF)
    }
}

/// Unique identifier of a board, defined by the ADJ.
///
/// `BoardId(0)` is reserved: no real board uses it. [`crate::protocol::Index`]
/// uses it as the `board` for a synthesized [`super::PacketDef`] that
/// isn't owned by any one board at all — a message severity, a
/// session-wide id any board's free-text log frame can reuse. Not
/// validated anywhere; just a convention, the same way `0` is excluded
/// from [`AdjId`]'s own special range above.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct BoardId(pub u16);

/// A TCP/UDP port number, as declared in `general_info.json`'s `ports`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Port(pub u16);

/// A board's physical MAC address, as 6 raw bytes.
///
/// Kept as a fixed-size byte array instead of a `String` on purpose: a
/// malformed or miswritten address (the ADJv3 meeting notes mention a real
/// `67:67:67:67:67:67` that caused hours of debugging) should not be able
/// to reach this type at all. Parsing the usual `"aa:bb:cc:dd:ee:ff"` text
/// form is `adj`'s job, not this type's.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct MacAddress(pub [u8; 6]);

impl std::fmt::Debug for MacAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "MacAddress({self})")
    }
}

impl std::fmt::Display for MacAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let [a, b, c, d, e, g] = self.0;
        write!(f, "{a:02x}:{b:02x}:{c:02x}:{d:02x}:{e:02x}:{g:02x}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_packet_ids_with_the_same_number_are_equal() {
        assert_eq!(AdjId(1000), AdjId(1000));
    }

    #[test]
    fn a_port_and_a_board_id_cannot_be_compared_to_each_other() {
        // This wouldn't compile if you tried it: Port(1) == BoardId(1)
        let port = Port(50500);
        let board = BoardId(50500);
        assert_eq!(port.0, board.0); // only the inner numbers can be compared
    }

    #[test]
    fn a_mac_address_displays_as_colon_separated_lowercase_hex() {
        let mac = MacAddress([0xaa, 0xbb, 0xcc, 0x0d, 0x0e, 0xff]);
        assert_eq!(mac.to_string(), "aa:bb:cc:0d:0e:ff");
    }

    #[test]
    fn packet_id_and_board_id_cannot_be_compared_to_each_other() {
        // This wouldn't compile if you tried it: AdjId(1) == BoardId(1)
        // That's the whole point of this file: the compiler protects us.
        let packet = AdjId(1);
        let board = BoardId(1);
        assert_eq!(packet.0, board.0); // only the inner numbers can be compared
    }

    #[test]
    fn a_normal_ids_position_is_zero_and_it_is_its_own_measurement_id() {
        let id = AdjId(3000);
        assert_eq!(id.protection_position(), 0);
        assert_eq!(id.measurement_id(), AdjId(3000));
    }

    #[test]
    fn a_protections_compound_id_splits_into_position_and_measurement() {
        // (3 << 13) | 100 = 24576 | 100 = 24676
        let compound = AdjId((3u16 << 13) | 100);
        assert_eq!(compound.protection_position(), 3);
        assert_eq!(compound.measurement_id(), AdjId(100));
    }
}
