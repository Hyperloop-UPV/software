package vehicle

import (
	"errors"
	"fmt"
	"strings"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	data_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/data"
	message_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/message"
	order_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	data_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	protection_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/protection"
	state_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/state"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport"
	blcu_packet "github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/state"
)

// Notification is the method invoked by transport to notify of a new event (e.g.packet received)
func (vehicle *Vehicle) Notification(notification abstraction.TransportNotification) {
	vehicle.trace.Trace().Type("notification", notification).Msg("notification")

	err := error(nil)
	switch concreteNotification := notification.(type) {
	case transport.PacketNotification:
		err = vehicle.handlePacketNotification(concreteNotification)
	case transport.ErrorNotification:
		err = concreteNotification.Err
	default:
		vehicle.trace.Warn().Type("notification", notification).Msg("unexpected notification type")
		err = ErrUnexpectedNotification{Notification: notification}
	}

	if err != nil {
		vehicle.notifyError("Transport Error", err)
	}
}

func (vehicle *Vehicle) handlePacketNotification(notification transport.PacketNotification) error {
	var to string

	switch p := notification.Packet.(type) {
	case *data.Packet:
		update := vehicle.updateFactory.NewUpdate(p)
		err := vehicle.broker.Push(data_topic.NewPush(&update))
		if err != nil {
			vehicle.trace.Error().Stack().Err(err).Msg("broker push")
			return errors.Join(fmt.Errorf("update data to frontend (data with id %d from %s to %s)", p.Id(), notification.From, notification.To), err)
		}

		from, exists := vehicle.idToBoardName[notification.Packet.Id()]
		if !exists {
			from = notification.From
		}

		to_ip := strings.Split(notification.To, ":")[0]

		if to_ip == "192.168.0.9" || to_ip == "127.0.0.9" {
			to = "backend"
		} else {
			to, exists = vehicle.idToBoardName[notification.Packet.Id()]
			if !exists {
				to = notification.From
			}
		}

		err = vehicle.logger.PushRecord(&data_logger.Record{
			Packet:    p,
			From:      from,
			To:        to,
			Timestamp: notification.Timestamp,
		})

		if err != nil && !errors.Is(err, logger.ErrLoggerNotRunning{}) {
			vehicle.trace.Error().Stack().Err(err).Msg("logger push")
			return errors.Join(fmt.Errorf("log data to disk (data with id %d from %s to %s)", p.Id(), notification.From, notification.To))
		}

	case *protection.Packet:
		boardId := vehicle.ipToBoardId[strings.Split(notification.From, ":")[0]]
		err := vehicle.broker.Push(message_topic.Push(p, vehicle.idToBoardName[p.Id()]))
		if err != nil {
			vehicle.trace.Error().Stack().Err(err).Msg("broker push")
			return errors.Join(fmt.Errorf("update protection to frontend (%s protection with id %d and kind %d from %s to %s)", p.Severity(), p.Id(), p.Kind, notification.From, notification.To), err)
		}

		err = vehicle.logger.PushRecord(&protection_logger.Record{
			Packet:    p,
			BoardId:   boardId,
			From:      notification.From,
			To:        notification.To,
			Timestamp: notification.Timestamp,
		})

		if err != nil && !errors.Is(err, logger.ErrLoggerNotRunning{}) {
			vehicle.trace.Error().Stack().Err(err).Msg("logger push")
			return errors.Join(fmt.Errorf("log protection to disk (%s protection with id %d and kind %d from %s to %s)", p.Severity(), p.Id(), p.Kind, notification.From, notification.To), err)
		}

	case *state.Space:
		err := vehicle.logger.PushRecord(&state_logger.Record{
			Packet:    p,
			From:      notification.From,
			To:        notification.To,
			Timestamp: notification.Timestamp,
		})

		if err != nil && !errors.Is(err, logger.ErrLoggerNotRunning{}) {
			vehicle.trace.Error().Stack().Err(err).Msg("logger push")
			return errors.Join(fmt.Errorf("log state space to disk"), err)
		}

	case *order.Add:
		err := vehicle.broker.Push(order_topic.NewAdd(p))

		if err != nil {
			vehicle.trace.Error().Stack().Err(err).Msg("add state orders")
			return errors.Join(fmt.Errorf("add state orders (state orders from %s to %s)", notification.From, notification.To), err)
		}
	case *order.Remove:
		err := vehicle.broker.Push(order_topic.NewRemove(p))

		if err != nil {
			vehicle.trace.Error().Stack().Err(err).Msg("remove state orders")
			return errors.Join(fmt.Errorf("remove state orders (state orders from %s to %s)", notification.From, notification.To), err)
		}
	case *blcu_packet.Ack:
		vehicle.boards[vehicle.BlcuId].Notify(abstraction.BoardNotification(
			&boards.AckNotification{
				ID: boards.AckId,
			},
		))
	}
	return nil
}
