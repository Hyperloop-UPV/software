//! Transactional frame extraction from one TCP session's accumulated bytes.

use crate::protocol::{
    DecodeError, Index,
    tcp::{self, TcpFrame},
};
use bytes::{Buf, BytesMut};
use std::io::Cursor;

/// Extracts one complete frame, advancing `pending` only after a successful decode.
///
/// Append incoming bytes with `BytesMut::extend_from_slice`, then call this
/// repeatedly until it returns `Ok(None)`. That result means the buffer is empty
/// or decoding has been deferred until more bytes arrive; it does not prove the
/// suffix is valid. Each connection session must own its own buffer; never carry
/// pending bytes into a reconnected session.
///
/// All decode errors are deferred while the pending suffix is at most 374 bytes,
/// assuming well-formed firmware output. The limit is checked after decoding:
/// a larger buffer may contain many valid frames that must be extracted first.
///
/// # Errors
///
/// Returns the decoder's error if no frame can be extracted and more than 374
/// bytes remain. The buffer stays unchanged; the socket owner must discard the
/// session and reconnect rather than try to resynchronise within the stream.
pub(super) fn next_frame(
    pending: &mut BytesMut,
    index: &Index,
) -> Result<Option<TcpFrame>, DecodeError> {
    // Largest supported inbound frame: message ID + timestamp + origin + text.
    const MAX_FRAME_LEN: usize = 374;

    if pending.is_empty() {
        return Ok(None);
    }

    let mut cursor = Cursor::new(&pending[..]);
    match tcp::decode_next(&mut cursor, index) {
        Ok(frame) => {
            let consumed = cursor.position() as usize;
            pending.advance(consumed);
            Ok(Some(frame))
        }
        // Defer even definite decode errors until the undecodable suffix exceeds the limit.
        Err(error) if pending.len() > MAX_FRAME_LEN => Err(error),
        Err(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::inbound_frames as sample_frames;
    use super::*;
    use crate::{
        model::{AdjId, MessagePacket, ShortTimestamp},
        protocol::packet::message,
    };

    #[test]
    fn an_empty_buffer_needs_more_bytes() {
        let mut pending = BytesMut::new();
        assert_eq!(next_frame(&mut pending, &Index::default()), Ok(None));
        assert!(pending.is_empty());
    }

    #[test]
    fn extracts_mixed_frames_with_adj_dependent_lengths() {
        let (index, frames) = sample_frames();
        assert_eq!(frames[0].1.len(), 9);
        assert_eq!(frames[2].1.len(), 16);
        let mut pending = BytesMut::new();
        for (_, bytes) in &frames {
            pending.extend_from_slice(bytes);
        }

        for (frame, bytes) in &frames {
            let before = pending.len();
            assert_eq!(next_frame(&mut pending, &index), Ok(Some(frame.clone())));
            assert_eq!(pending.len(), before - bytes.len());
        }
        assert_eq!(next_frame(&mut pending, &index), Ok(None));
        assert!(pending.is_empty());
    }

    #[test]
    fn preserves_every_partial_frame_until_its_remaining_bytes_arrive() {
        let (index, frames) = sample_frames();
        for (frame, bytes) in &frames {
            for split in 0..bytes.len() {
                let mut pending = BytesMut::from(&bytes[..split]);
                assert_eq!(next_frame(&mut pending, &index), Ok(None));
                assert_eq!(&pending[..], &bytes[..split]);

                pending.extend_from_slice(&bytes[split..]);
                assert_eq!(next_frame(&mut pending, &index), Ok(Some(frame.clone())));
                assert!(pending.is_empty());
            }
        }
    }

    #[test]
    fn extracts_a_mixed_stream_received_one_byte_at_a_time() -> Result<(), DecodeError> {
        let (index, frames) = sample_frames();
        let mut pending = BytesMut::new();
        let mut received = Vec::new();
        for (_, bytes) in &frames {
            for byte in bytes {
                pending.extend_from_slice(&[*byte]);
                while let Some(frame) = next_frame(&mut pending, &index)? {
                    received.push(frame);
                }
            }
        }

        let expected: Vec<_> = frames.into_iter().map(|(frame, _)| frame).collect();
        assert_eq!(received, expected);
        assert!(pending.is_empty());
        Ok(())
    }

    #[test]
    fn extracts_a_complete_frame_and_keeps_the_next_partial_frame() {
        let (index, frames) = sample_frames();
        let (first, first_bytes) = &frames[0];
        let (second, second_bytes) = &frames[1];
        let split = second_bytes.len() - 1;
        let mut pending = BytesMut::from(&first_bytes[..]);
        pending.extend_from_slice(&second_bytes[..split]);

        assert_eq!(next_frame(&mut pending, &index), Ok(Some(first.clone())));
        assert_eq!(next_frame(&mut pending, &index), Ok(None));
        assert_eq!(&pending[..], &second_bytes[..split]);

        pending.extend_from_slice(&second_bytes[split..]);
        assert_eq!(next_frame(&mut pending, &index), Ok(Some(second.clone())));
        assert!(pending.is_empty());
    }

    #[test]
    fn defers_non_eof_errors_until_the_pending_suffix_exceeds_the_limit() {
        let (index, _) = sample_frames();
        let mut invalid_utf8 = AdjId(10).0.to_le_bytes().to_vec();
        invalid_utf8.extend([0, 0, 0, 0, 0xff, 0, 0]);
        let mut unterminated = AdjId(10).0.to_le_bytes().to_vec();
        unterminated.extend([0; 4]);
        unterminated.extend([b'x'; 48]);

        for (bytes, expected_error) in [
            (vec![0xff, 0xff], DecodeError::UnknownId(AdjId(u16::MAX))),
            (invalid_utf8, DecodeError::InvalidUtf8(vec![0xff])),
            (unterminated, DecodeError::UnterminatedString { max: 48 }),
        ] {
            let mut pending = BytesMut::from(&bytes[..]);
            assert_eq!(next_frame(&mut pending, &index), Ok(None));
            assert_eq!(&pending[..], &bytes);

            pending.resize(374, 0);
            let before = pending.clone();
            assert_eq!(next_frame(&mut pending, &index), Ok(None));
            assert_eq!(pending, before);

            pending.extend_from_slice(&[0]);
            let before = pending.clone();
            assert_eq!(next_frame(&mut pending, &index), Err(expected_error));
            assert_eq!(pending, before);
        }
    }

    #[test]
    fn accepts_a_maximum_length_message_once_its_last_byte_arrives() {
        let (index, _) = sample_frames();
        let packet = MessagePacket {
            id: AdjId(10),
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            origin: "o".repeat(47),
            message: "m".repeat(319),
        };
        let Ok(bytes) = message::encode(&packet, &index) else {
            unreachable!("both strings fit their wire limits including NUL");
        };
        assert_eq!(bytes.len(), 374);
        let mut pending = BytesMut::from(&bytes[..373]);
        assert_eq!(next_frame(&mut pending, &index), Ok(None));
        assert_eq!(&pending[..], &bytes[..373]);

        pending.extend_from_slice(&bytes[373..]);
        assert_eq!(
            next_frame(&mut pending, &index),
            Ok(Some(TcpFrame::Message(packet)))
        );
        assert!(pending.is_empty());
    }

    #[test]
    fn drains_a_valid_burst_larger_than_the_frame_limit() {
        let (index, frames) = sample_frames();
        let mut pending = BytesMut::new();
        for _ in 0..32 {
            for (_, bytes) in &frames {
                pending.extend_from_slice(bytes);
            }
        }
        assert!(pending.len() > 374);

        for _ in 0..32 {
            for (frame, _) in &frames {
                assert_eq!(next_frame(&mut pending, &index), Ok(Some(frame.clone())));
            }
        }
        assert_eq!(next_frame(&mut pending, &index), Ok(None));
        assert!(pending.is_empty());
    }

    #[test]
    fn delivers_valid_frames_before_rejecting_an_oversized_invalid_suffix() {
        let (index, frames) = sample_frames();
        let (frame, bytes) = &frames[0];
        let mut pending = BytesMut::from(&bytes[..]);
        let invalid = vec![0xff; 375];
        pending.extend_from_slice(&invalid);

        assert_eq!(next_frame(&mut pending, &index), Ok(Some(frame.clone())));
        assert_eq!(
            next_frame(&mut pending, &index),
            Err(DecodeError::UnknownId(AdjId(u16::MAX)))
        );
        assert_eq!(&pending[..], &invalid);
    }

    #[test]
    fn independent_buffers_do_not_share_partial_frames() {
        let (index, frames) = sample_frames();
        let (frame, bytes) = &frames[0];
        let mut first = BytesMut::from(&bytes[..3]);
        let mut second = BytesMut::from(&bytes[..]);

        assert_eq!(next_frame(&mut first, &index), Ok(None));
        assert_eq!(next_frame(&mut second, &index), Ok(Some(frame.clone())));
        assert!(second.is_empty());
        assert_eq!(&first[..], &bytes[..3]);

        first.extend_from_slice(&bytes[3..]);
        assert_eq!(next_frame(&mut first, &index), Ok(Some(frame.clone())));
        assert!(first.is_empty());
    }
}
