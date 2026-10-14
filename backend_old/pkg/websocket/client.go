package websocket

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	ws "github.com/gorilla/websocket"
)

// HeartbeatTopic is the liveness message every frontend sends once per
// second. It is consumed by the websocket layer and never reaches the broker.
const HeartbeatTopic = "connection/heartbeat"

// heartbeatTimeout bounds how long a dead or frozen frontend goes undetected:
// if no message (the heartbeat guarantees one per second) arrives within this
// window, Read fails and the client is treated as disconnected.
const heartbeatTimeout = 3 * time.Second

type Client struct {
	readMx    *sync.Mutex
	writeMx   *sync.Mutex
	conn      *ws.Conn
	onCloseMx *sync.Mutex
	onClose   func()
}

func NewClient(conn *ws.Conn) *Client {
	client := &Client{
		readMx:    &sync.Mutex{},
		writeMx:   &sync.Mutex{},
		conn:      conn,
		onCloseMx: &sync.Mutex{},
		onClose:   func() {},
	}

	conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))

	return client
}

func (client *Client) SetOnClose(onClose func()) {
	client.onCloseMx.Lock()
	defer client.onCloseMx.Unlock()
	client.onClose = onClose
}

type Message struct {
	Topic   abstraction.BrokerTopic `json:"topic"`
	Payload json.RawMessage         `json:"payload"`
}

func (client *Client) Read() (Message, error) {
	client.readMx.Lock()
	defer client.readMx.Unlock()

	var message Message
	err := client.conn.ReadJSON(&message)
	if err == nil {
		client.conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))
	}
	return message, err
}

func (client *Client) Write(message Message) error {
	client.writeMx.Lock()
	defer client.writeMx.Unlock()

	return client.conn.WriteJSON(message)
}

func (client *Client) Close(code int, reason string) error {
	client.writeMx.Lock()
	defer client.writeMx.Unlock()
	client.conn.WriteControl(
		ws.CloseMessage,
		ws.FormatCloseMessage(code, reason),
		time.Now().Add(time.Second),
	)
	client.onCloseMx.Lock()
	defer client.onCloseMx.Unlock()
	client.onClose()
	return client.conn.Close()
}
