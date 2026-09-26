package order

import (
	"encoding/json"
	"fmt"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
)

const SendName abstraction.BrokerTopic = "order/send"

type Send struct {
	pool *websocket.Pool
	api  abstraction.BrokerAPI
}

func NewSendTopic() *Send {
	return &Send{}
}

func (send Send) Topic() abstraction.BrokerTopic {
	return SendName
}

func (send *Send) Push(push abstraction.BrokerPush) error {
	return nil
}

func (send *Send) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func (send *Send) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	switch message.Topic {
	case SendName:
		err := send.handleOrder(id, message)
		if err != nil {
			fmt.Printf("error handling order: %v\n", err)
		}
	}
}

func (send *Send) handleOrder(_ websocket.ClientId, message *websocket.Message) error {
	var order Order
	err := json.Unmarshal(message.Payload, &order)
	if err != nil {
		return err
	}

	pushErr := send.api.UserPush(&order) // TODO! Error handling
	return pushErr
}

func (send *Send) SetPool(pool *websocket.Pool) {
	send.pool = pool
}

func (send *Send) SetAPI(api abstraction.BrokerAPI) {
	send.api = api
}

type Order struct {
	Id     uint16           `json:"id"`
	Fields map[string]Field `json:"fields"`
}

func (order *Order) Topic() abstraction.BrokerTopic {
	return SendName
}

func (order *Order) ToPacket() (*data.Packet, error) {
	values := make(map[data.ValueName]data.Value)
	enabled := make(map[data.ValueName]bool)
	for name, field := range order.Fields {
		enabled[data.ValueName(name)] = field.IsEnabled
		switch field.Type {
		case "uint8":
			values[data.ValueName(name)] = data.NewNumericValue[uint8]((uint8)(field.Value.(float64)))
		case "uint16":
			values[data.ValueName(name)] = data.NewNumericValue[uint16]((uint16)(field.Value.(float64)))
		case "uint32":
			values[data.ValueName(name)] = data.NewNumericValue[uint32]((uint32)(field.Value.(float64)))
		case "uint64":
			values[data.ValueName(name)] = data.NewNumericValue[uint64]((uint64)(field.Value.(float64)))
		case "int8":
			values[data.ValueName(name)] = data.NewNumericValue[int8]((int8)(field.Value.(float64)))
		case "int16":
			values[data.ValueName(name)] = data.NewNumericValue[int16]((int16)(field.Value.(float64)))
		case "int32":
			values[data.ValueName(name)] = data.NewNumericValue[int32]((int32)(field.Value.(float64)))
		case "int64":
			values[data.ValueName(name)] = data.NewNumericValue[int64]((int64)(field.Value.(float64)))
		case "float32":
			values[data.ValueName(name)] = data.NewNumericValue[float32]((float32)(field.Value.(float64)))
		case "float64":
			values[data.ValueName(name)] = data.NewNumericValue[float64](field.Value.(float64))
		case "bool":
			values[data.ValueName(name)] = data.NewBooleanValue(field.Value.(bool))
		case "enum":
			values[data.ValueName(name)] = data.NewEnumValue(data.EnumVariant(field.Value.(string)))
		default:
			return nil, fmt.Errorf("unknown field type %s", field.Type)
		}
	}

	return data.NewPacketWithValues(abstraction.PacketId(order.Id), values, enabled), nil
}

type Field struct {
	Value     any    `json:"value"`
	IsEnabled bool   `json:"isEnabled"`
	Type      string `json:"type"`
}
