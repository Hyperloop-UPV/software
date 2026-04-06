package tcp

import (
	"errors"
	"net"
)

type connWithErr struct {
	net.Conn
	errors chan<- error
}

func WithErrChan(conn net.Conn) (net.Conn, <-chan error) {
	errChan := make(chan error, 1)
	return &connWithErr{
		Conn:   conn,
		errors: errChan,
	}, errChan
}

func (conn *connWithErr) Read(b []byte) (n int, err error) {
	n, err = conn.Conn.Read(b)
	if err != nil && !errors.Is(err, net.ErrClosed) {
		select {
		case conn.errors <- err:
		default:
		}
	}
	return
}

func (conn *connWithErr) Write(b []byte) (n int, err error) {
	n, err = conn.Conn.Write(b)
	if err != nil && !errors.Is(err, net.ErrClosed) {
		select {
		case conn.errors <- err:
		default:
		}
	}
	return
}

func (conn *connWithErr) Close() error {
	return conn.Conn.Close()
}
