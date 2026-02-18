package blcu

import (
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
)

func RegisterTopics(b *broker.Broker, pool *websocket.Pool) {
	upload := &Upload{}
	upload.SetAPI(b)
	upload.SetPool(pool)	
	download := &Download{}
	download.SetAPI(b)
	download.SetPool(pool)
	b.AddTopic(UploadName, upload)
	b.AddTopic(DownloadName, download)
	b.AddTopic(boards.UploadSuccess{}.Topic(), upload)
	b.AddTopic(boards.UploadFailure{}.Topic(), upload)
	b.AddTopic(boards.DownloadSuccess{}.Topic(), download)
	b.AddTopic(boards.DownloadFailure{}.Topic(), download)
}
