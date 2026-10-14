package boards

import (
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

type AckNotification struct {
	ID abstraction.BoardEvent // AckId
}

func (ack AckNotification) Event() abstraction.BoardEvent {
	return ack.ID
}

type DownloadEvent struct {
	BoardEvent abstraction.BoardEvent // DownloadId
	BoardID    abstraction.BoardId
	Board      string
}

func (download DownloadEvent) Event() abstraction.BoardEvent {
	return download.BoardEvent
}

type UploadEvent struct {
	BoardEvent abstraction.BoardEvent
	Board      string
	Data       []byte
	Length     int
}

func (upload UploadEvent) Event() abstraction.BoardEvent {
	return upload.BoardEvent
}

type BoardPush struct {
	Data int64
}

type DownloadSuccess struct {
	Data []byte
}

type UploadSuccess struct{}

type DownloadFailure struct {
	Error error
}

type UploadFailure struct {
	Error error
}

type BoardMessage struct {
	ID abstraction.TransportEvent // UploadName
}

func (boardMessage BoardMessage) Event() abstraction.TransportEvent {
	return boardMessage.ID
}
