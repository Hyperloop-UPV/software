package session

import "io"

type Buffer struct {
	data   chan byte
	closed chan struct{}
}

func NewBuffer(size int) *Buffer {
	return &Buffer{
		data:   make(chan byte, size),
		closed: make(chan struct{}),
	}
}

func (buffer *Buffer) Read(b []byte) (n int, err error) {
	n = 0
	ok := true
	for i := range b {
		select {
		case b[i], ok = <-buffer.data:
			if !ok {
				err = io.EOF
				return
			}
			n++
		default:
			return
		}
	}
	return
}

func (buffer *Buffer) Write(b []byte) (n int, err error) {
	select {
	case _, ok := <-buffer.closed:
		if !ok {
			return 0, io.ErrClosedPipe
		}
	default:
	}

	n = 0
	for i := range b {
		buffer.data <- b[i]
		n++
	}

	return n, nil
}

func (buffer *Buffer) Close() error {
	close(buffer.data)
	close(buffer.closed)
	return nil
}
