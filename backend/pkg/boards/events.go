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

func (download DownloadEvent) Topic() abstraction.BrokerTopic {
	return "blcu/download"
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

func (upload UploadEvent) Topic() abstraction.BrokerTopic {
	return "blcu/upload"
}

func (upload UploadEvent) Event() abstraction.BoardEvent {
	return upload.BoardEvent
}

type BoardPush struct {
	Data int64
}

func (boardPush BoardPush) Topic() abstraction.BrokerTopic {
	return "blcu/boardPush"
}

type DownloadSuccess struct {
	Data []byte
}

func (downloadSuccess DownloadSuccess) Topic() abstraction.BrokerTopic {
	return "blcu/download/success"
}

type UploadSuccess struct{}

func (uploadSuccess UploadSuccess) Topic() abstraction.BrokerTopic {
	return "blcu/upload/success"
}

type DownloadFailure struct {
	Error error
}

func (downloadFailure DownloadFailure) Topic() abstraction.BrokerTopic {
	return "blcu/download/failure"
}

type UploadFailure struct {
	Error error
}

func (uploadFailure UploadFailure) Topic() abstraction.BrokerTopic {
	return "blcu/upload/failure"
}

type BoardMessage struct {
	ID abstraction.TransportEvent // UploadName
}

func (boardMessage BoardMessage) Event() abstraction.TransportEvent {
	return boardMessage.ID
}
