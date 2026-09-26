package data

import (
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory/models"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
)

const UpdateName abstraction.BrokerTopic = "podData/update"
const SubscribeName abstraction.BrokerTopic = "podData/update"

type Update struct {
	connectionMx *sync.Mutex
	subscribers  map[websocket.ClientId]struct{}
	updatesMx    *sync.Mutex
	newData      *atomic.Bool
	updates      map[uint16]*models.Update
	pool         *websocket.Pool
	api          abstraction.BrokerAPI
	done         chan struct{}
	delay        time.Duration
}

func NewUpdateTopic(delay time.Duration) *Update {
	topic := &Update{
		connectionMx: &sync.Mutex{},
		subscribers:  make(map[websocket.ClientId]struct{}),
		updatesMx:    &sync.Mutex{},
		newData:      &atomic.Bool{},
		updates:      make(map[uint16]*models.Update),
		done:         make(chan struct{}),
		delay:        delay,
	}

	topic.newData.Store(false)

	go topic.run()

	return topic
}

func (update *Update) Topic() abstraction.BrokerTopic {
	return UpdateName
}

func (update *Update) Push(push abstraction.BrokerPush) error {
	data, ok := push.(*Push)
	if !ok {
		return topics.ErrUnexpectedPush{Push: push}
	}

	payload := data.Update()

	update.updatesMx.Lock()
	defer update.updatesMx.Unlock()

	update.updates[payload.Id] = payload

	update.newData.Store(true)
	return nil
}

func (update *Update) run() error {
loop:
	for {
		select {
		case <-update.done:
			break loop
		case <-time.After(update.delay):
			err := update.send()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (update *Update) send() error {
	if !update.newData.CompareAndSwap(true, false) {
		return nil
	}

	update.updatesMx.Lock()
	defer update.updatesMx.Unlock()
	update.connectionMx.Lock()
	defer update.connectionMx.Unlock()

	rawPayload, err := json.Marshal(update.updates)
	if err != nil {
		return err
	}

	message := websocket.Message{
		Topic:   UpdateName,
		Payload: rawPayload,
	}

	flaged := make([]websocket.ClientId, 0, len(update.subscribers))
	for id := range update.subscribers {
		err := update.pool.Write(id, message)
		if err != nil {
			flaged = append(flaged, id)
		}
	}

	for _, id := range flaged {
		update.pool.Disconnect(id, ws.CloseInternalServerErr, "client disconnected")
		delete(update.subscribers, id)
		fmt.Printf("podData/update unsubscribed %s\n", uuid.UUID(id).String())
	}

	update.updates = make(map[uint16]*models.Update, len(update.updates))

	return nil
}

func (update *Update) Stop() {
	update.done <- struct{}{}
	close(update.done)
}

func (update *Update) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, topics.ErrOpNotSupported{}
}

func (update *Update) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	update.connectionMx.Lock()
	defer update.connectionMx.Unlock()

	switch message.Topic {
	case SubscribeName:
		fmt.Printf("podData/update subscribed %s\n", uuid.UUID(id).String())
		update.subscribers[id] = struct{}{}
	default:
		update.pool.Disconnect(id, ws.CloseUnsupportedData, "unsupported topic")
		delete(update.subscribers, id)
		fmt.Printf("podData/update unsubscribed %s\n", uuid.UUID(id).String())
	}
}

func (update *Update) SetPool(pool *websocket.Pool) {
	update.pool = pool
}

func (update *Update) SetAPI(api abstraction.BrokerAPI) {
	update.api = api
}
