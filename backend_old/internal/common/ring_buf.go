package common

type RingBuf[T any] struct {
	buf  []T
	curr int
}

func NewRingBuf[T any](size int) RingBuf[T] {
	return RingBuf[T]{
		buf:  make([]T, size),
		curr: 0,
	}
}

func (buf *RingBuf[T]) Add(value T) (evicted T) {
	evicted = buf.buf[buf.curr]
	buf.buf[buf.curr] = value
	buf.curr = buf.next()
	return evicted
}

func (buf *RingBuf[T]) next() int {
	return (buf.curr + 1) % buf.Len()
}

func (buf *RingBuf[T]) Len() int {
	return len(buf.buf)
}

func (buf *RingBuf[T]) Resize(size uint) []T {
	if size > (uint)(buf.Len()) {
		return buf.Grow(size - (uint)(buf.Len()))
	} else if size < (uint)(buf.Len()) {
		return buf.Shrink((uint)(buf.Len()) - size)
	}

	return nil
}

func (buf *RingBuf[T]) Shrink(amount uint) []T {
	removed := make([]T, 0, amount)

	for i := (uint)(0); i < amount; i++ {
		removed = append(removed, buf.pop())
		if buf.curr >= buf.Len() {
			buf.curr--
		}
	}

	return removed
}

func (buf *RingBuf[T]) pop() (removed T) {
	buf.buf, removed = Remove(buf.buf, buf.curr)
	return removed
}

func (buf *RingBuf[T]) Grow(amount uint) []T {
	added := make([]T, amount)

	head := append(added, buf.buf[buf.curr:]...)
	buf.buf = append(buf.buf[:buf.curr], head...)

	return added
}
