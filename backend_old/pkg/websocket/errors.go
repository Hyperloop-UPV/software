package websocket

import "fmt"

type ErrClientNotFound struct {
	Id ClientId
}

func (err ErrClientNotFound) Error() string {
	return fmt.Sprintf("client %s not found", err.Id)
}
