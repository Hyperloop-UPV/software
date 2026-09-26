package abstraction

// TransportTarget uniquely identifies a target resource for the Transport
// module operations
type TransportTarget string

// TransportEvent is an event of the Transport module
type TransportEvent string

// TransportNotification is a notification of an event being received
type TransportNotification interface {
	Event() TransportEvent
}

// TransportMessage is a request for data to be sent to the vehicle
type TransportMessage interface {
	Event() TransportEvent
}

// Transport is the module in charge of handling communication specifics with the
// vehicle
type Transport interface {
	// SendMessage sends the provided message to the vehicle
	SendMessage(TransportMessage) error

	// SetAPI sets the API the Transport must use to communicate with the rest of the back-end
	// through the Vehicle. It should avoid using any other means
	SetAPI(TransportAPI)
}

// TransportAPI is the available API for the Transport module
type TransportAPI interface {
	// Notification notifies the back-end that an event has been received
	Notification(TransportNotification)
	ConnectionUpdate(TransportTarget, bool)
}
