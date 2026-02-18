package vehicle

import (
	"github.com/HyperloopUPV-H8/h9-backend/internal/update_factory"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/rs/zerolog"
)

// New creates a new Vehicle with no modules registered on it
func New(baseLogger zerolog.Logger) Vehicle {
	logger := baseLogger.Sample(zerolog.LevelSampler{
		TraceSampler: zerolog.RandomSampler(50000),
		DebugSampler: zerolog.RandomSampler(1),
		InfoSampler:  zerolog.RandomSampler(1),
		WarnSampler:  zerolog.RandomSampler(1),
		ErrorSampler: zerolog.RandomSampler(1),
	})
	return Vehicle{
		boards: make(map[abstraction.BoardId]abstraction.Board),
		trace:  logger,
	}
}

// SetBroker sets the Vehicle Broker to the provided one
func (vehicle *Vehicle) SetBroker(broker abstraction.Broker) {
	broker.SetAPI(vehicle)
	vehicle.broker = broker
	vehicle.trace.Info().Type("broker", broker).Msg("set broker")
}

// AddBoard adds a Board to the Vehicle
func (vehicle *Vehicle) AddBoard(board abstraction.Board) {
	board.SetAPI(vehicle)
	vehicle.boards[board.Id()] = board
	vehicle.trace.Info().Type("board", board).Uint16("id", uint16(board.Id())).Msg("add board logic")
}

// RemoveBoard removes a Board from the Vehicle
func (vehicle *Vehicle) RemoveBoard(board abstraction.Board) {
	delete(vehicle.boards, board.Id())
	vehicle.trace.Info().Type("board", board).Uint16("id", uint16(board.Id())).Msg("remove board logic")
}

// RemoveBoardId removes a Board from the Vehicle based on its ID
func (vehicle *Vehicle) RemoveBoardId(id abstraction.BoardId) {
	delete(vehicle.boards, id)
	vehicle.trace.Info().Uint16("id", uint16(id)).Msg("remove board logic")

}

// SetTransport sets the Vehicle Transport to the provided one
func (vehicle *Vehicle) SetTransport(transport abstraction.Transport) {
	transport.SetAPI(vehicle)
	vehicle.transport = transport
	vehicle.trace.Info().Type("transport", transport).Msg("set transport")
}

// SetLogger sets the Vehicle Logger to the provided one
func (vehicle *Vehicle) SetLogger(logger abstraction.Logger) {
	vehicle.logger = logger
	vehicle.trace.Info().Type("logger", logger).Msg("set logger")
}

func (vehicle *Vehicle) SetUpdateFactory(updateFactory *update_factory.UpdateFactory) {
	vehicle.updateFactory = updateFactory
	vehicle.trace.Info().Type("updateFactory", updateFactory).Msg("set update factory")
}

func (vehicle *Vehicle) SetIdToBoardName(idToBoardName map[abstraction.PacketId]string) {
	vehicle.idToBoardName = idToBoardName
	vehicle.trace.Info().Msg("set id to board")
}

func (vehicle *Vehicle) SetIpToBoardId(ipToBoardId map[string]abstraction.BoardId) {
	vehicle.ipToBoardId = ipToBoardId
	vehicle.trace.Info().Msg("set ip to board id")
}

func (vehicle *Vehicle) SetBlcuId(id abstraction.BoardId) {
	vehicle.BlcuId = id
	vehicle.trace.Info().Uint16("blcu_id", uint16(id)).Msg("set blcu id")
}
