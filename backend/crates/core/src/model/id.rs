//! Domain identifiers.
//!
//! Defined as their own types (wrapping a `u16`) instead of using a plain
//! `u16`, so the compiler won't let an [`AdjId`] be confused with a
//! [`BoardId`] by mistake, even though both are just numbers underneath.

/// Unique identifier of a packet, order or protection, defined by the ADJ.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AdjId(pub u16);

/// Unique identifier of a board, defined by the ADJ.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct BoardId(pub u16);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_packet_ids_with_the_same_number_are_equal() {
        assert_eq!(AdjId(1000), AdjId(1000));
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
