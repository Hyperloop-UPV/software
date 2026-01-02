package order

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

const StateName abstraction.BrokerTopic = "order/stateOrders"

type State struct {
	enabledOrders map[string]map[abstraction.PacketId]struct{}
	idToBoard     map[abstraction.PacketId]string
	connectionMx  *sync.Mutex
	subscribers   map[websocket.ClientId]struct{}
	pool          *websocket.Pool
	api           abstraction.BrokerAPI
	logger        zerolog.Logger
}

func NewState(idToBoard map[abstraction.PacketId]string, baseLogger zerolog.Logger) *State {
	enabled := make(map[string]map[abstraction.PacketId]struct{})
	for _, board := range idToBoard {
		enabled[board] = make(map[abstraction.PacketId]struct{})
	}

	return &State{
		enabledOrders: enabled,
		idToBoard:     idToBoard,
		connectionMx:  new(sync.Mutex),
		subscribers:   make(map[websocket.ClientId]struct{}),
		logger:        baseLogger,
	}
}

func (state *State) Topic() abstraction.BrokerTopic {
	return StateName
}

func (state *State) Push(push abstraction.BrokerPush) error {
	switch action := push.(type) {
	case *StateAdd:
		state.logger.Info().Msg("add")
		return state.addOrders(action.update)
	case *StateRemove:
		state.logger.Info().Msg("remove")
		return state.removeOrders(action.update)
	case *StateClear:
		state.logger.Info().Msg("clear board")
		return state.clearBoard(action.board)
	default:
		err := topics.ErrUnexpectedPush{Push: push}
		state.logger.Warn().Stack().Err(err).Msg("unexpected topic")
		return err
	}
}

func (state *State) addOrders(add *order.Add) error {
	for _, addedOrder := range add.Orders() {
		board, ok := state.idToBoard[addedOrder]
		if !ok {
			state.logger.Warn().Uint16("id", uint16(addedOrder)).Msg("unrecognized topic")
			continue
		}

		state.enabledOrders[board][addedOrder] = struct{}{}
	}

	return state.updateOrders()
}

func (state *State) removeOrders(remove *order.Remove) error {
	for _, removedOrder := range remove.Orders() {
		board, ok := state.idToBoard[removedOrder]
		if !ok {
			state.logger.Warn().Uint16("id", uint16(removedOrder)).Msg("unrecognized topic")
			continue
		}

		delete(state.enabledOrders[board], removedOrder)
	}

	return state.updateOrders()
}

func (state *State) clearBoard(board string) error {
	if _, ok := state.enabledOrders[board]; !ok {
		state.logger.Warn().Str("board", board).Msg("unknown board")
		return nil
	}

	state.enabledOrders[board] = make(map[abstraction.PacketId]struct{}, len(state.enabledOrders[board]))

	return state.updateOrders()
}

func (state *State) updateOrders() error {
	orderList := make(map[string][]abstraction.PacketId, len(state.enabledOrders))
	for board, enabledOrders := range state.enabledOrders {
		orderList[board] = make([]abstraction.PacketId, 0, len(enabledOrders))
		for order := range enabledOrders {
			orderList[board] = append(orderList[board], order)
		}
	}

	payload, err := json.Marshal(orderList)
	if err != nil {
		return err
	}

	message := websocket.Message{
		Topic:   StateName,
		Payload: payload,
	}

	state.connectionMx.Lock()
	defer state.connectionMx.Unlock()
	flaged := make([]websocket.ClientId, 0, len(state.subscribers))
	for id := range state.subscribers {
		err := state.pool.Write(id, message)
		if err != nil {
			flaged = append(flaged, id)
		}
	}

	for _, id := range flaged {
		state.pool.Disconnect(id, ws.CloseInternalServerErr, "client disconnected")
		delete(state.subscribers, id)
		fmt.Printf("order/stateOrders unsubscribed %s\n", uuid.UUID(id).String())
	}

	return nil
}

func (state *State) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func (state *State) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	state.connectionMx.Lock()
	defer state.connectionMx.Unlock()

	switch message.Topic {
	case StateName:
		fmt.Printf("order/stateOrders subscribed %s\n", uuid.UUID(id).String())
		state.subscribers[id] = struct{}{}
	default:
		state.pool.Disconnect(id, ws.CloseUnsupportedData, "unsupported topic")
		delete(state.subscribers, id)
		fmt.Printf("order/stateOrders unsubscribed %s\n", uuid.UUID(id).String())
	}
}

func (state *State) SetPool(pool *websocket.Pool) {
	state.pool = pool
}

func (state *State) SetAPI(api abstraction.BrokerAPI) {
	state.api = api
}

type StateAdd struct {
	update *order.Add
}

func NewAdd(diff *order.Add) *StateAdd {
	return &StateAdd{
		update: diff,
	}
}

func (add *StateAdd) Topic() abstraction.BrokerTopic {
	return StateName
}

type StateRemove struct {
	update *order.Remove
}

func NewRemove(diff *order.Remove) *StateRemove {
	return &StateRemove{
		update: diff,
	}
}

func (remove *StateRemove) Topic() abstraction.BrokerTopic {
	return StateName
}

type StateClear struct {
	board string
}

func NewStateClear(boardName string) *StateClear {
	return &StateClear{
		board: boardName,
	}
}

func (clear *StateClear) Topic() abstraction.BrokerTopic {
	return StateName
}
