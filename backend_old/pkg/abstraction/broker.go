package abstraction

// BrokerTopic is the name of a topic of the broker.
// Topics follow a structure similar to the directory structure of a computer
type BrokerTopic string

// BrokerPush is information that flows from the back-end to the front-end.
type BrokerPush interface {
	Topic() BrokerTopic
}

// BrokerRequest is a back-end initiated request that should be answered.
type BrokerRequest interface {
	Topic() BrokerTopic
}

// BrokerResponse is the response from the front-end to the back-end after a request
type BrokerResponse interface {
	Topic() BrokerTopic
}

// Broker is the module in charge of handling back-end and front-end communications.
// It uses Topics to determine how each message should be handled and who should receive it.
type Broker interface {
	// Push sends information from the back-end to the front-end
	Push(BrokerPush) error
	// Pull requests information from the front-end.
	// The response or any errors encountered are returned.
	Pull(BrokerRequest) (BrokerResponse, error)
	// SetAPI sets the API the Broker must use to communicate with the rest of the back-end
	// through the Vehicle. It should avoid using any other means
	SetAPI(BrokerAPI)
}

// BrokerAPI is the API provided for the Broker by the Vehicle.
// The Broker must use this to communicate with the rest of the code
type BrokerAPI interface {
	// UserPush notifies that the front-end has sent information without a previous request.
	UserPush(BrokerPush) error
	// UserPull notifies that the front-end has requested information.
	UserPull(BrokerRequest) (BrokerResponse, error)
}
