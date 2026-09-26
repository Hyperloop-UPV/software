package order_test

import (
	"encoding/json"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"log"
	"testing"
)

var errorFlag bool

type OutputNotMatchingError struct{}

func (e *OutputNotMatchingError) Error() string {
	return "Output does not match"
}

type MockAPI struct{}

func (api MockAPI) UserPush(push abstraction.BrokerPush) error {
	packet := push.(*order.Order)
	p := packet.Fields["test"]
	if p.IsEnabled != true || p.Type != "test" {
		errorFlag = true
		println(p.Value, p.IsEnabled, p.Type)
		return &OutputNotMatchingError{}
	}
	errorFlag = false
	log.Printf("Output matches")
	return nil
}

func (api MockAPI) UserPull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func TestOrderTopic_ClientMessage(t *testing.T) {
	api := MockAPI{}

	orderTopic := order.NewSendTopic()
	orderTopic.SetAPI(api)

	payload := order.Order{
		Id: 0,
		Fields: map[string]order.Field{
			"test": {
				Value:     nil,
				IsEnabled: true,
				Type:      "test",
			},
		},
	}
	payloadBytes, _ := json.Marshal(payload)
	orderTopic.ClientMessage(websocket.ClientId{0}, &websocket.Message{
		Topic:   order.SendName,
		Payload: payloadBytes,
	})

	if errorFlag {
		t.Errorf("Output does not match")
	}
}
