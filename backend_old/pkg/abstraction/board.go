package abstraction

// BoardEvent is the label of an event consumed by a board
type BoardEvent string

// BoardNotification is an event sent to a board
type BoardNotification interface {
	Event() BoardEvent
}

// BoardId is a unique identifier for each board, this is fetched from the ADE.
type BoardId uint16

// Board is a module in charge of handling specific board behaviour (e.g. the BLCU)
type Board interface {
	// Id returns the unique BoardId for this Board
	Id() BoardId
	// Notify signals the board that an event that it should handle has been generated
	Notify(BoardNotification)
	// SetAPI is called by Vehicle to provide necessary methods for this module.
	// The Board is responsible for storing the provided BoardAPI and using it later.
	// All requests made by a Board to the Vehicle must be made using this API to avoid
	// communication conflicts
	SetAPI(BoardAPI)
}

// BoardAPI provides an interface between the Board and the Vehicle.
// Boards should only use this interface to communicate with the rest of the backend
type BoardAPI interface {
	// Request sends a Request to the Broker for user information and returns the Response
	// and any errors encountered
	Request(BrokerRequest) (BrokerResponse, error)
	// SendPush sends additional information to the Broker.
	SendPush(BrokerPush) error
	// SendMessage sends a message to Transport.
	SendMessage(TransportMessage) error
}
