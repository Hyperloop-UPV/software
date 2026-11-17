package common

import "fmt"

func AddrWithPort(addr string, port string) string {
	return fmt.Sprintf("%s:%s", addr, port)
}
