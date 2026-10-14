package boards

import (
	"fmt"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"time"
)

type ErrNewClientFailed struct {
	Addr      string
	Timestamp time.Time
	Inner     error
}

func (err ErrNewClientFailed) Error() string {
	return fmt.Sprintf("error creating new client at %s", err.Timestamp.Format(time.RFC3339))
}

type ErrInvalidBoardEvent struct {
	Event     abstraction.BoardEvent
	Timestamp time.Time
}

func (err ErrInvalidBoardEvent) Error() string {
	return fmt.Sprintf("error invalid board event %s at %s", err.Event, err.Timestamp.Format(time.RFC3339))
}

type ErrReadingFileFailed struct {
	Filename  string
	Timestamp time.Time
	Inner     error
}

func (err ErrReadingFileFailed) Error() string {
	return fmt.Sprintf("error invalid board id %s at %s", err.Filename, err.Timestamp.Format(time.RFC3339))
}

type ErrSendMessageFailed struct {
	Timestamp time.Time
	Inner     error
}

func (err ErrSendMessageFailed) Error() string {
	return fmt.Sprintf("error sending message at %s", err.Timestamp.Format(time.RFC3339))
}

type ErrNotAllBytesWritten struct {
	Timestamp time.Time
}

func (err ErrNotAllBytesWritten) Error() string {
	return fmt.Sprintf("error not all bytes written at %s", err.Timestamp.Format(time.RFC3339))
}

type ErrDownloadFailure struct {
	Timestamp time.Time
	Inner     error
}

func (err ErrDownloadFailure) Error() string {
	return fmt.Sprintf("error download failure at %s", err.Timestamp.Format(time.RFC3339))
}

type ErrUploadFailure struct {
	Timestamp time.Time
	Inner     error
}

func (err ErrUploadFailure) Error() string {
	return fmt.Sprintf("error upload failure at %s", err.Timestamp.Format(time.RFC3339))
}
