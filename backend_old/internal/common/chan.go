package common

import (
	"errors"
	"time"
)

func ReadTimeout[T any](channel <-chan T, timeout time.Duration) (T, error) {
	var empty T

	select {
	case data, open := <-channel:
		if !open {
			return empty, errors.New("channel is closed")
		}

		return data, nil
	case <-time.After(timeout):
		return empty, errors.New("timeout")
	}
}

func TrySend[T any](channel chan<- T, value T) bool {
	select {
	case channel <- value:
		return true
	default:
		return false
	}
}
