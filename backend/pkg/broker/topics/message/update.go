package message

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
)

var _ = data.Packet{}

const UpdateName abstraction.BrokerTopic = "message/update"
const SubscribeName abstraction.BrokerTopic = "message/update"

type Update struct {
	subscribersMx *sync.Mutex
	subscribers   map[websocket.ClientId]struct{}
	pool          *websocket.Pool
	api           abstraction.BrokerAPI
}

func NewUpdateTopic() *Update {
	return &Update{
		subscribersMx: &sync.Mutex{},
		subscribers:   make(map[websocket.ClientId]struct{}),
	}
}

func (update *Update) Topic() abstraction.BrokerTopic {
	return UpdateName
}

func (update *Update) Push(p abstraction.BrokerPush) error {
	push, ok := p.(*pushStruct)
	if !ok {
		return topics.ErrUnexpectedPush{Push: p}
	}

	raw, err := json.Marshal(push.Data(push.boardName))
	if err != nil {
		return err
	}

	message := websocket.Message{
		Topic:   UpdateName,
		Payload: raw,
	}

	update.subscribersMx.Lock()
	defer update.subscribersMx.Unlock()

	flagged := make([]websocket.ClientId, 0, len(update.subscribers))
	for client := range update.subscribers {
		err := update.pool.Write(client, message)
		if err != nil {
			flagged = append(flagged, client)
		}
	}

	for _, id := range flagged {
		update.pool.Disconnect(id, ws.CloseUnsupportedData, "client disconnected")
		delete(update.subscribers, id)
		fmt.Printf("message/update unsubscribed %s\n", uuid.UUID(id).String())
	}

	return nil
}

func (update *Update) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func (update *Update) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	update.subscribersMx.Lock()
	defer update.subscribersMx.Unlock()

	switch message.Topic {
	case SubscribeName:
		fmt.Printf("message/update subscribed %s\n", uuid.UUID(id).String())
		update.subscribers[id] = struct{}{}
	default:
		update.pool.Disconnect(id, ws.CloseUnsupportedData, "unsupported topic")
		delete(update.subscribers, id)
		fmt.Printf("message/update unsubscribed %s\n", uuid.UUID(id).String())
	}
}

func (update *Update) SetPool(pool *websocket.Pool) {
	update.pool = pool
}

func (update *Update) SetAPI(api abstraction.BrokerAPI) {
	update.api = api
}

type pushStruct struct {
	data      any
	boardName string
}

func Push(data any, boardName string) *pushStruct {
	return &pushStruct{data: data, boardName: boardName}
}

func (push *pushStruct) Topic() abstraction.BrokerTopic {
	return UpdateName
}

func (push *pushStruct) Data(boardName string) wrapper {
	switch data := push.data.(type) {
	case *protection.Packet:
		return wrapper{
			Kind: string(data.Severity()),
			Payload: struct {
				Kind string `json:"kind"`
				Data any    `json:"data"`
			}{
				Kind: string(data.Data.Name()),
				Data: data.Data,
			},
			Board:     boardName,
			Name:      string(data.Name),
			Timestamp: data.Timestamp,
		}
	case *data.Packet:
		return wrapper{
			Kind:      "info",
			Payload:   "Order Sent",
			Board:     boardName,
			Name:      string(data.Id()),
			Timestamp: protection.NowTimestamp(),
		}
	}
	return wrapper{}

}

type wrapper struct {
	Kind      string                `json:"kind"`
	Payload   any                   `json:"payload"`
	Board     string                `json:"board"`
	Name      string                `json:"name"`
	Timestamp *protection.Timestamp `json:"timestamp"`
}
