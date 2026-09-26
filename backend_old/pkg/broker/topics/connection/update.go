package connection

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
)

const UpdateName abstraction.BrokerTopic = "connection/update"
const SubscribeName abstraction.BrokerTopic = "connection/update"

type Update struct {
	subscriberMx *sync.Mutex
	subscribers  map[websocket.ClientId]struct{}
	connectionMx *sync.Mutex
	connections  map[string]Connection
	pool         *websocket.Pool
	api          abstraction.BrokerAPI
}

func NewUpdateTopic() *Update {
	topic := &Update{
		subscriberMx: &sync.Mutex{},
		subscribers:  make(map[websocket.ClientId]struct{}),
		connectionMx: &sync.Mutex{},
		connections:  make(map[string]Connection),
	}

	return topic
}

func (update *Update) Topic() abstraction.BrokerTopic {
	return UpdateName
}

func (update *Update) Push(push abstraction.BrokerPush) error {
	connection, ok := push.(*Connection)
	if !ok {
		return topics.ErrUnexpectedPush{Push: push}
	}

	update.connectionMx.Lock()
	defer update.connectionMx.Unlock()
	update.connections[connection.Name] = *connection

	rawPayload, err := json.Marshal(map[string]Connection{
		connection.Name: *connection,
	})
	if err != nil {
		return err
	}

	message := websocket.Message{
		Topic:   UpdateName,
		Payload: rawPayload,
	}

	update.subscriberMx.Lock()
	defer update.subscriberMx.Unlock()
	flagged := make([]websocket.ClientId, 0, len(update.subscribers))
	for id := range update.subscribers {
		err := update.pool.Write(id, message)
		if err != nil {
			flagged = append(flagged, id)
		}
	}

	for _, id := range flagged {
		update.pool.Disconnect(id, ws.CloseNormalClosure, "client disconnected")
		delete(update.subscribers, id)
		fmt.Printf("connection/update unsubscribed %s\n", uuid.UUID(id).String())
	}

	return nil
}

func (update *Update) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, topics.ErrOpNotSupported{}
}

func (update *Update) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	update.subscriberMx.Lock()
	defer update.subscriberMx.Unlock()

	switch message.Topic {
	case SubscribeName:
		update.subscribers[id] = struct{}{}
		fmt.Printf("connection/update subscribed %s\n", uuid.UUID(id).String())

		update.connectionMx.Lock()
		defer update.connectionMx.Unlock()
		rawPayload, err := json.Marshal(update.connections)
		if err != nil {
			fmt.Println(err)
		}

		message := websocket.Message{
			Topic:   UpdateName,
			Payload: rawPayload,
		}

		err = update.pool.Write(id, message)
		if err != nil {
			fmt.Println(err)
		}

	default:
		update.pool.Disconnect(id, ws.CloseUnsupportedData, "unsupported topic")
		delete(update.subscribers, id)
		fmt.Printf("connection/update unsubscribed %s\n", uuid.UUID(id).String())
	}
}

func (update *Update) SetPool(pool *websocket.Pool) {
	update.pool = pool
}

func (update *Update) SetAPI(api abstraction.BrokerAPI) {
	update.api = api
}
