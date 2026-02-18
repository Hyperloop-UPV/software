package logger

import (
	"encoding/json"
	"sync"
	"sync/atomic"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	data_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

const EnableName abstraction.BrokerTopic = "logger/enable"
const ResponseName abstraction.BrokerTopic = "logger/response"
const VariablesName abstraction.BrokerTopic = "logger/variables"

type Enable struct {
	isRunning    *atomic.Bool
	pool         *websocket.Pool
	connectionMx *sync.Mutex
	subscribers  map[websocket.ClientId]struct{}
	api          abstraction.BrokerAPI
	data_logger  *data_logger.Logger
	baseLogger   zerolog.Logger
}

func NewEnableTopic(baseLogger zerolog.Logger) *Enable {
	enable := &Enable{
		isRunning:    &atomic.Bool{},
		connectionMx: new(sync.Mutex),
		subscribers:  make(map[websocket.ClientId]struct{}),
		baseLogger:   baseLogger,
	}
	enable.isRunning.Store(false)
	return enable
}

func (enable *Enable) Topic() abstraction.BrokerTopic {
	return EnableName
}

func (enable *Enable) Push(push abstraction.BrokerPush) error {
	return nil
}

func (enable *Enable) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func (enable *Enable) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	switch message.Topic {
	case EnableName:
		err := enable.handleToggle(id, message)
		if err != nil {
			enable.baseLogger.Error().Err(err).Msg("error handling logger/enable")
		}
	case ResponseName:
		enable.connectionMx.Lock()
		defer enable.connectionMx.Unlock()

		enable.baseLogger.Debug().Msgf("logger/response subscribed %s", uuid.UUID(id).String())
		enable.subscribers[id] = struct{}{}

		// Get current logger state
		payload, err := json.Marshal(enable.isRunning.Load())
		if err != nil {
			enable.baseLogger.Error().Err(err).Msg("error marshaling logger state")
		}

		// Prepare message
		message := websocket.Message{
			Topic:   ResponseName,
			Payload: payload,
		}

		// Send current logger state to client that just subscribed
		err = enable.pool.Write(id, message)
		if err != nil {
			enable.baseLogger.Error().Err(err).Msg("error sending logger state to client")
		}

	case VariablesName:
		err := enable.handleVariables(id, message)
		if err != nil {
			enable.baseLogger.Error().Err(err).Msg("error handling logger/variables")
		}
	default:
		enable.connectionMx.Lock()
		defer enable.connectionMx.Unlock()

		enable.pool.Disconnect(id, ws.CloseUnsupportedData, "unsupported topic")
		delete(enable.subscribers, id)
		enable.baseLogger.Debug().Msgf("logger/response unsubscribed %s", uuid.UUID(id).String())
	}
}

func (enable *Enable) handleToggle(_ websocket.ClientId, message *websocket.Message) error {
	var request bool
	err := json.Unmarshal(message.Payload, &request)
	if err != nil {
		return err
	}

	// If we are already in the state the user wants,
	// just confirm it immediately and don't bother the rest of the system.
	if enable.isRunning.Load() == request {
		return enable.broadcastState()
	}

	status := newStatus(request)
	go enable.api.UserPush(status)

	go func() {
		response := <-status.response

		enable.isRunning.Store(response)

		if request && response {
			// Successfully started logging: do nothing because NotifyStarted already broadcasts the state
			return
		}

		enable.broadcastState()
	}()
	return nil
}

func (enable *Enable) handleVariables(_ websocket.ClientId, message *websocket.Message) error {
	var allowedVars []string
	err := json.Unmarshal(message.Payload, &allowedVars)
	if err != nil {
		return err
	}
	enable.data_logger.SetAllowedVars(allowedVars)
	return nil
}

func (enable *Enable) NotifyStarted() error {
	enable.isRunning.Store(true)
	return enable.broadcastState()
}

func (enable *Enable) NotifyStopped() error {
	enable.isRunning.Store(false)
	return enable.broadcastState()
}

func (enable *Enable) broadcastState() error {
	payload, err := json.Marshal(enable.isRunning.Load())
	if err != nil {
		return err
	}

	message := websocket.Message{
		Topic:   ResponseName,
		Payload: payload,
	}

	enable.connectionMx.Lock()
	defer enable.connectionMx.Unlock()
	flaged := make([]websocket.ClientId, 0, len(enable.subscribers))
	for id := range enable.subscribers {
		err := enable.pool.Write(id, message)
		if err != nil {
			flaged = append(flaged, id)
		}
	}

	for _, id := range flaged {
		enable.pool.Disconnect(id, ws.CloseInternalServerErr, "client disconnected")
		delete(enable.subscribers, id)

		enable.baseLogger.Debug().Msgf("logger/response unsubscribed %s", uuid.UUID(id).String())
	}

	return nil
}

func (enable *Enable) SetPool(pool *websocket.Pool) {
	enable.pool = pool
}

func (enable *Enable) SetAPI(api abstraction.BrokerAPI) {
	enable.api = api
}

func (enable *Enable) SetDataLogger(logger *data_logger.Logger) {
	enable.data_logger = logger
}

type Status struct {
	request  bool
	response chan bool
}

func newStatus(request bool) *Status {
	return &Status{
		request:  request,
		response: make(chan bool),
	}
}

func (status *Status) Topic() abstraction.BrokerTopic {
	return EnableName
}

func (status *Status) Fulfill(response bool) {
	status.response <- response
}

func (status *Status) Enable() bool {
	return status.request
}
