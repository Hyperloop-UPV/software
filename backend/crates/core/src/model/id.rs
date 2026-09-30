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

/// Unique identifier of a board, defined by the ADJ.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct BoardId(pub u16);

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
}
