package websocket

import (
	"sync"

	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

type ClientId uuid.UUID

type messageCallback = func(ClientId, *Message)

type Pool struct {
	clientMx    *sync.Mutex
	clients     map[ClientId]*Client
	connections <-chan *Client
	onMessage   messageCallback

	logger zerolog.Logger
}

func NewPool(connections <-chan *Client, baseLogger zerolog.Logger) *Pool {
	logger := baseLogger.Sample(zerolog.LevelSampler{
		TraceSampler: zerolog.RandomSampler(50000),
		DebugSampler: zerolog.RandomSampler(1),
		InfoSampler:  zerolog.RandomSampler(1),
		WarnSampler:  zerolog.RandomSampler(1),
		ErrorSampler: zerolog.RandomSampler(1),
	})

	handler := &Pool{
		clientMx:    &sync.Mutex{},
		clients:     make(map[ClientId]*Client),
		connections: connections,
		onMessage:   func(ClientId, *Message) {},

		logger: logger,
	}

	go handler.listen()

	return handler
}

func (pool *Pool) SetOnMessage(onMessage messageCallback) {
	pool.logger.Trace().Msg("set on message")
	pool.onMessage = onMessage
}

func (pool *Pool) listen() {
	pool.logger.Debug().Msg("listen")
	for client := range pool.connections {
		id := ClientId(uuid.New())
		pool.addCLient(id, client)
	}
}

func (pool *Pool) addCLient(id ClientId, client *Client) {
	pool.clientMx.Lock()
	defer pool.clientMx.Unlock()
	pool.logger.Info().Str("id", uuid.UUID(id).String()).Msg("new client")
	pool.clients[id] = client
	go pool.handle(id, client)
	client.SetOnClose(pool.onClose(id))
}

func (pool *Pool) handle(id ClientId, client *Client) {
	clientLogger := pool.logger.With().Str("id", uuid.UUID(id).String()).Logger()
	defer func() {
		clientLogger.Info().Msg("closing connection")
		err := client.Close(ws.CloseNormalClosure, "server shutdown")
		if err != nil {
			clientLogger.Error().Stack().Err(err).Msg("closing")
		}
	}()

	for {
		message, err := client.Read()
		if err != nil {
			clientLogger.Error().Stack().Err(err).Msg("read")
			return
		}

		clientLogger.Trace().Msg("read")
		pool.onMessage(id, &message)
	}
}

func (pool *Pool) Write(id ClientId, message Message) error {
	clientLogger := pool.logger.With().Str("id", uuid.UUID(id).String()).Logger()

	pool.clientMx.Lock()
	defer pool.clientMx.Unlock()

	client, ok := pool.clients[id]
	if !ok {
		clientLogger.Warn().Msg("client not found")
		return ErrClientNotFound{Id: id}
	}

	clientLogger.Debug().Str("topic", string(message.Topic)).Msg("write")
	return client.Write(message)
}

func (pool *Pool) Broadcast(message Message) {
	pool.logger.Trace().Str("topic", string(message.Topic)).Msg("broadcast")
	for id := range pool.clients {
		pool.Write(id, message)
	}
}

func (pool *Pool) Disconnect(id ClientId, code int, reason string) error {
	clientLogger := pool.logger.With().Str("id", uuid.UUID(id).String()).Logger()

	pool.clientMx.Lock()
	defer pool.clientMx.Unlock()

	if client, ok := pool.clients[id]; ok {
		clientLogger.Info().Int("code", code).Str("reason", reason).Msg("close")
		return client.Close(code, reason)
	} else {
		clientLogger.Warn().Msg("client not found")
	}
	return nil
}

func (pool *Pool) onClose(id ClientId) func() {
	return func() {
		pool.clientMx.Lock()
		defer pool.clientMx.Unlock()

		pool.logger.Debug().Str("id", uuid.UUID(id).String()).Msg("close")
		delete(pool.clients, id)
	}
}

func (pool *Pool) Close() error {
	pool.clientMx.Lock()
	defer pool.clientMx.Unlock()

	pool.logger.Info().Msg("closing all connections")

	for _, client := range pool.clients {
		client.Close(ws.CloseNormalClosure, "server shutdown")
	}

	return nil
}
