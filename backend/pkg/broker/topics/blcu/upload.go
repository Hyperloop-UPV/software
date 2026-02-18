package blcu

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
)

const UploadName abstraction.BrokerTopic = "blcu/upload"

type Upload struct {
	pool   *websocket.Pool
	api    abstraction.BrokerAPI
	client websocket.ClientId
}

func (upload *Upload) Topic() abstraction.BrokerTopic {
	return UploadName
}

type UploadRequest struct {
	Board string `json:"board"`
	File  string `json:"file"`  // Base64 encoded file data from frontend
}

func (request UploadRequest) Topic() abstraction.BrokerTopic {
	return "blcu/uploadRequest"
}

// UploadRequestInternal is the internal representation with decoded data
type UploadRequestInternal struct {
	Board string
	Data  []byte
}

func (request UploadRequestInternal) Topic() abstraction.BrokerTopic {
	return "blcu/uploadRequest"
}

func (upload *Upload) Push(push abstraction.BrokerPush) error {
	switch push.(type) {
	case *boards.UploadSuccess:
		// Send success response
		response := map[string]interface{}{
			"percentage": 100,
			"failure":    false,
		}
		payload, _ := json.Marshal(response)
		err := upload.pool.Write(upload.client, websocket.Message{
			Topic:   UploadName,
			Payload: payload,
		})
		if err != nil {
			return err
		}

	case *boards.UploadFailure:
		// Send failure response
		response := map[string]interface{}{
			"percentage": 0,
			"failure":    true,
		}
		payload, _ := json.Marshal(response)
		err := upload.pool.Write(upload.client, websocket.Message{
			Topic:   UploadName,
			Payload: payload,
		})
		if err != nil {
			return err
		}
	}

	return nil
}

func (upload *Upload) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return nil, nil
}

func (upload *Upload) ClientMessage(id websocket.ClientId, message *websocket.Message) {
	upload.client = id

	switch message.Topic {
	case UploadName:
		err := upload.handleUpload(message)
		if err != nil {
			fmt.Printf("error handling download: %v\n", err)
		}
	}
}

func (upload *Upload) handleUpload(message *websocket.Message) error {
	var uploadRequest UploadRequest
	err := json.Unmarshal(message.Payload, &uploadRequest)
	if err != nil {
		return err
	}

	// Decode base64 file data
	fileData, err := base64.StdEncoding.DecodeString(uploadRequest.File)
	if err != nil {
		return fmt.Errorf("failed to decode base64 file data: %w", err)
	}

	// Create the internal upload event with decoded data
	internalRequest := &UploadRequestInternal{
		Board: uploadRequest.Board,
		Data:  fileData,
	}

	pushErr := upload.api.UserPush(internalRequest)
	return pushErr
}

func (upload *Upload) SetPool(pool *websocket.Pool) {
	upload.pool = pool
}

func (upload *Upload) SetAPI(api abstraction.BrokerAPI) {
	upload.api = api
}
